CREATE TABLE IF NOT EXISTS kyc_cases (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','EXTRACTING','CHECKING','MISSING_INFORMATION','ASSESSING_RISK','COMPLIANCE_REVIEW','ESCALATED','APPROVED','REJECTED','PROVISIONING','ACTIVE','PROVISIONING_FAILED')),
  version INTEGER NOT NULL CHECK (version > 0),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS applications (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS documents (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS evidence_items (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS reviewer_feedback (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES kyc_cases (tenant_id, id)
);

INSERT OR IGNORE INTO foundation_migrations (id, applied_at) VALUES ('001-domain-core', '2026-08-20T00:00:00.000Z');
