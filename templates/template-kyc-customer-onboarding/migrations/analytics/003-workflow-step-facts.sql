CREATE TABLE IF NOT EXISTS kyc_workflow_step_facts (
  tenant_id VARCHAR NOT NULL,
  event_id VARCHAR NOT NULL,
  case_id VARCHAR,
  workflow_id VARCHAR NOT NULL,
  run_id VARCHAR NOT NULL,
  step_id VARCHAR NOT NULL,
  outcome VARCHAR NOT NULL,
  duration_ms BIGINT NOT NULL,
  occurred_at VARCHAR NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_workflow_step_facts_tenant_time
  ON kyc_workflow_step_facts (tenant_id, occurred_at, step_id);

INSERT OR IGNORE INTO foundation_migrations
  VALUES ('003-workflow-step-facts', TIMESTAMP '2026-08-22 00:00:00');
