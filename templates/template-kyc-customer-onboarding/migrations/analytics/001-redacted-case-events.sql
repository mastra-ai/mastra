CREATE TABLE IF NOT EXISTS kyc_case_events (
  tenant_id VARCHAR NOT NULL,
  event_id VARCHAR NOT NULL,
  case_id VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  occurred_at VARCHAR NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_case_events_tenant_case
  ON kyc_case_events (tenant_id, case_id, occurred_at, event_id);

INSERT OR IGNORE INTO foundation_migrations
  VALUES ('001-redacted-case-events', TIMESTAMP '2026-08-21 00:00:00');
