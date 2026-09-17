CREATE TABLE IF NOT EXISTS webhook_receipts (
  tenant_id TEXT NOT NULL,
  endpoint TEXT NOT NULL CHECK (endpoint IN ('CUSTOMER_RESPONSE','COMPLIANCE_DECISION')),
  delivery_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  key_id TEXT NOT NULL,
  signed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING','COMPLETED')),
  lease_expires_at TEXT NOT NULL,
  outcome_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, endpoint, delivery_id),
  UNIQUE (tenant_id, endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS compliance_reviews_queue
ON compliance_reviews (tenant_id, status, created_at, id);

CREATE INDEX IF NOT EXISTS case_events_stream_cursor
ON case_events (tenant_id, case_id, case_version, occurred_at, id);

INSERT OR IGNORE INTO foundation_migrations (id, applied_at)
VALUES ('008-webhooks-and-review-queue', '2026-08-21T00:00:00.000Z');
