import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = await mkdtemp(path.join(tmpdir(), 'fnd-pos-verify-'));
const dbPath = path.join(tempRoot, 'verify.sqlite');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'server.ts'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), POS_DB_PATH: dbPath },
  stdio: 'ignore',
});

let cookie = '';
async function request(route, { method = 'GET', body, authenticated = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (authenticated && cookie) headers.cookie = cookie;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { response, result };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`POS server exited early (${server.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* wait for startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('POS server did not become ready in 20 seconds.');
}

async function saveState(state, expectedRevision) {
  const { response, result } = await request('/api/state', {
    method: 'PUT',
    body: { state, expectedRevision },
  });
  assert.equal(response.status, 200, `state save failed: ${JSON.stringify(result)}`);
  return result;
}

try {
  await waitForServer();
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200, 'production app page loads');
  assert.match(await page.text(), /<div id="root"><\/div>/, 'production app root is served');

  let result = await request('/api/auth/setup-status', { authenticated: false });
  assert.equal(result.result.setupRequired, true, 'empty database requests first-run setup');
  result = await request('/api/state', { authenticated: false });
  assert.equal(result.response.status, 401, 'database is protected before sign-in');

  result = await request('/api/auth/setup', {
    method: 'POST',
    authenticated: false,
    body: { name: 'POS Test Admin', username: 'test.admin', pin: '6824' },
  });
  assert.equal(result.response.status, 201, `first admin setup succeeds: ${JSON.stringify(result.result)}`);
  assert.equal(result.result.user.role, 'admin', 'setup creates admin role');
  assert.ok(cookie, 'setup starts a signed-in session');

  const initial = await request('/api/state');
  assert.equal(initial.response.status, 200, 'new admin can load initialized state');
  assert.equal(initial.result.state.products.length, 0, 'fresh setup contains no fake product or sales data');
  assert.equal(initial.result.state.transactions.length, 0, 'fresh setup contains no fake transactions');
  assert.equal(initial.result.state.settings.storeName, 'Your POS', 'fresh setup has a generic shop-name placeholder');
  assert.equal(initial.result.state.settings.taxId, '', 'fresh setup contains no prefilled GSTIN');
  assert.equal(initial.result.state.settings.businessSetupComplete, false, 'fresh setup requires business registration step');
  const adminId = initial.result.state.activeUser.id;
  result = await request('/api/auth/setup-status', { authenticated: false });
  assert.equal(result.result.setupRequired, false, 'setup is one-time');
  result = await request('/api/auth/setup', {
    method: 'POST', body: { name: 'Second Admin', username: 'second.admin', pin: '7935' },
  });
  assert.equal(result.response.status, 409, 'setup cannot replace an existing account');

  const products = [];
  const transactions = [];
  const adjustments = [];
  const startedAt = Date.parse('2026-01-01T09:00:00.000Z');
  for (let index = 1; index <= 500; index += 1) {
    const suffix = String(index).padStart(4, '0');
    const productId = `product-test-${suffix}`;
    const variantId = `variant-test-${suffix}`;
    const sku = `FND-TEST-${suffix}`;
    const barcode = `8907000${String(index).padStart(6, '0')}`;
    products.push({
      id: productId,
      name: `Load Test Garment ${suffix}`,
      category: 'Shirts',
      brand: 'FND Test Range',
      styleCode: `STYLE-${suffix}`,
      gender: 'Unisex',
      material: 'Cotton blend',
      taxRate: 5,
      hsnCode: '6205',
      createdAt: new Date(startedAt).toISOString(),
      updatedAt: new Date(startedAt).toISOString(),
      notes: '',
      variants: [{
        id: variantId, productId, sku, barcode, size: 'M', color: 'Navy',
        costPrice: 400, sellingPrice: 1000, stock: 1, minStockThreshold: 1, location: 'Test Rack',
      }],
    });
    const tax = 50;
    transactions.push({
      id: `sale-test-${suffix}`,
      receiptNumber: `TEST-2026-${suffix}`,
      timestamp: new Date(startedAt + index * 60_000).toISOString(),
      cashierId: adminId,
      cashierName: 'POS Test Admin',
      items: [{
        variantId, productId, productName: `Load Test Garment ${suffix}`, sku, barcode, hsnCode: '6205',
        size: 'M', color: 'Navy', unitPrice: 1000, unitCost: 400, quantity: 1,
        discountType: 'fixed', discountValue: 0, lineTotal: 1000, taxableValue: 1000,
        taxRate: 5, taxAmount: tax, cgstAmount: 25, sgstAmount: 25,
      }],
      subtotal: 1000,
      discountTotal: 0,
      taxTotal: tax,
      grandTotal: 1050,
      payments: [{ method: index % 2 ? 'cash' : 'upi', amount: 1050, ...(index % 2 ? {} : { reference: `UPI-TEST-${suffix}` }) }],
      changeGiven: 0,
      status: 'completed',
      shiftId: 'shift-test-1',
    });
    adjustments.push({
      id: `adjustment-test-${suffix}`,
      timestamp: new Date(startedAt + index * 60_000).toISOString(),
      variantId, productId, productName: `Load Test Garment ${suffix}`, sku, barcode,
      size: 'M', color: 'Navy', changeQty: 2, previousStock: 0, newStock: 2,
      type: 'restock', reason: '500-record integration fixture', userId: adminId, userName: 'POS Test Admin',
    });
  }

  // Each sale consumes one unit; the first sale's resalable return puts that unit back.
  products[0].variants[0].stock = 2;
  const firstSale = transactions[0];
  firstSale.status = 'partially_refunded';
  const cashier = {
    id: 'user-test-cashier', name: 'POS Test Cashier', username: 'test.cashier',
    pin: '', role: 'cashier', active: true,
  };
  const state = {
    ...initial.result.state,
    settings: {
      ...initial.result.state.settings,
      storeName: 'Verification Garments',
      legalBusinessName: 'Verification Garments Private Limited',
      address: '10 Test Market, Aligarh, Uttar Pradesh 202001',
      stateCode: '09',
      stateName: 'Uttar Pradesh',
      taxId: '09AAAAA0000A1Z5',
      registrationType: 'regular',
      businessSetupComplete: true,
    },
    users: [...initial.result.state.users, cashier],
    products,
    transactions,
    returns: [{
      id: 'return-test-1', originalSaleId: firstSale.id, originalReceiptNumber: firstSale.receiptNumber,
      returnReceiptNumber: 'RET-TEST-0001', timestamp: new Date(startedAt + 501 * 60_000).toISOString(),
      cashierId: adminId, cashierName: 'POS Test Admin',
      returnedItems: [{
        variantId: 'variant-test-0001', productName: 'Load Test Garment 0001', sku: 'FND-TEST-0001',
        size: 'M', color: 'Navy', quantity: 1, unitPrice: 1000, refundAmount: 1050,
        condition: 'resalable', restocked: true,
      }],
      totalRefundAmount: 1050, refundMethod: 'cash', reason: 'Integration verification',
    }],
    shifts: [{
      id: 'shift-test-1', cashierId: adminId, cashierName: 'POS Test Admin',
      openedAt: new Date(startedAt).toISOString(), status: 'open', openingFloat: 2000,
      cashSales: 250 * 1050, cashRefunds: 1050, cashIn: 0, cashOut: 0, drops: [],
    }],
    adjustments,
    expenses: [{
      id: 'expense-test-1', date: '2026-01-31', category: 'Rent', description: 'Test rent expense',
      amount: 25000, paymentMethod: 'Bank Transfer', recordedBy: 'POS Test Admin',
    }],
  };

  let saved = await saveState(state, initial.result.revision);
  assert.equal(saved.revision, 2, '500-record snapshot commits transactionally');
  const db = new DatabaseSync(dbPath);
  const counts = Object.fromEntries(['products', 'variants', 'sales', 'sale_items', 'sale_payments', 'sale_returns', 'register_shifts', 'operating_expenses', 'stock_adjustments']
    .map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
  assert.equal(counts.products, 500);
  assert.equal(counts.variants, 500);
  assert.equal(counts.sales, 500);
  assert.equal(counts.sale_items, 500);
  assert.equal(counts.sale_payments, 500);
  assert.equal(counts.sale_returns, 1);
  assert.equal(counts.register_shifts, 1);
  assert.equal(counts.operating_expenses, 1);
  assert.equal(counts.stock_adjustments, 500);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok', 'large dataset database integrity');
  db.close();

  result = await request('/api/auth/credential', {
    method: 'POST', body: { userId: cashier.id, pin: '4297', action: 'set' },
  });
  assert.equal(result.response.status, 200, 'admin can assign staff credential');
  result = await request('/api/state');
  assert.equal(result.result.state.products.find((product) => product.variants[0].barcode === '8907000000001').name, 'Load Test Garment 0001', 'barcode-indexed product is searchable');
  assert.equal(result.result.state.products[0].variants[0].stock, 2, 'resalable return restored stock');
  assert.equal(result.result.state.products[1].variants[0].stock, 1, 'sale decremented stock');

  result = await request('/api/auth/login', {
    method: 'POST', authenticated: false,
    body: { username: 'test.cashier', pin: '4297' },
  });
  assert.equal(result.response.status, 200, 'cashier can sign in');
  const cashierCookie = cookie;
  result = await request('/api/state');
  assert.equal(result.result.state.users.length, 1, 'cashier only sees own staff record');
  assert.equal(result.result.state.expenses.length, 0, 'cashier cannot read expenses');
  assert.equal(result.result.state.adjustments.length, 0, 'cashier cannot read stock audit log');
  assert.equal(result.result.state.products[0].variants[0].costPrice, 0, 'cashier cannot read product cost');

  const forbiddenSettings = structuredClone(result.result.state);
  forbiddenSettings.settings.storeName = 'Unauthorized Change';
  const denied = await request('/api/state', { method: 'PUT', body: { state: forbiddenSettings, expectedRevision: result.result.revision } });
  assert.equal(denied.response.status, 403, 'server blocks cashier from editing settings');

  const checkoutState = structuredClone(result.result.state);
  const checkoutVariant = checkoutState.products[1].variants[0];
  checkoutVariant.stock -= 1;
  const cashierSaleId = 'sale-test-cashier-0001';
  checkoutState.transactions.push({
    id: cashierSaleId, receiptNumber: 'TEST-CASHIER-0001', timestamp: new Date().toISOString(),
    cashierId: cashier.id, cashierName: cashier.name,
    items: [{
      variantId: checkoutVariant.id, productId: checkoutVariant.productId, productName: checkoutState.products[1].name,
      sku: checkoutVariant.sku, barcode: checkoutVariant.barcode, hsnCode: '6205', size: 'M', color: 'Navy',
      unitPrice: 1000, unitCost: 0, quantity: 1, discountType: 'fixed', discountValue: 0,
      lineTotal: 1000, taxableValue: 1000, taxRate: 5, taxAmount: 50, cgstAmount: 25, sgstAmount: 25,
    }],
    subtotal: 1000, discountTotal: 0, taxTotal: 50, grandTotal: 1050,
    payments: [{ method: 'upi', amount: 1050, reference: 'UPI-TEST-CASHIER-001' }], changeGiven: 0, status: 'completed', shiftId: 'shift-test-1',
  });
  const missingReferenceState = structuredClone(checkoutState);
  delete missingReferenceState.transactions.at(-1).payments[0].reference;
  const missingReference = await request('/api/state', {
    method: 'PUT', body: { state: missingReferenceState, expectedRevision: result.result.revision },
  });
  assert.equal(missingReference.response.status, 400, 'server rejects UPI sale without reference number');
  saved = await saveState(checkoutState, result.result.revision);
  assert.equal(saved.revision, 3, 'cashier checkout saves with matching stock movement');

  cookie = cashierCookie;
  result = await request('/api/auth/logout', { method: 'POST', body: {} });
  assert.equal(result.response.status, 200, 'staff can sign out');
  cookie = '';
  result = await request('/api/auth/session', { authenticated: false });
  assert.equal(result.response.status, 401, 'logout revokes server session');
  result = await request('/api/state', { authenticated: false });
  assert.equal(result.response.status, 401, 'database remains protected after logout');

  result = await request('/api/auth/login', {
    method: 'POST', authenticated: false,
    body: { username: 'test.admin', pin: '6824' },
  });
  assert.equal(result.response.status, 200, 'admin can return after staff logout for tax-mode verification');
  const makeNoTaxSale = (id, placeCode) => ({
    id, receiptNumber: id, timestamp: new Date().toISOString(), cashierId: adminId, cashierName: 'POS Test Admin',
    customerName: 'Mode Test Customer', placeOfSupplyStateCode: placeCode, placeOfSupplyStateName: placeCode === '09' ? 'Uttar Pradesh' : 'Haryana',
    items: [{ variantId: 'variant-test-0001', productId: 'product-test-0001', productName: 'Load Test Garment 0001',
      sku: 'FND-TEST-0001', barcode: '8907000000001', hsnCode: '6205', size: 'M', color: 'Navy',
      unitPrice: 1000, unitCost: 400, quantity: 1, discountType: 'fixed', discountValue: 0,
      lineTotal: 1000, taxableValue: 1000, taxRate: 0, taxAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 }],
    subtotal: 1000, discountTotal: 0, taxTotal: 0, grandTotal: 1000,
    payments: [{ method: 'cash', amount: 1000 }], changeGiven: 0, status: 'completed', shiftId: 'shift-test-1',
  });

  let modeSnapshot = await request('/api/state');
  let compositionState = structuredClone(modeSnapshot.result.state);
  compositionState.settings.registrationType = 'composition';
  compositionState.transactions.push(makeNoTaxSale('sale-test-composition-interstate', '06'));
  let modeResponse = await request('/api/state', { method: 'PUT', body: { state: compositionState, expectedRevision: modeSnapshot.result.revision } });
  assert.equal(modeResponse.response.status, 403, 'composition mode blocks interstate garment sales');

  compositionState = structuredClone(modeSnapshot.result.state);
  compositionState.settings.registrationType = 'composition';
  compositionState.transactions.push(makeNoTaxSale('sale-test-composition-local', '09'));
  saved = await saveState(compositionState, modeSnapshot.result.revision);
  assert.equal(saved.revision, modeSnapshot.result.revision + 1, 'composition mode accepts an in-state sale without GST collection');

  modeSnapshot = await request('/api/state');
  const unregisteredState = structuredClone(modeSnapshot.result.state);
  unregisteredState.settings.registrationType = 'unregistered';
  unregisteredState.settings.taxId = '';
  unregisteredState.settings.legalBusinessName = '';
  unregisteredState.transactions.push(makeNoTaxSale('sale-test-unregistered-local', '09'));
  saved = await saveState(unregisteredState, modeSnapshot.result.revision);
  assert.equal(saved.revision, modeSnapshot.result.revision + 1, 'unregistered mode accepts a retail sale without GST collection');

  console.log('PASS: first-run setup, sessions, RBAC, barcode lookup, sale/return stock, GST totals, mandatory electronic payment references, shifts, expenses, and SQLite persistence.');
  console.log('PASS: composition mode blocks interstate garment sales and both composition and unregistered modes accept zero-GST sales.');
  console.log(`PASS: ${counts.products} products, ${counts.variants} variants, ${counts.sales} sales, ${counts.sale_items} sale lines, ${counts.sale_payments} payments, ${counts.stock_adjustments} stock records.`);
  console.log('PASS: isolated test database only; live shop database was not used.');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 350));
  await rm(tempRoot, { recursive: true, force: true });
}
