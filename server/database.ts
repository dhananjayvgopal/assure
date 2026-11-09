import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DEFAULT_ROLE_PERMISSIONS, userHasPermission, type Permission } from '../src/utils/permissions';

type PosState = {
  settings: Record<string, unknown>;
  users: Array<Record<string, any>>;
  products: Array<Record<string, any>>;
  transactions: Array<Record<string, any>>;
  returns: Array<Record<string, any>>;
  shifts: Array<Record<string, any>>;
  expenses: Array<Record<string, any>>;
  adjustments: Array<Record<string, any>>;
  vouchers?: Array<Record<string, any>>;
  offers?: Array<Record<string, any>>;
  heldBills?: Array<Record<string, any>>;
  customers?: Array<Record<string, any>>;
  activeUser?: Record<string, any>;
};

const dbPath = process.env.POS_DB_PATH || fileURLToPath(new URL('../database/fnd-clothing-pos.sqlite', import.meta.url));
mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
const schemaPath = process.env.POS_SCHEMA_PATH || fileURLToPath(new URL('../database/schema.sql', import.meta.url));
db.exec(readFileSync(schemaPath, 'utf8'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.prepare("UPDATE database_meta SET value = '2' WHERE key = 'schema_version'").run();

// Upgrade existing databases safely: install the constraint only when legacy data
// has no collisions. Barcode comparisons ignore surrounding whitespace and case.
const barcodeDuplicates = db.prepare(`SELECT UPPER(TRIM(barcode)) AS barcode, COUNT(*) AS count
  FROM variants WHERE TRIM(barcode) <> '' GROUP BY UPPER(TRIM(barcode)) HAVING COUNT(*) > 1`).all() as Array<{ barcode: string; count: number }>;
if (barcodeDuplicates.length === 0) {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_barcode_unique
    ON variants(UPPER(TRIM(barcode))) WHERE TRIM(barcode) <> ''`);
} else {
  console.warn(`Barcode uniqueness index not installed: ${barcodeDuplicates.length} duplicate barcode group(s) need cleanup.`);
}

const json = (value: unknown) => JSON.stringify(value ?? null);
const text = (value: unknown) => String(value ?? '');
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

function validateState(value: unknown): value is PosState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return ['settings', 'users', 'products', 'transactions', 'returns', 'shifts', 'expenses', 'adjustments']
    .every((key) => key === 'settings' ? !!state[key] && typeof state[key] === 'object' : Array.isArray(state[key]))
    && (state.vouchers === undefined || Array.isArray(state.vouchers))
    && (state.offers === undefined || Array.isArray(state.offers))
    && (state.heldBills === undefined || Array.isArray(state.heldBills))
    && (state.customers === undefined || Array.isArray(state.customers));
}

function currentSnapshot() {
  const row = db.prepare('SELECT revision, payload, updated_at FROM pos_state WHERE id = 1').get() as
    { revision: number; payload: string; updated_at: string } | undefined;
  if (!row) return { state: null, revision: 0, updatedAt: null };
  return { state: JSON.parse(row.payload) as PosState, revision: row.revision, updatedAt: row.updated_at };
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const credentials = db.prepare('SELECT pin_salt, pin_hash FROM user_credentials WHERE user_id = ?');

function makePinHash(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 64).toString('hex');
  return { salt, hash };
}

function setPinHash(userId: string, pin: string) {
  const { salt, hash } = makePinHash(pin);
  db.prepare(`INSERT INTO user_credentials(user_id, pin_salt, pin_hash, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET pin_salt = excluded.pin_salt, pin_hash = excluded.pin_hash, updated_at = excluded.updated_at`)
    .run(userId, salt, hash, new Date().toISOString());
}

function pinMatches(userId: string, pin: string) {
  const record = credentials.get(userId) as { pin_salt: string; pin_hash: string } | undefined;
  if (!record) return false;
  const computed = scryptSync(pin, record.pin_salt, 64);
  const expected = Buffer.from(record.pin_hash, 'hex');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

function cleanUser(user: Record<string, any>) {
  const { pin: _pin, ...safeUser } = user;
  return { ...safeUser, pin: '' };
}

function cleanState(state: PosState): PosState {
  return {
    ...state,
    customers: state.customers || [],
    users: state.users.map(cleanUser),
    activeUser: state.activeUser ? cleanUser(state.activeUser) : undefined,
  };
}

function migrateLegacyPins() {
  const snapshot = currentSnapshot();
  if (!snapshot.state) return;
  const legacyState = snapshot.state as PosState;
  let migrated = false;
  for (const user of legacyState.users) {
    if (typeof user.pin === 'string' && user.pin.length === 4 && !credentials.get(text(user.id))) {
      setPinHash(text(user.id), user.pin);
      migrated = true;
    }
  }
  if (migrated || legacyState.users.some((user) => 'pin' in user)) {
    const cleaned = cleanState(legacyState);
    const revision = snapshot.revision + 1;
    const updatedAt = new Date().toISOString();
    replaceRelationalRows(cleaned);
    db.prepare('UPDATE pos_state SET revision = ?, payload = ?, updated_at = ? WHERE id = 1')
      .run(revision, json(cleaned), updatedAt);
  }
}

function replaceRelationalRows(state: PosState) {
  db.exec(`
    DELETE FROM sale_payments;
    DELETE FROM sale_items;
    DELETE FROM sales;
    DELETE FROM sale_returns;
    DELETE FROM register_shifts;
    DELETE FROM operating_expenses;
    DELETE FROM stock_adjustments;
    DELETE FROM variants;
    DELETE FROM products;
    DELETE FROM users;
    DELETE FROM customers;
    DELETE FROM store_settings;
  `);

  const setting = db.prepare('INSERT INTO store_settings(id, data_json) VALUES (?, ?)');
  setting.run('store', json(state.settings));
  const insertCustomer = db.prepare('INSERT INTO customers(id, name, phone, gstin, data_json) VALUES (?, ?, ?, ?, ?)');
  for (const customer of state.customers || []) insertCustomer.run(text(customer.id), text(customer.name), text(customer.phone), text(customer.gstin), json(customer));

  const insertUser = db.prepare('INSERT INTO users(id, username, role, active, data_json) VALUES (?, ?, ?, ?, ?)');
  for (const user of state.users) {
    insertUser.run(text(user.id), text(user.username), text(user.role), user.active === false ? 0 : 1, json(cleanUser(user)));
  }

  const insertProduct = db.prepare('INSERT INTO products(id, name, category, hsn_code, tax_rate, data_json) VALUES (?, ?, ?, ?, ?, ?)');
  const insertVariant = db.prepare('INSERT INTO variants(id, product_id, sku, barcode, size, color, stock, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const product of state.products) {
    insertProduct.run(text(product.id), text(product.name), text(product.category), text(product.hsnCode), number(product.taxRate), json(product));
    for (const variant of Array.isArray(product.variants) ? product.variants : []) {
      insertVariant.run(text(variant.id), text(product.id), text(variant.sku), text(variant.barcode), text(variant.size), text(variant.color), number(variant.stock), json(variant));
    }
  }

  const insertSale = db.prepare('INSERT INTO sales(id, receipt_number, sold_at, cashier_id, status, subtotal, tax_total, grand_total, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO sale_items(id, sale_id, product_id, variant_id, sku, hsn_code, quantity, taxable_value, tax_amount, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertPayment = db.prepare('INSERT INTO sale_payments(sale_id, method, amount, data_json) VALUES (?, ?, ?, ?)');
  for (const sale of state.transactions) {
    insertSale.run(text(sale.id), text(sale.receiptNumber), text(sale.timestamp), text(sale.cashierId), text(sale.status), number(sale.subtotal), number(sale.taxTotal), number(sale.grandTotal), json(sale));
    for (const [index, item] of (Array.isArray(sale.items) ? sale.items : []).entries()) {
      insertItem.run(`${text(sale.id)}:${index}`, text(sale.id), text(item.productId), text(item.variantId), text(item.sku), text(item.hsnCode), number(item.quantity), number(item.lineTotal), number(item.taxAmount), json(item));
    }
    for (const payment of Array.isArray(sale.payments) ? sale.payments : []) {
      insertPayment.run(text(sale.id), text(payment.method), number(payment.amount), json(payment));
    }
  }

  const insertReturn = db.prepare('INSERT INTO sale_returns(id, original_sale_id, returned_at, refund_amount, data_json) VALUES (?, ?, ?, ?, ?)');
  for (const item of state.returns) insertReturn.run(text(item.id), text(item.originalSaleId), text(item.timestamp), number(item.totalRefundAmount), json(item));

  const insertShift = db.prepare('INSERT INTO register_shifts(id, status, opened_at, closed_at, data_json) VALUES (?, ?, ?, ?, ?)');
  for (const shift of state.shifts) insertShift.run(text(shift.id), text(shift.status), text(shift.openedAt), shift.closedAt ? text(shift.closedAt) : null, json(shift));

  const insertExpense = db.prepare('INSERT INTO operating_expenses(id, expense_date, category, amount, data_json) VALUES (?, ?, ?, ?, ?)');
  for (const expense of state.expenses) insertExpense.run(text(expense.id), text(expense.date), text(expense.category), number(expense.amount), json(expense));

  const insertAdjustment = db.prepare('INSERT INTO stock_adjustments(id, variant_id, adjusted_at, quantity_change, reason, data_json) VALUES (?, ?, ?, ?, ?, ?)');
  for (const adjustment of state.adjustments) {
    insertAdjustment.run(text(adjustment.id), text(adjustment.variantId), text(adjustment.timestamp), number(adjustment.changeQty), text(adjustment.reason), json(adjustment));
  }
}

function saveSnapshot(state: PosState, expectedRevision: number) {
  if (!validateState(state)) return { ok: false as const, status: 400, error: 'POS data is missing required collections.' };
  const safeState = cleanState(state);
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = currentSnapshot();
    if (existing.revision !== expectedRevision) {
      db.exec('ROLLBACK');
      return { ok: false as const, status: 409, revision: existing.revision };
    }
    const revision = existing.revision + 1;
    const updatedAt = new Date().toISOString();
    replaceRelationalRows(safeState);
    db.prepare(`INSERT INTO pos_state(id, revision, payload, updated_at) VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, payload = excluded.payload, updated_at = excluded.updated_at`)
      .run(revision, json(safeState), updatedAt);
    db.exec('COMMIT');
    return { ok: true as const, revision, updatedAt };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function freshStoreState(): PosState {
  return {
    settings: {
      storeName: 'Your POS',
      legalBusinessName: '',
      registrationType: 'unregistered',
      businessSetupComplete: false,
      tagline: '',
      address: '',
      phone: '',
      taxId: '',
      stateCode: '',
      stateName: '',
      taxRateDefault: 5,
      priceMode: 'exclusive',
      currencySymbol: '₹',
      receiptFooterNote: 'Thank you for shopping with us!',
      lowStockThresholdDefault: 4,
      soundEnabled: true,
      scannerInterCharDelayMs: 45,
    },
    users: [],
    products: [],
    transactions: [],
    returns: [],
    shifts: [],
    expenses: [],
    adjustments: [],
    customers: [],
  };
}

function initializeFirstAdmin(name: string, username: string, pin: string) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const snapshot = currentSnapshot();
    if (snapshot.state?.users.length) {
      db.exec('ROLLBACK');
      return { ok: false as const, status: 409, error: 'This POS already has staff accounts. Sign in with an existing admin account.' };
    }

    const state = snapshot.state || freshStoreState();
    const admin = {
      id: `usr-${randomBytes(12).toString('hex')}`,
      name,
      username,
      pin: '',
      role: 'admin',
      active: true,
    };
    state.users = [admin];
    state.activeUser = admin;

    const revision = snapshot.revision + 1;
    const updatedAt = new Date().toISOString();
    replaceRelationalRows(cleanState(state));
    db.prepare(`INSERT INTO pos_state(id, revision, payload, updated_at) VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, payload = excluded.payload, updated_at = excluded.updated_at`)
      .run(revision, json(cleanState(state)), updatedAt);
    setPinHash(admin.id, pin);
    db.exec('COMMIT');
    return { ok: true as const, userId: admin.id };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

migrateLegacyPins();

function migrateStaffOffersAndExpenseEntry() {
  const snapshot = currentSnapshot();
  if (!snapshot.state) return;
  let changed = false;
  const grant = (user: Record<string, any>) => {
    if (user.role === 'admin') return user;
    const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : DEFAULT_ROLE_PERMISSIONS[user.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
    const staffGrants = ['expenses.add', 'offers.view', 'vouchers.view'];
    if (user.role === 'inventory_manager') staffGrants.push('offers.manage', 'vouchers.manage');
    const next = [...new Set([...permissions, ...staffGrants])];
    if (next.length !== permissions.length) changed = true;
    return { ...user, permissions: next };
  };
  const next = { ...snapshot.state, users: snapshot.state.users.map(grant) };
  if (snapshot.state.activeUser) next.activeUser = grant(snapshot.state.activeUser);
  if (!changed) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const latest = currentSnapshot();
    if (latest.revision !== snapshot.revision || !latest.state) { db.exec('ROLLBACK'); return; }
    const revision = latest.revision + 1;
    const updatedAt = new Date().toISOString();
    const safe = cleanState(next);
    replaceRelationalRows(safe);
    db.prepare('UPDATE pos_state SET revision=?, payload=?, updated_at=? WHERE id=1').run(revision, json(safe), updatedAt);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

migrateStaffOffersAndExpenseEntry();

export function databasePath() { return dbPath; }

type RequestSession = { user: Record<string, any>; tokenHash: string };
const failedLogins = new Map<string, { failures: number; blockedUntil: number }>();
const SESSION_HOURS = 12;

function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function requestSession(req: any): RequestSession | null {
  const cookie = String(req.headers?.cookie || '').split(';').map((value: string) => value.trim())
    .find((value: string) => value.startsWith('fnd_pos_session='));
  if (!cookie) return null;
  const token = decodeURIComponent(cookie.slice('fnd_pos_session='.length));
  const tokenHash = sha256(token);
  const row = db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token_hash = ?').get(tokenHash) as
    { user_id: string; expires_at: string } | undefined;
  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    if (row) db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  const state = currentSnapshot().state;
  const user = state?.users.find((candidate) => candidate.id === row.user_id && candidate.active !== false);
  if (!user) {
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return { user: cleanUser(user), tokenHash };
}

function establishSession(userId: string, res: any, oldSession?: RequestSession | null) {
  if (oldSession) db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(oldSession.tokenHash);
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  db.prepare('INSERT INTO user_sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash, userId, expires.toISOString(), now.toISOString());
  res.setHeader('Set-Cookie', `fnd_pos_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 60 * 60}`);
  return cleanUser(currentSnapshot().state!.users.find((user) => user.id === userId)!);
}

function authenticate(username: string, pin: string) {
  const snapshot = currentSnapshot();
  const user = snapshot.state?.users.find((candidate) => candidate.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || user.active === false || !/^\d{4}$/.test(pin) || !pinMatches(user.id, pin)) return null;
  return user;
}

function safeStateForUser(state: PosState, user: Record<string, any>): PosState {
  const safe = JSON.parse(JSON.stringify(cleanState(state))) as PosState;
  safe.activeUser = cleanUser(user);
  if (!userHasPermission(user, 'users.manage')) safe.users = [cleanUser(user)];
  if (!userHasPermission(user, 'expenses.manage') && !userHasPermission(user, 'expenses.add')) safe.expenses = [];
  if (!userHasPermission(user, 'inventory.adjust')) safe.adjustments = [];
  if (!userHasPermission(user, 'customers.manage')) safe.customers = [];
  if (!userHasPermission(user, 'offers.view')) safe.offers = [];
  if (!userHasPermission(user, 'pos.use')) safe.heldBills = [];
  if (!userHasPermission(user, 'reports.view')) {
    for (const product of safe.products) {
      for (const variant of product.variants || []) variant.costPrice = 0;
    }
    for (const sale of safe.transactions) {
      for (const item of sale.items || []) item.unitCost = 0;
    }
  }
  if (!userHasPermission(user, 'shifts.manage')) safe.shifts = safe.shifts.filter((shift) => shift.cashierId === user.id);
  return safe;
}

function equalJson(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }

function expectedStockChanges(previous: PosState, next: PosState) {
  const expected = new Map<string, number>();
  const add = (id: unknown, delta: number) => expected.set(text(id), (expected.get(text(id)) || 0) + delta);
  const oldSales = new Map(previous.transactions.map((sale) => [sale.id, sale]));
  for (const sale of next.transactions) {
    const old = oldSales.get(sale.id);
    if (!old && sale.status !== 'voided') {
      for (const item of sale.items || []) add(item.variantId, -number(item.quantity));
    } else if (old && old.status !== 'voided' && sale.status === 'voided') {
      for (const item of sale.items || []) add(item.variantId, number(item.quantity));
    }
  }
  const returnIds = new Set(previous.returns.map((item) => item.id));
  for (const returned of next.returns) {
    if (returnIds.has(returned.id)) continue;
    for (const item of returned.returnedItems || []) {
      if (item.restocked || item.condition === 'resalable') add(item.variantId, number(item.quantity));
    }
  }
  return expected;
}

function productWithoutStock(products: PosState['products']) {
  return products.map((product) => ({
    ...product,
    variants: (product.variants || []).map((variant: Record<string, any>) => {
      const { stock: _stock, ...other } = variant;
      return other;
    }),
  }));
}

function stockChangesMatchExpected(previous: PosState, next: PosState) {
  const oldStock = new Map<string, number>();
  const newStock = new Map<string, number>();
  for (const product of previous.products) for (const variant of product.variants || []) oldStock.set(variant.id, number(variant.stock));
  for (const product of next.products) for (const variant of product.variants || []) newStock.set(variant.id, number(variant.stock));
  const expected = expectedStockChanges(previous, next);
  const ids = new Set([...oldStock.keys(), ...newStock.keys()]);
  for (const id of ids) {
    const actual = (newStock.get(id) || 0) - (oldStock.get(id) || 0);
    if (actual !== (expected.get(id) || 0)) return false;
  }
  return true;
}

function authorizeAndNormalizeSnapshot(previous: PosState, incoming: PosState, actor: Record<string, any>) {
  const next = JSON.parse(JSON.stringify(cleanState(incoming))) as PosState;
  if (!userHasPermission(actor, 'users.manage')) next.users = previous.users;
  if (!userHasPermission(actor, 'expenses.manage')) {
    if (!userHasPermission(actor, 'expenses.add')) next.expenses = previous.expenses;
    else {
      const previousIds = new Set(previous.expenses.map((entry) => text(entry.id)));
      const additions = next.expenses.filter((entry) => !previousIds.has(text(entry.id)));
      next.expenses = [...additions, ...previous.expenses];
    }
  }
  if (!userHasPermission(actor, 'inventory.adjust')) next.adjustments = previous.adjustments;
  if (!userHasPermission(actor, 'customers.manage')) next.customers = previous.customers || [];
  if (!userHasPermission(actor, 'offers.manage')) next.offers = previous.offers;
  if (!userHasPermission(actor, 'pos.use')) next.heldBills = previous.heldBills;
  if (!userHasPermission(actor, 'reports.view')) {
    const oldCosts = new Map<string, number>();
    for (const product of previous.products) for (const variant of product.variants || []) oldCosts.set(variant.id, number(variant.costPrice));
    for (const product of next.products) for (const variant of product.variants || []) {
      if (oldCosts.has(variant.id)) variant.costPrice = oldCosts.get(variant.id)!;
    }
    const oldItemCosts = new Map<string, number>();
    for (const sale of previous.transactions) for (const [index, item] of (sale.items || []).entries()) oldItemCosts.set(`${sale.id}:${index}`, number(item.unitCost));
    for (const sale of next.transactions) for (const [index, item] of (sale.items || []).entries()) {
      const prior = oldItemCosts.get(`${sale.id}:${index}`);
      if (prior !== undefined) item.unitCost = prior;
      else {
        const variant = next.products.flatMap((product) => product.variants || []).find((candidate: any) => candidate.id === item.variantId);
        item.unitCost = number(variant?.costPrice);
      }
    }
  }
  const actorRecord = next.users.find((user) => user.id === actor.id) || actor;
  next.activeUser = cleanUser(actorRecord);
  return next;
}

function validateSnapshotPermissions(previous: PosState, incoming: PosState, next: PosState, actor: Record<string, any>) {
  const deny = (message: string) => ({ ok: false as const, status: 403, error: message });
  const barcodeOwners = new Map<string, { product: string; size: string; color: string }>();
  for (const product of next.products) for (const variant of product.variants || []) {
    const barcode = text(variant.barcode).trim();
    if (!barcode) continue;
    const key = barcode.toUpperCase();
    if (barcodeOwners.has(key)) {
      const owner = barcodeOwners.get(key)!;
      return { ok: false as const, status: 400, error: `Barcode “${barcode}” is already assigned to another variant (${owner.product}, ${owner.color} / ${owner.size}). Every size and color variant must have its own barcode.` };
    }
    barcodeOwners.set(key, { product: text(product.name), size: text(variant.size), color: text(variant.color) });
  }
  if (!equalJson(previous.settings, next.settings) && !userHasPermission(actor, 'settings.manage')) return deny('You do not have permission to change store settings.');
  const registrationType = next.settings.registrationType;
  if (!['unregistered', 'regular', 'composition'].includes(String(registrationType))) return deny('Choose a valid business GST registration type.');
  if (next.settings.priceMode !== undefined && !['exclusive', 'inclusive'].includes(String(next.settings.priceMode))) return deny('Choose whether garment prices include GST or have GST added at checkout.');
  if (next.settings.businessSetupComplete) {
    if (text(next.settings.storeName).trim().length < 2 || text(next.settings.address).trim().length < 5 || !/^\d{2}$/.test(text(next.settings.stateCode))) {
      return deny('Complete the shop name, full address, and business state before using the POS.');
    }
    if (registrationType === 'unregistered' && text(next.settings.taxId).trim()) return deny('An unregistered business cannot save or show a GSTIN.');
    if (registrationType !== 'unregistered' && (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(text(next.settings.taxId).trim().toUpperCase()) || text(next.settings.taxId).slice(0, 2) !== text(next.settings.stateCode))) {
      return deny('Enter a valid GSTIN that matches the selected business state.');
    }
    if (registrationType !== 'unregistered' && text(next.settings.legalBusinessName).trim().length < 2) return deny('Enter the legal business name shown on the GST certificate.');
  }
  if (!equalJson(previous.users, next.users) && !userHasPermission(actor, 'users.manage')) return deny('You do not have permission to manage staff accounts.');
  if (!equalJson(previous.expenses, next.expenses) && !userHasPermission(actor, 'expenses.manage')) {
    if (!userHasPermission(actor, 'expenses.add') || next.expenses.length < previous.expenses.length) return deny('You do not have permission to manage expenses.');
    for (const expense of previous.expenses) {
      const retained = next.expenses.find((entry) => entry.id === expense.id);
      if (!retained || !equalJson(expense, retained)) return deny('Staff can add expenses but cannot edit or delete existing entries.');
    }
    for (const expense of next.expenses.filter((entry) => !previous.expenses.some((old) => old.id === entry.id))) {
      if (text(expense.recordedBy) !== text(actor.name) || !text(expense.description).trim() || number(expense.amount) <= 0) return deny('A staff expense needs a description, positive amount, and the signed-in staff member as recorder.');
    }
  }
  if (!equalJson(previous.adjustments, next.adjustments) && !userHasPermission(actor, 'inventory.adjust')) return deny('You do not have permission to change stock audit records.');
  if (!equalJson(previous.customers || [], next.customers || []) && !userHasPermission(actor, 'customers.manage')) return deny('You do not have permission to manage customer records.');
  const customerIds = new Set<string>();
  for (const customer of next.customers || []) {
    const id = text(customer.id).trim();
    const name = text(customer.name).trim();
    const phone = text(customer.phone).trim();
    const gstin = text(customer.gstin).trim().toUpperCase();
    const address = text(customer.address).trim();
    const stateCode = text(customer.stateCode).trim();
    const notes = text(customer.notes).trim();
    if (!id || customerIds.has(id) || ![name, phone, gstin, address, stateCode, notes].some(Boolean)
      || name.length > 100 || phone.length > 20 || address.length > 240 || notes.length > 300
      || (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))
      || (stateCode && !/^\d{2}$/.test(stateCode))) {
      return { ok: false as const, status: 400, error: 'Check the customer details. Name and mobile are optional, but a saved profile needs at least one detail and any GSTIN/state code must be valid.' };
    }
    customerIds.add(id);
  }
  if (!equalJson(previous.heldBills || [], next.heldBills || []) && !userHasPermission(actor, 'pos.use')) return deny('You do not have permission to hold or resume bills.');
  const heldBillIds = new Set<string>();
  for (const bill of next.heldBills || []) {
    if (!text(bill.id).trim() || heldBillIds.has(text(bill.id)) || !text(bill.heldAt).trim() || !text(bill.heldBy).trim()
      || !Array.isArray(bill.cart) || !bill.cart.length || !bill.cart.every((item: Record<string, any>) => text(item.variantId).trim() && Number.isInteger(item.quantity) && number(item.quantity) > 0)
      || !bill.cartOrderDiscount || !['percentage', 'fixed'].includes(text(bill.cartOrderDiscount.type)) || number(bill.cartOrderDiscount.value) < 0
      || !bill.customerDetails || typeof bill.customerDetails !== 'object') {
      return { ok: false as const, status: 400, error: 'A held bill must have an ID, staff member, at least one valid item, and saved checkout details.' };
    }
    heldBillIds.add(text(bill.id));
  }
  if (!equalJson(previous.offers || [], next.offers || []) && !userHasPermission(actor, 'offers.manage')) return deny('You do not have permission to manage offers.');
  for (const offer of next.offers || []) {
    const isDiscount = offer.type === 'discount';
    const isPartnerReward = offer.type === 'spend_reward';
    const isBuyGetFree = !isDiscount && !isPartnerReward;
    const storeWide = offer.scope === 'store';
    const categoryScoped = offer.scope === 'categories';
    const offerCategories = Array.isArray(offer.categories) ? offer.categories.map((category: unknown) => text(category)) : [];
    const existingCategories = new Set(next.products.map((product) => text(product.category)));
    if (!text(offer.name).trim() || !Array.isArray(offer.productIds) || (!isPartnerReward && !storeWide && !categoryScoped && !offer.productIds.length)
      || (offer.scope !== undefined && offer.scope !== 'store' && offer.scope !== 'products' && offer.scope !== 'categories')
      || (categoryScoped && (!offerCategories.length || offerCategories.some((category: string) => !existingCategories.has(category)) || offer.productIds.length > 0))
      || (!categoryScoped && offerCategories.length > 0)
      || (isPartnerReward && (offer.scope !== 'store' || offer.productIds.length !== 0
        || !(number(offer.minimumPurchase) > 0) || !text(offer.rewardItemName).trim() || !text(offer.rewardPartnerName).trim()
        || text(offer.rewardInstructions).length > 160))
      || (isBuyGetFree && (!Number.isInteger(offer.buyQuantity) || number(offer.buyQuantity) < 1 || !Number.isInteger(offer.freeQuantity) || number(offer.freeQuantity) < 1))
      || (isDiscount && (!(number(offer.discountValue) > 0) || (offer.discountType !== 'percentage' && offer.discountType !== 'fixed') || (offer.discountType === 'percentage' && number(offer.discountValue) > 100)))
      || !/^\d{4}-\d{2}-\d{2}$/.test(text(offer.startsOn)) || !/^\d{4}-\d{2}-\d{2}$/.test(text(offer.endsOn))
      || text(offer.endsOn) < text(offer.startsOn) || typeof offer.active !== 'boolean'
      || offer.productIds.some((productId: unknown) => !next.products.some((product) => product.id === productId))) {
      return { ok: false as const, status: 400, error: 'An offer needs a name, valid garment selection, valid promotion values, and a valid date range.' };
    }
  }

  const oldSales = new Map(previous.transactions.map((sale) => [sale.id, sale]));
  const newSales = new Map(next.transactions.map((sale) => [sale.id, sale]));
  if (newSales.size < oldSales.size) return deny('Sales records cannot be removed.');
  for (const sale of next.transactions) {
    const old = oldSales.get(sale.id);
    if (!old) {
      if (!userHasPermission(actor, 'pos.use')) return deny('You do not have permission to create sales.');
      if (sale.cashierId !== actor.id) return deny('A sale must be recorded under the signed-in cashier.');
      if (!['exclusive', 'inclusive'].includes(String(sale.priceMode || 'exclusive')) || (sale.priceMode || 'exclusive') !== (next.settings.priceMode || 'exclusive')) return deny('The sale price mode changed while this checkout was open. Refresh and review the bill before taking payment.');
      if (!next.settings.businessSetupComplete) return deny('Complete the business registration setup before recording sales.');
      const invoiceType = next.settings.registrationType;
      if (invoiceType === 'regular' && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(text(next.settings.taxId).trim().toUpperCase())) {
        return deny('A valid shop GSTIN is required for a regular GST tax invoice.');
      }
      if (invoiceType !== 'regular' && (number(sale.taxTotal) !== 0 || (sale.items || []).some((item: Record<string, any>) => number(item.taxAmount) !== 0))) {
        return deny('This business mode cannot add GST to a customer sale.');
      }
      if (invoiceType === 'composition') {
        const placeOfSupply = text(sale.placeOfSupplyStateCode || sale.customerGstin?.slice(0, 2) || next.settings.stateCode);
        if (placeOfSupply !== text(next.settings.stateCode)) return deny('Composition mode cannot record an interstate garment sale.');
      }
      if ((sale.payments || []).some((payment: Record<string, any>) =>
        ['card', 'upi'].includes(String(payment.method)) && number(payment.amount) > 0 && !text(payment.reference).trim())) {
        return { ok: false as const, status: 400, error: 'A payment reference is required for every card/POS or UPI/QR payment.' };
      }
      continue;
    }
    if (!equalJson(old, sale)) {
      const isVoid = old.status === 'completed' && sale.status === 'voided';
      const isReturnStatus = ['completed', 'partially_refunded'].includes(old.status) &&
        ['partially_refunded', 'refunded'].includes(sale.status) && old.status !== sale.status;
      if (isVoid && !userHasPermission(actor, 'transactions.void')) return deny('You do not have permission to void sales.');
      if (isVoid && previous.returns.some((returned) => returned.originalSaleId === old.id)) {
        return { ok: false as const, status: 400, error: 'A sale with a recorded return cannot be voided. Process any remaining items as a return instead.' };
      }
      if (isReturnStatus && !userHasPermission(actor, 'returns.process')) return deny('You do not have permission to process returns.');
      if ((!isVoid && !isReturnStatus) || (isVoid && sale.cashierId !== old.cashierId)) return deny('Existing sale details cannot be edited.');
    }
  }
  if (next.returns.length < previous.returns.length) return deny('Return records cannot be removed.');
  for (const oldReturn of previous.returns) {
    const retained = next.returns.find((item) => item.id === oldReturn.id);
    if (!retained || !equalJson(oldReturn, retained)) return deny('Existing return records cannot be edited or removed.');
  }
  if (!equalJson(previous.returns, next.returns) && !userHasPermission(actor, 'returns.process')) return deny('You do not have permission to process returns.');
  const returnTotals = new Map<string, Map<string, number>>();
  for (const returned of next.returns) {
    if (previous.returns.some((old) => old.id === returned.id)) continue;
    if (returned.cashierId !== actor.id) return deny('A return must be recorded under the signed-in cashier.');
    if (!returned.returnedItems?.length || !text(returned.reason).trim() || !['cash', 'card', 'upi', 'store_credit'].includes(text(returned.refundMethod))) {
      return { ok: false as const, status: 400, error: 'A return needs at least one item, a reason, and a valid refund method.' };
    }
    const original = next.transactions.find((sale) => sale.id === returned.originalSaleId);
    if (!original || original.status === 'voided') return { ok: false as const, status: 400, error: 'Returns must refer to a valid, non-voided sale.' };
    const totals = returnTotals.get(original.id) || new Map<string, number>();
    let computedRefund = 0;
    for (const item of returned.returnedItems || []) {
      const sold = original.items.find((saleItem: Record<string, any>) => saleItem.variantId === item.variantId);
      const quantity = number(item.quantity);
      const already = previous.returns.filter((prior) => prior.originalSaleId === original.id)
        .flatMap((prior) => prior.returnedItems || [])
        .filter((prior) => prior.variantId === item.variantId)
        .reduce((sum, prior) => sum + number(prior.quantity), 0) + (totals.get(item.variantId) || 0);
      if (!sold || !Number.isInteger(quantity) || quantity < 1 || already + quantity > number(sold.quantity)) {
        return { ok: false as const, status: 400, error: 'Returned quantity exceeds the quantity sold and still available to return.' };
      }
      if (!['resalable', 'damaged', 'defective'].includes(text(item.condition)) || Boolean(item.restocked) !== (item.condition === 'resalable')) {
        return { ok: false as const, status: 400, error: 'Choose a valid return condition and matching restock option.' };
      }
      const expectedRefund = Number((((number(sold.lineTotal) + number(sold.taxAmount)) / Math.max(1, number(sold.quantity))) * quantity).toFixed(2));
      if (Math.abs(expectedRefund - number(item.refundAmount)) > 0.01) return { ok: false as const, status: 400, error: 'Return refund does not match the original item price and tax.' };
      totals.set(item.variantId, already + quantity);
      computedRefund += expectedRefund;
    }
    if (Math.abs(Number(computedRefund.toFixed(2)) - number(returned.totalRefundAmount)) > 0.01) return { ok: false as const, status: 400, error: 'Return total does not match its item refunds.' };
    returnTotals.set(original.id, totals);
  }
  for (const [saleId, totals] of returnTotals) {
    const sale = next.transactions.find((item) => item.id === saleId)!;
    const fullyReturned = sale.items.every((item: Record<string, any>) => (totals.get(item.variantId) || 0) >= number(item.quantity));
    if ((fullyReturned && sale.status !== 'refunded') || (!fullyReturned && sale.status !== 'partially_refunded')) {
      return { ok: false as const, status: 400, error: 'Sale status must match the quantities returned.' };
    }
  }
  for (const sale of next.transactions) {
    if (!['partially_refunded', 'refunded'].includes(sale.status)) continue;
    const priorSale = previous.transactions.find((item) => item.id === sale.id);
    const hasNewReturn = next.returns.some((item) => item.originalSaleId === sale.id && !previous.returns.some((prior) => prior.id === item.id));
    if (!hasNewReturn && priorSale?.status === sale.status) continue;
    const counts = new Map<string, number>();
    for (const returned of next.returns.filter((item) => item.originalSaleId === sale.id)) {
      for (const item of returned.returnedItems || []) counts.set(item.variantId, (counts.get(item.variantId) || 0) + number(item.quantity));
    }
    const fullyReturned = sale.items.every((item: Record<string, any>) => (counts.get(item.variantId) || 0) >= number(item.quantity));
    if ((sale.status === 'refunded') !== fullyReturned) return { ok: false as const, status: 400, error: 'Sale status must match the quantities returned.' };
  }
  if (!equalJson(previous.shifts, next.shifts) && !userHasPermission(actor, 'shifts.manage')) return deny('You do not have permission to manage register shifts.');
  for (const shift of next.shifts) {
    if (!previous.shifts.some((old) => old.id === shift.id) && shift.cashierId !== actor.id) return deny('A new shift must belong to the signed-in staff member.');
  }

  if (!equalJson(productWithoutStock(previous.products), productWithoutStock(next.products)) && !userHasPermission(actor, 'products.manage')) {
    return deny('You do not have permission to add products or change product details and prices.');
  }
  if (!equalJson(previous.products.map((product) => product.variants.map((variant: Record<string, any>) => [variant.id, variant.stock])), next.products.map((product) => product.variants.map((variant: Record<string, any>) => [variant.id, variant.stock]))) &&
      !userHasPermission(actor, 'inventory.adjust') && !stockChangesMatchExpected(previous, next)) {
    return deny('Stock changes must come from a sale or resalable return. You do not have stock-adjustment permission.');
  }
  if (next.users.filter((user) => user.active && user.role === 'admin').length === 0) return deny('Keep at least one active admin account.');
  if (!next.users.some((user) => user.id === actor.id && user.active)) return deny('You cannot deactivate or remove the account currently signed in.');
  for (const user of next.users) if (user.pin) return deny('PINs must be set through the protected credential service.');
  return { ok: true as const };
}

function parseBody(req: any, callback: (body: any) => void, res: any) {
  if (req.body && typeof req.body === 'object') return callback(req.body);
  const chunks: Buffer[] = [];
  let length = 0;
  req.on('data', (chunk: Buffer) => {
    length += chunk.length;
    if (length > 12 * 1024 * 1024) {
      sendJson(res, 413, { error: 'Request is too large.' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try { callback(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { sendJson(res, 400, { error: 'Invalid JSON request.' }); }
  });
}

export function databaseApi(req: any, res: any, next: () => void) {
  const route = String(req.url || '').split('?')[0];
  const method = String(req.method || 'GET').toUpperCase();
  if (route === '/health' && method === 'GET') return sendJson(res, 200, { ok: true, database: 'connected' });
  if (!route.startsWith('/auth/') && route !== '/state' && route !== '/admin/clear-data') return next();

  if (route === '/auth/session' && method === 'GET') {
    const session = requestSession(req);
    return session ? sendJson(res, 200, { user: session.user }) : sendJson(res, 401, { authenticated: false });
  }

  if (route === '/auth/setup-status' && method === 'GET') {
    const state = currentSnapshot().state;
    return sendJson(res, 200, { setupRequired: !state || state.users.length === 0 });
  }

  if (route === '/auth/setup' && method === 'POST') {
    return parseBody(req, (body) => {
      const name = String(body?.name || '').trim();
      const username = String(body?.username || '').trim().toLowerCase();
      const pin = String(body?.pin || '');
      if (name.length < 2 || name.length > 80) return sendJson(res, 400, { error: 'Enter the admin name (2–80 characters).' });
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) return sendJson(res, 400, { error: 'Username must be 3–32 characters using letters, numbers, dot, dash, or underscore.' });
      if (!/^\d{4}$/.test(pin)) return sendJson(res, 400, { error: 'Choose a 4-digit PIN.' });
      const initialized = initializeFirstAdmin(name, username, pin);
      if (!initialized.ok) return sendJson(res, initialized.status, { error: initialized.error });
      const user = currentSnapshot().state!.users.find((candidate) => candidate.id === initialized.userId)!;
      const safeUser = establishSession(user.id, res);
      return sendJson(res, 201, { user: safeUser });
    }, res);
  }

  if ((route === '/auth/login' || route === '/auth/switch') && method === 'POST') {
    const existing = requestSession(req);
    if (route === '/auth/switch' && !existing) return sendJson(res, 401, { error: 'Sign in before switching staff.' });
    return parseBody(req, (body) => {
      const username = String(body?.username || '').trim().toLowerCase();
      const pin = String(body?.pin || '');
      const client = String(req.socket?.remoteAddress || 'local');
      const key = `${client}:${username}`;
      const rate = failedLogins.get(key);
      if (rate && rate.blockedUntil > Date.now()) return sendJson(res, 429, { error: 'Too many incorrect PIN attempts. Wait 15 minutes and try again.' });
      const user = route === '/auth/switch'
        ? currentSnapshot().state?.users.find((candidate) => candidate.active !== false && /^\d{4}$/.test(pin) && pinMatches(candidate.id, pin))
        : authenticate(username, pin);
      if (!user) {
        const failures = rate && rate.blockedUntil <= Date.now() ? rate.failures + 1 : (rate?.failures || 0) + 1;
        failedLogins.set(key, { failures: failures >= 5 ? 0 : failures, blockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
        return sendJson(res, 401, { error: 'Username or PIN is incorrect, or this account is inactive.' });
      }
      failedLogins.delete(key);
      const safeUser = establishSession(user.id, res, existing);
      return sendJson(res, 200, { user: safeUser });
    }, res);
  }

  const session = requestSession(req);
  if (!session) return sendJson(res, 401, { error: 'Sign in to continue.' });

  if (route === '/admin/clear-data' && method === 'POST') {
    if (session.user.role !== 'admin' || !userHasPermission(session.user, 'settings.manage')) {
      return sendJson(res, 403, { error: 'Only a signed-in administrator can clear POS data.' });
    }
    return parseBody(req, (body) => {
      const pin = String(body?.pin || '');
      if (!/^\d{4}$/.test(pin)) return sendJson(res, 400, { error: 'Enter the administrator’s 4-digit PIN.' });
      const rateKey = `clear-data:${String(req.socket?.remoteAddress || 'local')}:${session.user.id}`;
      const rate = failedLogins.get(rateKey);
      if (rate && rate.blockedUntil > Date.now()) {
        return sendJson(res, 429, { error: 'Too many incorrect PIN attempts. Wait 15 minutes and try again.' });
      }
      if (!pinMatches(session.user.id, pin)) {
        const failures = rate && rate.blockedUntil <= Date.now() ? rate.failures + 1 : (rate?.failures || 0) + 1;
        failedLogins.set(rateKey, { failures: failures >= 5 ? 0 : failures, blockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
        return sendJson(res, 401, { error: 'Administrator PIN is incorrect.' });
      }
      failedLogins.delete(rateKey);

      const snapshot = currentSnapshot();
      if (!snapshot.state) return sendJson(res, 409, { error: 'POS database is not initialized.' });
      const clearedState: PosState = {
        ...snapshot.state,
        products: [],
        customers: [],
        transactions: [],
        returns: [],
        shifts: [],
        adjustments: [],
        expenses: [],
        vouchers: [],
        offers: [],
        heldBills: [],
        activeUser: cleanUser(session.user),
      };
      const result = saveSnapshot(clearedState, snapshot.revision);
      if (!result.ok) return sendJson(res, result.status, result);
      return sendJson(res, 200, { ok: true, revision: result.revision });
    }, res);
  }

  if (route === '/auth/logout' && method === 'POST') {
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(session.tokenHash);
    res.setHeader('Set-Cookie', 'fnd_pos_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  if (route === '/auth/credential' && method === 'POST') {
    if (!userHasPermission(session.user, 'users.manage')) return sendJson(res, 403, { error: 'Only staff administrators can manage PINs.' });
    return parseBody(req, (body) => {
      const userId = String(body?.userId || '');
      const pin = String(body?.pin || '');
      const action = String(body?.action || 'set');
      const current = currentSnapshot().state;
      if (!userId || (action === 'set' && !/^\d{4}$/.test(pin))) return sendJson(res, 400, { error: 'A staff account and a 4-digit PIN are required.' });
      if (action === 'set') {
        for (const user of current?.users || []) {
          if (user.id !== userId && pinMatches(user.id, pin)) return sendJson(res, 409, { error: 'That PIN is already assigned to another staff member.' });
        }
        setPinHash(userId, pin);
      } else if (action === 'delete') {
        db.prepare('DELETE FROM user_credentials WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
      } else return sendJson(res, 400, { error: 'Unknown credential action.' });
      return sendJson(res, 200, { ok: true });
    }, res);
  }

  if (route === '/state' && method === 'GET') {
    const snapshot = currentSnapshot();
    return sendJson(res, 200, { ...snapshot, state: snapshot.state ? safeStateForUser(snapshot.state, session.user) : null });
  }
  if (route !== '/state' || method !== 'PUT') return next();

  return parseBody(req, (body) => {
    const snapshot = currentSnapshot();
    if (snapshot.revision !== Number(body?.expectedRevision)) return sendJson(res, 409, { revision: snapshot.revision });
    if (!snapshot.state) return sendJson(res, 409, { error: 'POS database is not initialized. Contact an admin.' });
    if (!validateState(body?.state)) return sendJson(res, 400, { error: 'POS data is missing required collections.' });
    const nextState = authorizeAndNormalizeSnapshot(snapshot.state, body.state, session.user);
    const decision = validateSnapshotPermissions(snapshot.state, body.state, nextState, session.user);
    if (!decision.ok) return sendJson(res, decision.status, { error: decision.error });
    const result = saveSnapshot(nextState, snapshot.revision);
    if (result.ok) {
      const activeIds = nextState.users.filter((user) => user.active).map((user) => user.id);
      const placeholders = activeIds.map(() => '?').join(',') || "''";
      db.prepare(`DELETE FROM user_sessions WHERE user_id NOT IN (${placeholders})`).run(...activeIds);
    }
    return sendJson(res, result.status || 200, result);
  }, res);
}
