CREATE TABLE IF NOT EXISTS notifications (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  tenant_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, notification_id, channel_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, notification_id) REFERENCES notifications (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS provisioned_accounts (
  tenant_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, account_id),
  UNIQUE (tenant_id, case_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS provider_cost_records (
  tenant_id TEXT NOT NULL,
  usage_event_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, usage_event_id)
);

INSERT OR IGNORE INTO foundation_migrations (id, applied_at) VALUES ('003-local-effects', '2026-08-20T00:00:00.000Z');
