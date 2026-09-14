CREATE TABLE IF NOT EXISTS records (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  etag TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  expires_at INTEGER,
  PRIMARY KEY (namespace, key)
);
CREATE INDEX IF NOT EXISTS records_expiry ON records(expires_at) WHERE expires_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS chunks (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  etag TEXT NOT NULL,
  part INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (namespace, key, etag, part),
  FOREIGN KEY (namespace, key) REFERENCES records(namespace, key) ON DELETE CASCADE
);
