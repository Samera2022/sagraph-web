CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  payer_email TEXT,
  machine_code TEXT,
  activation_hash TEXT UNIQUE,
  term TEXT,
  expires_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  activated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_activation
  ON orders (activation_hash, machine_code);
