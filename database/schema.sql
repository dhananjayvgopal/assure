PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS pos_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  gstin TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  hsn_code TEXT NOT NULL DEFAULT '',
  tax_rate REAL NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON variants(barcode);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  sold_at TEXT NOT NULL,
  cashier_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sold_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL DEFAULT '',
  variant_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  hsn_code TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  taxable_value REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  original_sale_id TEXT NOT NULL,
  returned_at TEXT NOT NULL,
  refund_amount REAL NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS register_shifts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS operating_expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL DEFAULT '',
  adjusted_at TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
);

CREATE TABLE IF NOT EXISTS database_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id TEXT PRIMARY KEY,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);
INSERT OR IGNORE INTO database_meta(key, value) VALUES ('schema_version', '1');
