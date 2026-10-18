ALTER TABLE kyc_case_events ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR;
ALTER TABLE kyc_case_events ADD COLUMN IF NOT EXISTS policy_version VARCHAR;
ALTER TABLE kyc_case_events ADD COLUMN IF NOT EXISTS case_created_at VARCHAR;

CREATE TABLE IF NOT EXISTS kyc_provider_facts (
  tenant_id VARCHAR NOT NULL,
  event_id VARCHAR NOT NULL,
  case_id VARCHAR,
  provider_id VARCHAR NOT NULL,
  operation VARCHAR NOT NULL,
  outcome VARCHAR NOT NULL,
  latency_ms BIGINT,
  attempt_count INTEGER NOT NULL,
  retry_count INTEGER NOT NULL,
  input_units BIGINT,
  output_units BIGINT,
  cost_usd DOUBLE,
  price_version VARCHAR,
  occurred_at VARCHAR NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_provider_facts_tenant_time
  ON kyc_provider_facts (tenant_id, occurred_at, provider_id);

CREATE TABLE IF NOT EXISTS kyc_review_feedback_facts (
  tenant_id VARCHAR NOT NULL,
  event_id VARCHAR NOT NULL,
  case_id VARCHAR NOT NULL,
  review_id VARCHAR NOT NULL,
  extraction_useful BOOLEAN,
  screening_useful BOOLEAN,
  risk_useful BOOLEAN,
  evidence_useful BOOLEAN,
  structured_response_count INTEGER NOT NULL,
  false_positive_escalation BOOLEAN,
  curated_for_dataset BOOLEAN NOT NULL,
  turnaround_ms BIGINT NOT NULL,
  occurred_at VARCHAR NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_feedback_facts_tenant_time
  ON kyc_review_feedback_facts (tenant_id, occurred_at);

CREATE TABLE IF NOT EXISTS kyc_eval_facts (
  tenant_id VARCHAR NOT NULL,
  event_id VARCHAR NOT NULL,
  eval_id VARCHAR NOT NULL,
  candidate_id VARCHAR NOT NULL,
  dataset_version VARCHAR NOT NULL,
  manifest_digest VARCHAR NOT NULL,
  score DOUBLE NOT NULL,
  passed BOOLEAN NOT NULL,
  occurred_at VARCHAR NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_eval_facts_tenant_time
  ON kyc_eval_facts (tenant_id, occurred_at, eval_id, candidate_id);

INSERT OR IGNORE INTO foundation_migrations
  VALUES ('002-complete-metrics-facts', TIMESTAMP '2026-08-22 00:00:00');
