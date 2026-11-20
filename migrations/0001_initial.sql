CREATE TABLE accounts (
  id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
  source TEXT NOT NULL, requested INTEGER NOT NULL CHECK (requested BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  attempt TEXT, asset_count INTEGER NOT NULL DEFAULT 0 CHECK (asset_count >= 0 AND asset_count <= requested),
  result TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_account_created ON jobs(account_id, created_at DESC);
CREATE INDEX jobs_status_updated ON jobs(status, updated_at);
CREATE TABLE purchases (
  session_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
  credits INTEGER NOT NULL CHECK (credits > 0), created_at INTEGER NOT NULL
);
CREATE TRIGGER reserve_credits AFTER INSERT ON jobs
BEGIN
  UPDATE accounts SET balance = balance - (NEW.requested * 100) WHERE id = NEW.account_id;
END;
CREATE TRIGGER settle_credits AFTER UPDATE OF status ON jobs
WHEN OLD.status IN ('queued','running') AND NEW.status IN ('complete','failed')
BEGIN
  UPDATE accounts SET balance = balance + ((NEW.requested - NEW.asset_count) * 100) WHERE id = NEW.account_id;
END;
CREATE TRIGGER add_purchased_credits AFTER INSERT ON purchases
BEGIN
  UPDATE accounts SET balance = balance + NEW.credits WHERE id = NEW.account_id;
END;
