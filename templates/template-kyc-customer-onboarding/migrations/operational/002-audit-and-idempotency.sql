CREATE TABLE IF NOT EXISTS case_events (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  case_version INTEGER NOT NULL CHECK (case_version > 0),
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, case_id, case_version),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED','COMPLETED')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (tenant_id, operation, key)
);

CREATE TABLE IF NOT EXISTS analytics_outbox (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  projected_at TEXT,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE TRIGGER IF NOT EXISTS case_events_no_update
BEFORE UPDATE ON case_events
BEGIN
  SELECT RAISE(ABORT, 'case events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS case_events_no_delete
BEFORE DELETE ON case_events
BEGIN
  SELECT RAISE(ABORT, 'case events are immutable');
END;

INSERT OR IGNORE INTO foundation_migrations (id, applied_at) VALUES ('002-audit-and-idempotency', '2026-08-20T00:00:00.000Z');
