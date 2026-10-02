ALTER TABLE kyc_eval_facts ADD COLUMN IF NOT EXISTS source_revision VARCHAR;
ALTER TABLE kyc_eval_facts ADD COLUMN IF NOT EXISTS source_digest VARCHAR;

CREATE INDEX IF NOT EXISTS idx_kyc_eval_facts_source
  ON kyc_eval_facts (tenant_id, source_revision, manifest_digest, candidate_id);

INSERT OR IGNORE INTO foundation_migrations
  VALUES ('004-eval-source-provenance', TIMESTAMP '2026-08-22 00:00:00');
