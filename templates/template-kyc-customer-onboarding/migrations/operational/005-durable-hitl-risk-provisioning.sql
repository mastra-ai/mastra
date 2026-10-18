CREATE TABLE IF NOT EXISTS case_policy_snapshots (
  tenant_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_checksum TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, case_id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS information_requests (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  workflow_step_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','RESPONDED','EXPIRED','SUPERSEDED')),
  round INTEGER NOT NULL CHECK (round > 0),
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, case_id, round),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS information_requests_pending_thread
ON information_requests (tenant_id, thread_id, status, expires_at);

CREATE TABLE IF NOT EXISTS information_responses (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  response_fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, request_id),
  FOREIGN KEY (tenant_id, request_id) REFERENCES information_requests (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS risk_assessments (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_checksum TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  assessed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, case_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS risk_assessments_case_time
ON risk_assessments (tenant_id, case_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS compliance_reviews (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  workflow_step_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('INITIAL','SENIOR')),
  prior_review_id TEXT,
  required_role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DECIDED','EXPIRED')),
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, case_id, level, prior_review_id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id),
  FOREIGN KEY (tenant_id, prior_review_id) REFERENCES compliance_reviews (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS compliance_reviews_pending_thread
ON compliance_reviews (tenant_id, thread_id, status, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_reviews_one_initial_case
ON compliance_reviews (tenant_id, case_id)
WHERE level = 'INITIAL';

CREATE UNIQUE INDEX IF NOT EXISTS compliance_reviews_one_senior_parent
ON compliance_reviews (tenant_id, prior_review_id)
WHERE level = 'SENIOR';

CREATE TABLE IF NOT EXISTS review_decisions (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, review_id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id),
  FOREIGN KEY (tenant_id, review_id) REFERENCES compliance_reviews (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_resume_commands (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  workflow_step_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('MISSING_INFORMATION','COMPLIANCE_REVIEW')),
  target_id TEXT NOT NULL,
  authorized_actor_id TEXT NOT NULL,
  required_role TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','EXECUTING','COMPLETED','EXPIRED')),
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, action_type, target_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS workflow_resume_commands_pending_thread
ON workflow_resume_commands (tenant_id, thread_id, status, expires_at);

CREATE TABLE IF NOT EXISTS workflow_resume_attempts (
  id TEXT NOT NULL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  workflow_step_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_roles_json TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome = 'REJECTED'),
  reason_code TEXT NOT NULL CHECK (
    reason_code IN ('COMMAND_NOT_FOUND','BINDING_INVALID','COMMAND_EXPIRED','STATE_CONFLICT','UNEXPECTED_REJECTION')
  ),
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_resume_attempts_tenant_command_time
ON workflow_resume_attempts (tenant_id, command_id, attempted_at);

DROP INDEX IF EXISTS studio_case_links_one_active_thread;

CREATE INDEX IF NOT EXISTS studio_case_links_active_thread
ON studio_case_links (tenant_id, thread_id, status, updated_at);

CREATE TRIGGER IF NOT EXISTS case_policy_snapshots_no_update
BEFORE UPDATE ON case_policy_snapshots
BEGIN
  SELECT RAISE(ABORT, 'case policy snapshots are immutable');
END;

CREATE TRIGGER IF NOT EXISTS case_policy_snapshots_no_delete
BEFORE DELETE ON case_policy_snapshots
BEGIN
  SELECT RAISE(ABORT, 'case policy snapshots are immutable');
END;

CREATE TRIGGER IF NOT EXISTS information_responses_no_update
BEFORE UPDATE ON information_responses
BEGIN
  SELECT RAISE(ABORT, 'information responses are immutable');
END;

CREATE TRIGGER IF NOT EXISTS information_responses_no_delete
BEFORE DELETE ON information_responses
BEGIN
  SELECT RAISE(ABORT, 'information responses are immutable');
END;

CREATE TRIGGER IF NOT EXISTS review_decisions_no_update
BEFORE UPDATE ON review_decisions
BEGIN
  SELECT RAISE(ABORT, 'review decisions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS review_decisions_no_delete
BEFORE DELETE ON review_decisions
BEGIN
  SELECT RAISE(ABORT, 'review decisions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS workflow_resume_attempts_no_update
BEFORE UPDATE ON workflow_resume_attempts
BEGIN
  SELECT RAISE(ABORT, 'workflow resume attempts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS workflow_resume_attempts_no_delete
BEFORE DELETE ON workflow_resume_attempts
BEGIN
  SELECT RAISE(ABORT, 'workflow resume attempts are immutable');
END;

INSERT OR IGNORE INTO foundation_migrations (id, applied_at)
VALUES ('005-durable-hitl-risk-provisioning', '2026-08-21T00:00:00.000Z');
