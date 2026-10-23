CREATE TABLE IF NOT EXISTS document_extractions (
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, document_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS studio_case_links (
  tenant_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','COMPLETED')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, thread_id, case_id),
  UNIQUE (tenant_id, workflow_run_id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_case_links_one_active_thread
ON studio_case_links (tenant_id, thread_id)
WHERE status = 'ACTIVE';

INSERT OR IGNORE INTO foundation_migrations (id, applied_at) VALUES ('004-intake-and-extraction', '2026-08-21T00:00:00.000Z');
