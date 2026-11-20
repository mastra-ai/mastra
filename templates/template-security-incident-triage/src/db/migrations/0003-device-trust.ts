export const deviceTrustStatements = [
  `CREATE TABLE device_attestations (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    subject_id TEXT NOT NULL CHECK(length(trim(subject_id)) BETWEEN 1 AND 128),
    session_id TEXT NOT NULL CHECK(length(trim(session_id)) BETWEEN 1 AND 128),
    device_id TEXT NOT NULL CHECK(length(trim(device_id)) BETWEEN 1 AND 128),
    source TEXT NOT NULL CHECK(length(trim(source)) BETWEEN 1 AND 64),
    source_event_id TEXT NOT NULL CHECK(length(trim(source_event_id)) BETWEEN 1 AND 128),
    public_key_spki TEXT NOT NULL CHECK(length(public_key_spki) BETWEEN 1 AND 256),
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    signature TEXT NOT NULL CHECK(length(signature) BETWEEN 1 AND 256),
    issued_at TEXT NOT NULL CHECK(issued_at GLOB '????-??-??T??:??:??.???Z'),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    CHECK(expires_at > issued_at),
    UNIQUE(source, source_event_id),
    UNIQUE(tenant_id, subject_id, session_id, device_id)
  ) STRICT`,
  `CREATE TABLE device_authorization_audit (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    subject_id TEXT NOT NULL CHECK(length(trim(subject_id)) BETWEEN 1 AND 128),
    device_id TEXT NOT NULL CHECK(length(trim(device_id)) BETWEEN 1 AND 128),
    attestation_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('authorized','revoked')),
    decided_by TEXT NOT NULL CHECK(length(trim(decided_by)) BETWEEN 1 AND 128),
    decided_by_role TEXT NOT NULL CHECK(decided_by_role = 'soc_manager'),
    reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z'),
    FOREIGN KEY(attestation_id) REFERENCES device_attestations(id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE INDEX idx_device_attestations_incident_lookup
    ON device_attestations(tenant_id, subject_id, device_id, source, source_event_id)`,
  `CREATE INDEX idx_device_authorization_audit_device
    ON device_authorization_audit(tenant_id, subject_id, device_id, occurred_at DESC)`,
] as const;
