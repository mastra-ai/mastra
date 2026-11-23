/**
 * Complete operational schema for a fresh installation.
 *
 * Future database changes belong in a new numbered migration; this baseline
 * remains immutable once the first template release is published.
 */
export const initialSchemaStatements = [
  `CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_event_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('unauthorized_privilege_change','disallowed_country_login','unknown_device_login')),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z'),
    subject_id TEXT NOT NULL,
    canonical_json TEXT NOT NULL CHECK(json_valid(canonical_json)),
    raw_payload_ref TEXT NOT NULL,
    schema_version INTEGER NOT NULL CHECK(schema_version > 0),
    idempotency_key TEXT NOT NULL,
    UNIQUE(source, source_event_id),
    UNIQUE(tenant_id, idempotency_key),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE approval_decision_audit (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    claimed_tenant_id TEXT,
    claimed_incident_id TEXT NOT NULL CHECK(length(trim(claimed_incident_id)) BETWEEN 1 AND 128),
    claimed_approval_id TEXT NOT NULL CHECK(length(trim(claimed_approval_id)) BETWEEN 1 AND 128),
    outcome TEXT NOT NULL CHECK(outcome IN ('invalid','blocked','expired','replayed')),
    reason_code TEXT NOT NULL CHECK(length(trim(reason_code)) BETWEEN 1 AND 64),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z')
  ) STRICT`,
  `CREATE TABLE approval_resume_tokens (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    workflow_run_id TEXT NOT NULL,
    approval_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
    decision_fingerprint TEXT NOT NULL CHECK(length(decision_fingerprint) = 64 AND decision_fingerprint NOT GLOB '*[^0-9a-f]*'),
    digest_version INTEGER NOT NULL CHECK(digest_version = 1),
    token_digest TEXT NOT NULL UNIQUE CHECK(length(token_digest) = 64 AND token_digest NOT GLOB '*[^0-9a-f]*'),
    issued_at TEXT NOT NULL CHECK(issued_at GLOB '????-??-??T??:??:??.???Z'),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    consumed_at TEXT CHECK(consumed_at IS NULL OR consumed_at GLOB '????-??-??T??:??:??.???Z'),
    resumed_at TEXT CHECK(resumed_at IS NULL OR resumed_at GLOB '????-??-??T??:??:??.???Z'),
    CHECK(expires_at > issued_at),
    CHECK(consumed_at IS NULL OR consumed_at >= issued_at),
    CHECK(resumed_at IS NULL OR (consumed_at IS NOT NULL AND resumed_at >= consumed_at)),
    UNIQUE(tenant_id, incident_id, workflow_run_id, approval_id, decision),
    FOREIGN KEY(tenant_id, incident_id, workflow_run_id, approval_id, decision,
      decision_fingerprint, expires_at)
      REFERENCES approvals(tenant_id, incident_id, workflow_run_id, id, decision,
        decision_fingerprint, expires_at) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE approvals (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL UNIQUE,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    plan_hash_version INTEGER NOT NULL CHECK(plan_hash_version > 0),
    plan_hash TEXT NOT NULL CHECK(length(plan_hash) = 64 AND plan_hash NOT GLOB '*[^0-9a-f]*'),
    requested_at TEXT NOT NULL CHECK(requested_at GLOB '????-??-??T??:??:??.???Z'),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    decision TEXT CHECK(decision IS NULL OR decision IN ('approved','rejected')),
    decided_by TEXT,
    decided_by_role TEXT,
    decision_reason TEXT,
    decided_at TEXT CHECK(decided_at IS NULL OR decided_at GLOB '????-??-??T??:??:??.???Z'), workflow_run_id TEXT, decision_fingerprint TEXT
    CHECK(decision_fingerprint IS NULL OR (length(decision_fingerprint) = 64 AND decision_fingerprint NOT GLOB '*[^0-9a-f]*')), expiry_resumed_at TEXT
    CHECK(expiry_resumed_at IS NULL OR expiry_resumed_at GLOB '????-??-??T??:??:??.???Z'), decision_provenance TEXT NOT NULL DEFAULT 'local'
    CHECK(decision_provenance IN ('local','dashboard')),
    CHECK(expires_at > requested_at),
    CHECK(decided_at IS NULL OR (decided_at >= requested_at AND decided_at < expires_at)),
    CHECK((decision IS NULL AND decided_by IS NULL AND decided_by_role IS NULL AND decision_reason IS NULL AND decided_at IS NULL)
      OR (decision IS NOT NULL AND decided_by IS NOT NULL AND decided_by_role = 'soc_manager' AND decided_at IS NOT NULL)),
    CHECK(decision != 'rejected' OR length(decision_reason) > 0),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, plan_id, plan_hash_version, plan_hash)
      REFERENCES containment_plans(tenant_id, incident_id, id, plan_hash_version, plan_hash)
      ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE authorized_devices (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    authorized_at TEXT NOT NULL CHECK(authorized_at GLOB '????-??-??T??:??:??.???Z'),
    revoked_at TEXT CHECK(revoked_at IS NULL OR revoked_at GLOB '????-??-??T??:??:??.???Z'),
    metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)),
    UNIQUE(tenant_id, subject_id, device_id)
  ) STRICT`,
  `CREATE TABLE consumer_effect_ledger (
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    consumer_group TEXT NOT NULL CHECK(length(trim(consumer_group)) BETWEEN 1 AND 128),
    event_id TEXT NOT NULL CHECK(length(trim(event_id)) BETWEEN 1 AND 128),
    status TEXT NOT NULL CHECK(status IN ('processing','completed','dead_lettered')),
    attempt_count INTEGER NOT NULL CHECK(attempt_count > 0),
    fence_token TEXT NOT NULL CHECK(length(trim(fence_token)) BETWEEN 1 AND 128),
    lease_expires_at TEXT NOT NULL CHECK(lease_expires_at GLOB '????-??-??T??:??:??.???Z'),
    completed_at TEXT CHECK(completed_at IS NULL OR completed_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(tenant_id, consumer_group, event_id)
  ) STRICT`,
  `CREATE TABLE containment_action_attempts (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    approval_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    attempt INTEGER NOT NULL CHECK(attempt > 0),
    owner_id TEXT NOT NULL CHECK(length(trim(owner_id)) BETWEEN 1 AND 128),
    fence_token TEXT NOT NULL UNIQUE CHECK(length(trim(fence_token)) BETWEEN 1 AND 128),
    status TEXT NOT NULL CHECK(status IN ('executing','completed','blocked','failed','timed_out')),
    started_at TEXT NOT NULL CHECK(started_at GLOB '????-??-??T??:??:??.???Z'),
    finished_at TEXT CHECK(finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),
    lease_expires_at TEXT NOT NULL CHECK(lease_expires_at GLOB '????-??-??T??:??:??.???Z'),
    error_code TEXT CHECK(error_code IS NULL OR error_code IN ('ACTION_BLOCKED','PRECONDITION_FAILED','RATE_LIMITED','PROVIDER_FAILED','PROVIDER_TIMEOUT','VERIFICATION_FAILED')),
    provider_ref TEXT,
    verification TEXT NOT NULL CHECK(verification IN ('not_run','verified','not_verified')),
    CHECK((status = 'executing' AND finished_at IS NULL) OR (status != 'executing' AND finished_at IS NOT NULL)),
    UNIQUE(tenant_id, plan_id, action_id, attempt),
    UNIQUE(tenant_id, idempotency_key, attempt),
    FOREIGN KEY(tenant_id, incident_id, plan_id, approval_id)
      REFERENCES approvals(tenant_id, incident_id, plan_id, id) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, plan_id, action_id, idempotency_key)
      REFERENCES containment_actions(tenant_id, incident_id, plan_id, action_id, idempotency_key)
      ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, plan_id) REFERENCES containment_plans(tenant_id, incident_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE containment_actions (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('revoke_session','restore_previous_role','mark_device_for_review','require_reauthentication')),
    ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
    input_json TEXT NOT NULL CHECK(json_valid(input_json)),
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL,
    result_ref TEXT, target_id TEXT,
    UNIQUE(plan_id, action_id),
    UNIQUE(tenant_id, idempotency_key),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, plan_id)
      REFERENCES containment_plans(tenant_id, incident_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE containment_gateway_audit (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    claimed_tenant_id TEXT NOT NULL CHECK(length(trim(claimed_tenant_id)) BETWEEN 1 AND 128),
    claimed_incident_id TEXT NOT NULL CHECK(length(trim(claimed_incident_id)) BETWEEN 1 AND 128),
    claimed_plan_id TEXT NOT NULL CHECK(length(trim(claimed_plan_id)) BETWEEN 1 AND 128),
    claimed_approval_id TEXT NOT NULL CHECK(length(trim(claimed_approval_id)) BETWEEN 1 AND 128),
    claimed_action_id TEXT NOT NULL CHECK(length(trim(claimed_action_id)) BETWEEN 1 AND 128),
    outcome TEXT NOT NULL CHECK(outcome IN ('invalid','blocked','expired','rate_limited','replayed')),
    reason_code TEXT NOT NULL CHECK(reason_code IN ('BINDING_INVALID','MODE_BLOCKED','APPROVAL_EXPIRED','PREDECESSOR_INCOMPLETE','RATE_LIMITED','ALREADY_VERIFIED','ACTION_IN_PROGRESS')),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z')
  ) STRICT`,
  `CREATE TABLE containment_plans (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL CHECK(schema_version > 0),
    plan_version INTEGER NOT NULL CHECK(plan_version > 0),
    plan_hash_version INTEGER NOT NULL CHECK(plan_hash_version > 0),
    plan_hash TEXT NOT NULL CHECK(length(plan_hash) = 64 AND plan_hash NOT GLOB '*[^0-9a-f]*'),
    plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'),
    CHECK(expires_at > created_at),
    UNIQUE(incident_id, plan_version),
    UNIQUE(plan_hash_version, plan_hash),
    UNIQUE(tenant_id, incident_id, id),
    UNIQUE(tenant_id, incident_id, id, plan_hash_version, plan_hash),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE dead_letter_events (
    id TEXT PRIMARY KEY,
    source_outbox_id TEXT,
    event_type TEXT NOT NULL,
    event_ref TEXT NOT NULL,
    tenant_id TEXT,
    incident_id TEXT,
    error_code TEXT NOT NULL,
    attempt_count INTEGER NOT NULL CHECK(attempt_count > 0),
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'),
    resolved_at TEXT CHECK(resolved_at IS NULL OR resolved_at GLOB '????-??-??T??:??:??.???Z'),
    CHECK((tenant_id IS NULL) = (incident_id IS NULL)),
    CHECK(source_outbox_id IS NULL OR tenant_id IS NOT NULL),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, source_outbox_id)
      REFERENCES outbox_events(tenant_id, incident_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE evidence_items (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('identity','endpoint','cloud','geoip','policy')),
    provider TEXT NOT NULL,
    observed_at TEXT NOT NULL CHECK(observed_at GLOB '????-??-??T??:??:??.???Z'),
    collected_at TEXT NOT NULL CHECK(collected_at GLOB '????-??-??T??:??:??.???Z'),
    fact_json TEXT NOT NULL CHECK(json_valid(fact_json)),
    confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
    raw_payload_ref TEXT NOT NULL,
    integrity_hash TEXT NOT NULL CHECK(length(integrity_hash) = 64 AND integrity_hash NOT GLOB '*[^0-9a-f]*'),
    sensitivity TEXT NOT NULL CHECK(sensitivity IN ('public','internal','confidential','restricted')),
    incomplete INTEGER NOT NULL CHECK(incomplete IN (0,1)),
    error_code TEXT, hash_version INTEGER NOT NULL DEFAULT 1 CHECK(hash_version = 1), workflow_run_id TEXT,
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE geoip_cache_entries (
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    policy_version INTEGER NOT NULL CHECK(policy_version IN (1,2)),
    key_version TEXT NOT NULL
      CHECK(length(trim(key_version)) BETWEEN 1 AND 64
        AND key_version NOT GLOB '*[^a-zA-Z0-9._-]*'),
    ip_hash TEXT NOT NULL CHECK(length(ip_hash) = 64 AND ip_hash NOT GLOB '*[^0-9a-f]*'),
    result_json TEXT NOT NULL CHECK(json_valid(result_json)),
    observed_at TEXT NOT NULL CHECK(observed_at GLOB '????-??-??T??:??:??.???Z'),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    purge_after TEXT NOT NULL CHECK(purge_after GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(tenant_id, policy_version, key_version, ip_hash),
    CHECK(expires_at > observed_at), CHECK(purge_after > expires_at)
  ) STRICT`,
  `CREATE TABLE geoip_cache_leases (
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    policy_version INTEGER NOT NULL CHECK(policy_version IN (1,2)),
    key_version TEXT NOT NULL
      CHECK(length(trim(key_version)) BETWEEN 1 AND 64
        AND key_version NOT GLOB '*[^a-zA-Z0-9._-]*'),
    ip_hash TEXT NOT NULL CHECK(length(ip_hash) = 64 AND ip_hash NOT GLOB '*[^0-9a-f]*'),
    fence_token TEXT NOT NULL CHECK(length(trim(fence_token)) BETWEEN 1 AND 128),
    lease_expires_at TEXT NOT NULL CHECK(lease_expires_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(tenant_id, policy_version, key_version, ip_hash)
  ) STRICT`,
  `CREATE TABLE identity_role_change_authorizations (
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    subject_id TEXT NOT NULL CHECK(length(trim(subject_id)) BETWEEN 1 AND 128),
    source_event_id TEXT NOT NULL CHECK(length(trim(source_event_id)) BETWEEN 1 AND 128),
    actor_id TEXT NOT NULL CHECK(length(trim(actor_id)) BETWEEN 1 AND 128),
    previous_role TEXT NOT NULL CHECK(previous_role IN ('admin','member','viewer')),
    current_role TEXT NOT NULL CHECK(current_role IN ('admin','member','viewer')),
    approved INTEGER NOT NULL CHECK(approved IN (0,1)),
    recorded_at TEXT NOT NULL CHECK(recorded_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(tenant_id, subject_id, source_event_id)
  ) STRICT`,
  `CREATE TABLE identity_snapshots (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
    snapshot_ref TEXT NOT NULL,
    integrity_hash TEXT NOT NULL CHECK(length(integrity_hash) = 64 AND integrity_hash NOT GLOB '*[^0-9a-f]*'),
    schema_version INTEGER NOT NULL CHECK(schema_version > 0),
    captured_at TEXT NOT NULL CHECK(captured_at GLOB '????-??-??T??:??:??.???Z'), incident_id TEXT,
    UNIQUE(tenant_id, subject_id, source_event_id)
  ) STRICT`,
  `CREATE TABLE incidents (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 128),
    kind TEXT NOT NULL CHECK(kind IN ('unauthorized_privilege_change','disallowed_country_login','unknown_device_login')),
    subject_id TEXT NOT NULL CHECK(length(subject_id) BETWEEN 1 AND 128),
    status TEXT NOT NULL CHECK(status IN ('received','investigating','awaiting_approval','approved','rejected','containing','contained','failed','closed')),
    severity TEXT CHECK(severity IS NULL OR severity IN ('low','medium','high','critical')),
    version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0),
    timeline_sequence INTEGER NOT NULL DEFAULT 0 CHECK(timeline_sequence >= 0),
    current_plan_id TEXT,
    current_run_id TEXT,
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'),
    updated_at TEXT NOT NULL CHECK(updated_at GLOB '????-??-??T??:??:??.???Z'),
    closed_at TEXT CHECK(closed_at IS NULL OR closed_at GLOB '????-??-??T??:??:??.???Z'),
    CHECK(updated_at >= created_at),
    CHECK(closed_at IS NULL OR closed_at >= created_at),
    UNIQUE(tenant_id, id),
    FOREIGN KEY(tenant_id, id, current_plan_id)
      REFERENCES containment_plans(tenant_id, incident_id, id)
      ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
  ) STRICT`,
  `CREATE TABLE local_containment_effects (
    tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('revoke_session','restore_previous_role','mark_device_for_review','require_reauthentication')),
    target_id TEXT NOT NULL CHECK(length(trim(target_id)) BETWEEN 1 AND 128),
    input_json TEXT NOT NULL CHECK(json_valid(input_json)),
    attempt INTEGER NOT NULL CHECK(attempt > 0),
    fence_token TEXT NOT NULL CHECK(length(trim(fence_token)) BETWEEN 1 AND 128),
    provider_ref TEXT NOT NULL CHECK(length(trim(provider_ref)) BETWEEN 1 AND 256),
    applied_at TEXT NOT NULL CHECK(applied_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(tenant_id, incident_id, plan_id, action_id),
    FOREIGN KEY(plan_id, action_id) REFERENCES containment_actions(plan_id, action_id)
      ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, plan_id)
      REFERENCES containment_plans(tenant_id, incident_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE local_incident_provider_effects (
    idempotency_key TEXT PRIMARY KEY CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 256),
    operation TEXT NOT NULL CHECK(operation IN ('create','update')),
    tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    generation INTEGER NOT NULL CHECK(generation > 0),
    projection_json TEXT NOT NULL CHECK(json_valid(projection_json)),
    external_ref TEXT NOT NULL CHECK(length(external_ref) = 31
      AND substr(external_ref, 1, 15) = 'local-incident-'
      AND substr(external_ref, 16) NOT GLOB '*[^0-9a-f]*'),
    UNIQUE(tenant_id, incident_id, idempotency_key),
    UNIQUE(tenant_id, incident_id, generation),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE outbox_events (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    type TEXT NOT NULL CHECK(type IN ('security.alert.received','security.workflow.updated','security.approval.requested','security.approval.decided','security.containment.completed','security.incident.updated','security.dead-letter')),
    run_id TEXT NOT NULL CHECK(length(trim(run_id)) BETWEEN 1 AND 128),
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL CHECK(schema_version > 0),
    correlation_id TEXT NOT NULL CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
    causation_id TEXT CHECK(causation_id IS NULL OR length(trim(causation_id)) BETWEEN 1 AND 128),
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z'),
    available_at TEXT NOT NULL CHECK(available_at GLOB '????-??-??T??:??:??.???Z'),
    published_at TEXT CHECK(published_at IS NULL OR published_at GLOB '????-??-??T??:??:??.???Z'),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
    error_code TEXT,
    UNIQUE(tenant_id, incident_id, id),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_authority_snapshots (
    tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    workflow_run_id TEXT NOT NULL,
    runbook_id TEXT NOT NULL,
    version TEXT NOT NULL,
    source_hash TEXT NOT NULL CHECK(length(source_hash)=64),
    selected_at TEXT NOT NULL, retrieval_id TEXT, generation_id TEXT, chunk_ids_json TEXT, mandatory_rules_json TEXT, allowed_actions_json TEXT,
    PRIMARY KEY(tenant_id,incident_id,workflow_run_id),
    FOREIGN KEY(tenant_id,incident_id,workflow_run_id)
      REFERENCES workflow_runs(tenant_id,incident_id,run_id) ON DELETE RESTRICT,
    FOREIGN KEY(runbook_id,version) REFERENCES runbook_versions(runbook_id,version) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE provider_deliveries (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
    next_attempt_at TEXT CHECK(next_attempt_at IS NULL OR next_attempt_at GLOB '????-??-??T??:??:??.???Z'),
    external_ref TEXT,
    error_code TEXT, projection_json TEXT
    CHECK(projection_json IS NULL OR json_valid(projection_json)), workflow_run_id TEXT, correlation_id TEXT, provider_generation INTEGER
    CHECK(provider_generation IS NULL OR provider_generation > 0), observed_at TEXT
    CHECK(observed_at IS NULL OR observed_at GLOB '????-??-??T??:??:??.???Z'),
    UNIQUE(provider, incident_id, operation),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE provider_effect_ledger (
    provider TEXT NOT NULL CHECK(provider IN ('linear','workos')),
    idempotency_key TEXT NOT NULL CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 256),
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    incident_id TEXT NOT NULL CHECK(length(trim(incident_id)) BETWEEN 1 AND 128),
    operation TEXT NOT NULL CHECK(length(trim(operation)) BETWEEN 1 AND 64),
    plan_id TEXT NOT NULL CHECK(length(trim(plan_id)) BETWEEN 1 AND 128),
    action_id TEXT NOT NULL CHECK(length(trim(action_id)) BETWEEN 1 AND 128),
    target_id TEXT NOT NULL CHECK(length(trim(target_id)) BETWEEN 1 AND 128),
    status TEXT NOT NULL CHECK(status IN ('claimed','succeeded','uncertain','failed')),
    external_ref TEXT,
    fence_token TEXT,
    claimed_at TEXT NOT NULL CHECK(claimed_at GLOB '????-??-??T??:??:??.???Z'),
    completed_at TEXT CHECK(completed_at IS NULL OR completed_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(provider, idempotency_key),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE provider_incident_generations (
    provider TEXT NOT NULL CHECK(provider IN ('linear','local-incident')),
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    incident_id TEXT NOT NULL CHECK(length(trim(incident_id)) BETWEEN 1 AND 128),
    generation INTEGER NOT NULL CHECK(generation > 0),
    fence_token TEXT NOT NULL CHECK(length(trim(fence_token)) BETWEEN 1 AND 128),
    status TEXT NOT NULL CHECK(status IN ('active','terminal','reconciled')),
    claimed_at TEXT NOT NULL CHECK(claimed_at GLOB '????-??-??T??:??:??.???Z'),
    lease_expires_at TEXT NOT NULL CHECK(lease_expires_at GLOB '????-??-??T??:??:??.???Z'),
    external_ref TEXT,
    PRIMARY KEY(provider, tenant_id, incident_id),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE redis_decode_failures (
    stream_id TEXT NOT NULL CHECK(length(trim(stream_id)) BETWEEN 1 AND 128),
    topic TEXT NOT NULL CHECK(length(trim(topic)) BETWEEN 1 AND 256),
    consumer_group TEXT NOT NULL CHECK(length(trim(consumer_group)) BETWEEN 1 AND 128),
    consumer_name TEXT NOT NULL CHECK(length(trim(consumer_name)) BETWEEN 1 AND 256),
    payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
    payload_size INTEGER NOT NULL CHECK(payload_size >= 0 AND payload_size <= 262144),
    error_code TEXT NOT NULL CHECK(error_code = 'EVENT_INVALID'),
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(stream_id, consumer_group)
  ) STRICT`,
  `CREATE TABLE retention_audit_events (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    sweep_id TEXT NOT NULL CHECK(length(trim(sweep_id)) BETWEEN 1 AND 128),
    event TEXT NOT NULL CHECK(event IN ('started','completed')),
    dry_run INTEGER NOT NULL CHECK(dry_run IN (0,1)),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z'),
    detail_json TEXT NOT NULL CHECK(json_valid(detail_json))
  , tenant_id TEXT) STRICT`,
  `CREATE TABLE retention_source_cursors (
    tenant_id TEXT PRIMARY KEY CHECK(length(tenant_id) BETWEEN 1 AND 128 AND trim(tenant_id) = tenant_id),
    next_source INTEGER NOT NULL CHECK(next_source >= 0)
  ) STRICT`,
  `CREATE TABLE retention_tombstone_claims (
    source TEXT NOT NULL CHECK(length(trim(source)) BETWEEN 1 AND 128),
    source_identity TEXT NOT NULL CHECK(json_valid(source_identity)),
    tenant_id TEXT NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 128 AND trim(tenant_id) = tenant_id),
    retention_class TEXT NOT NULL CHECK(retention_class IN ('thirty-day','three-hundred-sixty-five-day')),
    disposition TEXT NOT NULL CHECK(disposition IN ('deleted','minimized','retained-authority')),
    aged_at TEXT NOT NULL CHECK(aged_at GLOB '????-??-??T??:??:??.???Z'),
    tombstoned_at TEXT NOT NULL CHECK(tombstoned_at GLOB '????-??-??T??:??:??.???Z'),
    sweep_id TEXT NOT NULL CHECK(length(trim(sweep_id)) BETWEEN 1 AND 128),
    PRIMARY KEY(source, tenant_id, source_identity)
  ) STRICT`,
  `CREATE TABLE runbook_activation_events (
    incident_kind TEXT NOT NULL CHECK(incident_kind IN ('unauthorized_privilege_change','disallowed_country_login','unknown_device_login')),
    resulting_revision INTEGER NOT NULL CHECK(resulting_revision > 0),
    operation TEXT NOT NULL CHECK(operation IN ('activate','rollback')),
    from_generation_id TEXT,
    to_generation_id TEXT NOT NULL,
    expected_revision INTEGER NOT NULL CHECK(expected_revision >= 0),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(incident_kind, resulting_revision),
    FOREIGN KEY(from_generation_id) REFERENCES runbook_generations(generation_id) ON DELETE RESTRICT,
    FOREIGN KEY(to_generation_id) REFERENCES runbook_generations(generation_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_activations (
    incident_kind TEXT PRIMARY KEY CHECK(incident_kind IN ('unauthorized_privilege_change','disallowed_country_login','unknown_device_login')),
    runbook_id TEXT NOT NULL,
    version TEXT NOT NULL,
    generation_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision > 0),
    activated_at TEXT NOT NULL CHECK(activated_at GLOB '????-??-??T??:??:??.???Z'),
    UNIQUE(incident_kind, generation_id),
    FOREIGN KEY(generation_id, runbook_id, version, incident_kind)
      REFERENCES runbook_generations(generation_id, runbook_id, version, incident_kind) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_chunks (
    generation_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL CHECK(chunk_id GLOB 'rch_[0-9a-f]*' AND length(chunk_id) = 68),
    vector_id TEXT NOT NULL,
    runbook_id TEXT NOT NULL,
    version TEXT NOT NULL,
    incident_kind TEXT NOT NULL,
    section_key TEXT NOT NULL,
    section_ordinal INTEGER NOT NULL CHECK(section_ordinal BETWEEN 1 AND 9),
    chunk_ordinal INTEGER NOT NULL CHECK(chunk_ordinal >= 0),
    text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 1200),
    content_hash TEXT NOT NULL CHECK(length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*'),
    metadata_hash TEXT NOT NULL CHECK(length(metadata_hash) = 64 AND metadata_hash NOT GLOB '*[^0-9a-f]*'),
    metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)),
    indexed_at TEXT CHECK(indexed_at IS NULL OR indexed_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(generation_id, chunk_id),
    UNIQUE(generation_id, vector_id),
    UNIQUE(generation_id, chunk_id, vector_id),
    UNIQUE(generation_id, section_ordinal, chunk_ordinal),
    FOREIGN KEY(generation_id, runbook_id, version, incident_kind)
      REFERENCES runbook_generations(generation_id, runbook_id, version, incident_kind) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_generation_cleanup_claims (
    generation_id TEXT PRIMARY KEY,
    index_name TEXT NOT NULL,
    expected_chunk_count INTEGER NOT NULL CHECK(expected_chunk_count >= 0),
    status TEXT NOT NULL CHECK(status IN ('claimed','deleted')),
    claimed_at TEXT NOT NULL CHECK(claimed_at GLOB '????-??-??T??:??:??.???Z'),
    completed_at TEXT CHECK(completed_at IS NULL OR completed_at GLOB '????-??-??T??:??:??.???Z'),
    CHECK((status = 'claimed' AND completed_at IS NULL) OR (status = 'deleted' AND completed_at IS NOT NULL)),
    FOREIGN KEY(generation_id) REFERENCES runbook_generations(generation_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_generations (
    generation_id TEXT PRIMARY KEY CHECK(length(trim(generation_id)) BETWEEN 1 AND 128),
    runbook_id TEXT NOT NULL,
    version TEXT NOT NULL,
    incident_kind TEXT NOT NULL CHECK(incident_kind IN ('unauthorized_privilege_change','disallowed_country_login','unknown_device_login')),
    index_name TEXT NOT NULL UNIQUE CHECK(index_name GLOB 'rb_[a-z0-9_]*'),
    state TEXT NOT NULL CHECK(state IN ('staged','active','retired','failed')),
    chunk_count INTEGER NOT NULL CHECK(chunk_count >= 0),
    aggregate_hash TEXT NOT NULL CHECK(length(aggregate_hash) = 64 AND aggregate_hash NOT GLOB '*[^0-9a-f]*'),
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'),
    activated_at TEXT CHECK(activated_at IS NULL OR activated_at GLOB '????-??-??T??:??:??.???Z'),
    retired_at TEXT CHECK(retired_at IS NULL OR retired_at GLOB '????-??-??T??:??:??.???Z'),
    error_code TEXT CHECK(error_code IS NULL OR length(error_code) BETWEEN 1 AND 128),
    UNIQUE(generation_id, runbook_id, version, incident_kind),
    FOREIGN KEY(runbook_id, version) REFERENCES runbook_versions(runbook_id, version) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_retrieval_chunks (
    retrieval_id TEXT NOT NULL,
    rank INTEGER NOT NULL CHECK(rank > 0),
    generation_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    vector_id TEXT NOT NULL,
    content_hash TEXT NOT NULL CHECK(length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*'),
    metadata_hash TEXT NOT NULL CHECK(length(metadata_hash) = 64 AND metadata_hash NOT GLOB '*[^0-9a-f]*'),
    score_text TEXT NOT NULL,
    score REAL NOT NULL CHECK(score >= -1 AND score <= 1),
    section_ordinal INTEGER NOT NULL CHECK(section_ordinal BETWEEN 1 AND 9),
    chunk_ordinal INTEGER NOT NULL CHECK(chunk_ordinal >= 0),
    PRIMARY KEY(retrieval_id, rank),
    UNIQUE(retrieval_id, chunk_id),
    FOREIGN KEY(retrieval_id) REFERENCES runbook_retrievals(retrieval_id) ON DELETE RESTRICT,
    FOREIGN KEY(generation_id, chunk_id, vector_id)
      REFERENCES runbook_chunks(generation_id, chunk_id, vector_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_retrievals (
    retrieval_id TEXT PRIMARY KEY CHECK(length(trim(retrieval_id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    workflow_run_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    incident_kind TEXT NOT NULL CHECK(incident_kind IN ('unauthorized_privilege_change','disallowed_country_login','unknown_device_login')),
    runbook_id TEXT,
    version TEXT,
    generation_id TEXT,
    index_name TEXT,
    activation_revision INTEGER CHECK(activation_revision IS NULL OR activation_revision > 0),
    source_hash TEXT CHECK(source_hash IS NULL OR (length(source_hash) = 64 AND source_hash NOT GLOB '*[^0-9a-f]*')),
    generation_aggregate_hash TEXT CHECK(generation_aggregate_hash IS NULL OR (length(generation_aggregate_hash) = 64 AND generation_aggregate_hash NOT GLOB '*[^0-9a-f]*')),
    allowed_actions_json TEXT CHECK(allowed_actions_json IS NULL OR json_valid(allowed_actions_json)),
    citation TEXT,
    query_hash TEXT NOT NULL CHECK(length(query_hash) = 64 AND query_hash NOT GLOB '*[^0-9a-f]*'),
    status TEXT NOT NULL CHECK(status IN ('in_progress','succeeded','manual_review','failed')),
    error_code TEXT,
    attempt INTEGER NOT NULL DEFAULT 0 CHECK(attempt >= 0),
    lease_token TEXT CHECK(lease_token IS NULL OR length(lease_token) = 64),
    lease_expires_at TEXT CHECK(lease_expires_at IS NULL OR lease_expires_at GLOB '????-??-??T??:??:??.???Z'),
    threshold TEXT NOT NULL,
    top_k INTEGER NOT NULL CHECK(top_k BETWEEN 1 AND 20),
    policy_version INTEGER NOT NULL CHECK(policy_version = 1),
    selected_at TEXT NOT NULL CHECK(selected_at GLOB '????-??-??T??:??:??.???Z'),
    finished_at TEXT CHECK(finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),
    selection_integrity_hash TEXT CHECK(selection_integrity_hash IS NULL OR (length(selection_integrity_hash) = 64 AND selection_integrity_hash NOT GLOB '*[^0-9a-f]*')),
    aggregate_integrity_hash TEXT CHECK(aggregate_integrity_hash IS NULL OR (length(aggregate_integrity_hash) = 64 AND aggregate_integrity_hash NOT GLOB '*[^0-9a-f]*')), mandatory_rules_json TEXT,
    CHECK(finished_at IS NULL OR finished_at >= selected_at),
    CHECK((generation_id IS NULL AND runbook_id IS NULL AND version IS NULL AND index_name IS NULL
        AND activation_revision IS NULL AND source_hash IS NULL AND generation_aggregate_hash IS NULL
        AND allowed_actions_json IS NULL AND citation IS NULL AND selection_integrity_hash IS NULL)
      OR (generation_id IS NOT NULL AND runbook_id IS NOT NULL AND version IS NOT NULL
        AND index_name IS NOT NULL AND activation_revision IS NOT NULL AND source_hash IS NOT NULL
        AND generation_aggregate_hash IS NOT NULL AND allowed_actions_json IS NOT NULL AND citation IS NOT NULL
        AND selection_integrity_hash IS NOT NULL)),
    CHECK((status = 'in_progress' AND generation_id IS NOT NULL AND error_code IS NULL
        AND attempt > 0 AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL
        AND finished_at IS NULL AND aggregate_integrity_hash IS NULL)
      OR (status = 'succeeded' AND generation_id IS NOT NULL AND error_code IS NULL
        AND attempt > 0 AND lease_token IS NULL AND lease_expires_at IS NULL
        AND finished_at IS NOT NULL AND aggregate_integrity_hash IS NOT NULL)
      OR (status IN ('manual_review','failed') AND error_code IS NOT NULL
        AND lease_token IS NULL AND lease_expires_at IS NULL
        AND ((generation_id IS NULL AND attempt = 0) OR (generation_id IS NOT NULL AND attempt > 0))
        AND finished_at IS NOT NULL AND aggregate_integrity_hash IS NOT NULL)),
    UNIQUE(tenant_id, incident_id, workflow_run_id, query_hash, policy_version),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id, workflow_run_id)
      REFERENCES workflow_runs(tenant_id, incident_id, run_id) ON DELETE RESTRICT,
    FOREIGN KEY(generation_id, runbook_id, version, incident_kind)
      REFERENCES runbook_generations(generation_id, runbook_id, version, incident_kind) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE runbook_versions (
    runbook_id TEXT NOT NULL CHECK(length(runbook_id) BETWEEN 5 AND 64 AND substr(runbook_id, 1, 3) = 'RB-' AND runbook_id NOT GLOB '*[^A-Z0-9-]*'),
    version TEXT NOT NULL CHECK(version GLOB '[0-9]*.[0-9]*.[0-9]*'),
    owner TEXT NOT NULL CHECK(length(owner) BETWEEN 2 AND 128 AND owner NOT GLOB '*[^a-z0-9._-]*'),
    declared_status TEXT NOT NULL CHECK(declared_status IN ('active','inactive')),
    source_path TEXT NOT NULL CHECK(source_path GLOB 'runbooks/*.md' AND source_path NOT GLOB '*..*' AND substr(source_path, 10) NOT GLOB '*/*'),
    source_hash TEXT NOT NULL CHECK(length(source_hash) = 64 AND source_hash NOT GLOB '*[^0-9a-f]*'),
    parsed_hash TEXT NOT NULL CHECK(length(parsed_hash) = 64 AND parsed_hash NOT GLOB '*[^0-9a-f]*'),
    schema_version INTEGER NOT NULL CHECK(schema_version = 1),
    chunking_algorithm_version INTEGER NOT NULL CHECK(chunking_algorithm_version = 1),
    embedding_provider TEXT NOT NULL CHECK(embedding_provider = 'fastembed'),
    embedding_model TEXT NOT NULL CHECK(embedding_model = 'bge-small-en-v1.5'),
    embedding_dimension INTEGER NOT NULL CHECK(embedding_dimension = 384),
    allowed_actions_json TEXT NOT NULL CHECK(json_valid(allowed_actions_json)),
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'), mandatory_rules_json TEXT,
    PRIMARY KEY(runbook_id, version)
  ) STRICT`,
  `CREATE TABLE timeline_events (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK(sequence > 0),
    type TEXT NOT NULL CHECK(length(trim(type)) BETWEEN 1 AND 256),
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 256),
    actor_id TEXT,
    correlation_id TEXT NOT NULL CHECK(length(trim(correlation_id)) BETWEEN 1 AND 128),
    causation_id TEXT CHECK(causation_id IS NULL OR length(trim(causation_id)) BETWEEN 1 AND 128),
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    schema_version INTEGER NOT NULL CHECK(schema_version > 0),
    occurred_at TEXT NOT NULL CHECK(occurred_at GLOB '????-??-??T??:??:??.???Z'),
    UNIQUE(incident_id, sequence),
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE workflow_runs (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    run_id TEXT NOT NULL UNIQUE,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL CHECK(started_at GLOB '????-??-??T??:??:??.???Z'),
    finished_at TEXT CHECK(finished_at IS NULL OR finished_at GLOB '????-??-??T??:??:??.???Z'),
    error_code TEXT, triage_result_json TEXT
    CHECK(triage_result_json IS NULL OR json_valid(triage_result_json)), triage_result_hash TEXT
    CHECK(triage_result_hash IS NULL OR (length(triage_result_hash) = 64 AND triage_result_hash NOT GLOB '*[^0-9a-f]*')), trace_context_json TEXT
    CHECK(trace_context_json IS NULL OR json_valid(trace_context_json)), trace_context_version INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(tenant_id, incident_id) REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE workos_observed_memberships (
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    membership_id TEXT NOT NULL,
    observed_role TEXT NOT NULL CHECK(observed_role IN ('admin','member','viewer')),
    observed_status TEXT NOT NULL DEFAULT 'active'
      CHECK(observed_status IN ('active','inactive','pending')),
    observed_state_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
      CHECK(length(observed_state_hash) = 64 AND observed_state_hash NOT GLOB '*[^0-9a-f]*'),
    incident_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL UNIQUE,
    observed_at TEXT NOT NULL CHECK(observed_at GLOB '????-??-??T??:??:??.???Z'),
    version INTEGER NOT NULL CHECK(version > 0),
    PRIMARY KEY(tenant_id, subject_id, membership_id)
  ) STRICT`,
  `CREATE TABLE workos_observed_positions (
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    object_type TEXT NOT NULL CHECK(object_type IN ('membership','session')),
    object_id TEXT NOT NULL,
    observed_at TEXT NOT NULL CHECK(observed_at GLOB '????-??-??T??:??:??.???Z'),
    state_hash TEXT NOT NULL
      CHECK(length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'),
    incident_id TEXT NOT NULL,
    PRIMARY KEY(tenant_id, subject_id, object_type, object_id, observed_at)
  ) STRICT`,
  `CREATE TABLE workos_observed_sessions (
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    observed_status TEXT NOT NULL CHECK(observed_status IN ('active','revoked','expired')),
    observed_state_hash TEXT NOT NULL
      CHECK(length(observed_state_hash) = 64 AND observed_state_hash NOT GLOB '*[^0-9a-f]*'),
    incident_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL UNIQUE,
    observed_at TEXT NOT NULL CHECK(observed_at GLOB '????-??-??T??:??:??.???Z'),
    version INTEGER NOT NULL CHECK(version > 0),
    PRIMARY KEY(tenant_id, subject_id, session_id)
  ) STRICT`,
  `CREATE INDEX idx_action_attempts_current
    ON containment_action_attempts(tenant_id, plan_id, action_id, attempt DESC)`,
  `CREATE INDEX idx_actions_incident_status ON containment_actions(tenant_id, incident_id, status)`,
  `CREATE INDEX idx_alerts_tenant_incident_occurred ON alerts(tenant_id, incident_id, occurred_at)`,
  `CREATE INDEX idx_approval_decision_audit_scope
    ON approval_decision_audit(claimed_tenant_id, claimed_incident_id, occurred_at)`,
  `CREATE INDEX idx_approvals_incident_requested ON approvals(tenant_id, incident_id, requested_at DESC)`,
  `CREATE UNIQUE INDEX idx_approvals_plan_binding
    ON approvals(tenant_id, incident_id, plan_id, id)`,
  `CREATE UNIQUE INDEX idx_approvals_token_binding
    ON approvals(tenant_id, incident_id, workflow_run_id, id, decision,
      decision_fingerprint, expires_at)`,
  `CREATE INDEX idx_approvals_tenant_incident_run
    ON approvals(tenant_id, incident_id, workflow_run_id)`,
  `CREATE INDEX idx_consumer_effect_lease ON consumer_effect_ledger(tenant_id, status, lease_expires_at)`,
  `CREATE INDEX idx_consumer_effect_terminal ON consumer_effect_ledger(tenant_id, status, completed_at)`,
  `CREATE UNIQUE INDEX idx_containment_actions_binding
    ON containment_actions(tenant_id, incident_id, plan_id, action_id, idempotency_key)`,
  `CREATE INDEX idx_containment_gateway_audit_scope
    ON containment_gateway_audit(claimed_tenant_id, claimed_incident_id, occurred_at)`,
  `CREATE INDEX idx_dead_letters_incident ON dead_letter_events(tenant_id, incident_id, created_at)`,
  `CREATE INDEX idx_dead_letters_pending ON dead_letter_events(resolved_at, created_at)`,
  `CREATE INDEX idx_deliveries_pending ON provider_deliveries(status, next_attempt_at)`,
  `CREATE INDEX idx_devices_subject_authorized ON authorized_devices(tenant_id, subject_id, authorized_at DESC)`,
  `CREATE INDEX idx_evidence_incident_observed ON evidence_items(tenant_id, incident_id, observed_at, id)`,
  `CREATE INDEX idx_evidence_incident_source ON evidence_items(tenant_id, incident_id, source)`,
  `CREATE INDEX idx_evidence_workflow_run ON evidence_items(tenant_id,incident_id,workflow_run_id,id)`,
  `CREATE INDEX idx_geoip_cache_expiry ON geoip_cache_entries(expires_at, purge_after)`,
  `CREATE INDEX idx_geoip_cache_lease_expiry ON geoip_cache_leases(lease_expires_at)`,
  `CREATE UNIQUE INDEX idx_identity_snapshots_incident_source
    ON identity_snapshots(tenant_id, incident_id, subject_id, source_event_id)`,
  `CREATE INDEX idx_identity_snapshots_restore_binding
    ON identity_snapshots(tenant_id, incident_id, subject_id, captured_at DESC)`,
  `CREATE INDEX idx_incidents_tenant_status_updated ON incidents(tenant_id, status, updated_at DESC)`,
  `CREATE INDEX idx_incidents_tenant_subject_updated ON incidents(tenant_id, subject_id, updated_at DESC)`,
  `CREATE INDEX idx_outbox_incident ON outbox_events(tenant_id, incident_id, occurred_at)`,
  `CREATE INDEX idx_outbox_pending ON outbox_events(published_at, available_at, occurred_at)`,
  `CREATE INDEX idx_plans_incident_created ON containment_plans(tenant_id, incident_id, created_at DESC)`,
  `CREATE INDEX idx_provider_effect_reconcile ON provider_effect_ledger(provider, status, claimed_at)`,
  `CREATE INDEX idx_provider_incident_generations_fence
    ON provider_incident_generations(provider, tenant_id, incident_id, generation)`,
  `CREATE INDEX idx_provider_incident_generations_lease
    ON provider_incident_generations(status, lease_expires_at)`,
  `CREATE INDEX idx_resume_tokens_binding
    ON approval_resume_tokens(tenant_id, incident_id, workflow_run_id, approval_id, consumed_at)`,
  `CREATE INDEX idx_retention_audit_sweep ON retention_audit_events(sweep_id, occurred_at)`,
  `CREATE INDEX idx_retention_audit_tenant_occurred ON retention_audit_events(tenant_id, occurred_at)`,
  `CREATE INDEX idx_retention_tombstone_claims_tenant ON retention_tombstone_claims(tenant_id, tombstoned_at)`,
  `CREATE INDEX idx_runbook_activation_events_target ON runbook_activation_events(to_generation_id, resulting_revision)`,
  `CREATE INDEX idx_runbook_chunks_hash ON runbook_chunks(generation_id, content_hash, metadata_hash)`,
  `CREATE INDEX idx_runbook_chunks_order ON runbook_chunks(generation_id, section_ordinal, chunk_ordinal)`,
  `CREATE INDEX idx_runbook_generations_kind_state ON runbook_generations(incident_kind, state)`,
  `CREATE INDEX idx_runbook_generations_version ON runbook_generations(runbook_id, version)`,
  `CREATE INDEX idx_runbook_retrieval_chunks_chunk ON runbook_retrieval_chunks(generation_id, chunk_id)`,
  `CREATE INDEX idx_runbook_retrievals_generation ON runbook_retrievals(generation_id, selected_at)`,
  `CREATE INDEX idx_runbook_retrievals_in_progress ON runbook_retrievals(generation_id, status, lease_expires_at)`,
  `CREATE INDEX idx_runbook_retrievals_incident ON runbook_retrievals(tenant_id, incident_id, selected_at)`,
  `CREATE INDEX idx_snapshots_subject_captured ON identity_snapshots(tenant_id, subject_id, captured_at DESC)`,
  `CREATE INDEX idx_timeline_tenant_incident_sequence ON timeline_events(tenant_id, incident_id, sequence)`,
  `CREATE INDEX idx_workflow_incident_started ON workflow_runs(tenant_id, incident_id, started_at DESC)`,
  `CREATE UNIQUE INDEX idx_workflow_runs_runbook_scope
    ON workflow_runs(tenant_id, incident_id, run_id)`,
  `CREATE INDEX idx_workos_observed_memberships_subject
    ON workos_observed_memberships(tenant_id, subject_id, observed_at DESC)`,
  `CREATE INDEX idx_workos_observed_sessions_subject
    ON workos_observed_sessions(tenant_id, subject_id, observed_at DESC)`,
  `CREATE TRIGGER approval_decision_audit_no_delete
    BEFORE DELETE ON approval_decision_audit
    BEGIN SELECT RAISE(ABORT, 'decision audit is append-only'); END`,
  `CREATE TRIGGER approval_decision_audit_no_update
    BEFORE UPDATE ON approval_decision_audit
    BEGIN SELECT RAISE(ABORT, 'decision audit is append-only'); END`,
  `CREATE TRIGGER approval_resume_tokens_immutable
    BEFORE UPDATE ON approval_resume_tokens
    WHEN NEW.id IS NOT OLD.id
      OR NEW.tenant_id IS NOT OLD.tenant_id
      OR NEW.incident_id IS NOT OLD.incident_id
      OR NEW.workflow_run_id IS NOT OLD.workflow_run_id
      OR NEW.approval_id IS NOT OLD.approval_id
      OR NEW.decision IS NOT OLD.decision
      OR NEW.decision_fingerprint IS NOT OLD.decision_fingerprint
      OR NEW.digest_version IS NOT OLD.digest_version
      OR NEW.token_digest IS NOT OLD.token_digest
      OR NEW.issued_at IS NOT OLD.issued_at
      OR NEW.expires_at IS NOT OLD.expires_at
      OR (OLD.consumed_at IS NULL AND NEW.consumed_at IS NULL)
      OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS NOT OLD.consumed_at)
      OR (OLD.resumed_at IS NOT NULL AND NEW.resumed_at IS NOT OLD.resumed_at)
      OR (OLD.resumed_at IS NULL AND NEW.resumed_at IS NULL AND OLD.consumed_at IS NOT NULL)
    BEGIN
      SELECT RAISE(ABORT, 'resume token record is immutable');
    END`,
  `CREATE TRIGGER approval_resume_tokens_no_delete
    BEFORE DELETE ON approval_resume_tokens
    BEGIN
      SELECT RAISE(ABORT, 'resume token ledger is append-only');
    END`,
  `CREATE TRIGGER approvals_expiry_resume_monotonic
    BEFORE UPDATE OF expiry_resumed_at ON approvals
    WHEN OLD.expiry_resumed_at IS NOT NULL OR NEW.expiry_resumed_at IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'approval expiry resume marker is monotonic');
    END`,
  `CREATE TRIGGER approvals_run_immutable
    BEFORE UPDATE OF workflow_run_id ON approvals
    WHEN NEW.workflow_run_id IS NOT OLD.workflow_run_id
    BEGIN
      SELECT RAISE(ABORT, 'approval workflow run binding is immutable');
    END`,
  `CREATE TRIGGER approvals_run_required
    BEFORE INSERT ON approvals
    WHEN NEW.workflow_run_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM workflow_runs w
      WHERE w.tenant_id = NEW.tenant_id
        AND w.incident_id = NEW.incident_id
        AND w.run_id = NEW.workflow_run_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'approval workflow run binding required');
    END`,
  `CREATE TRIGGER containment_action_attempts_closed_immutable
    BEFORE UPDATE ON containment_action_attempts
    WHEN OLD.status != 'executing'
      OR NEW.id IS NOT OLD.id
      OR NEW.tenant_id IS NOT OLD.tenant_id
      OR NEW.incident_id IS NOT OLD.incident_id
      OR NEW.plan_id IS NOT OLD.plan_id
      OR NEW.approval_id IS NOT OLD.approval_id
      OR NEW.action_id IS NOT OLD.action_id
      OR NEW.idempotency_key IS NOT OLD.idempotency_key
      OR NEW.attempt IS NOT OLD.attempt
      OR NEW.owner_id IS NOT OLD.owner_id
      OR NEW.fence_token IS NOT OLD.fence_token
      OR NEW.started_at IS NOT OLD.started_at
      OR NEW.lease_expires_at IS NOT OLD.lease_expires_at
      OR NEW.status = 'executing'
      OR NEW.finished_at IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'containment attempt is immutable');
    END`,
  `CREATE TRIGGER containment_action_attempts_no_delete
    BEFORE DELETE ON containment_action_attempts
    BEGIN
      SELECT RAISE(ABORT, 'containment attempt ledger is append-only');
    END`,
  `CREATE TRIGGER containment_actions_status_guard_insert
    BEFORE INSERT ON containment_actions
    WHEN NEW.status NOT IN ('pending','executing','completed','blocked','failed','timed_out')
    BEGIN
      SELECT RAISE(ABORT, 'invalid containment action status');
    END`,
  `CREATE TRIGGER containment_actions_status_guard_update
    BEFORE UPDATE OF status ON containment_actions
    WHEN NEW.status NOT IN ('pending','executing','completed','blocked','failed','timed_out')
    BEGIN
      SELECT RAISE(ABORT, 'invalid containment action status');
    END`,
  `CREATE TRIGGER containment_gateway_audit_no_delete
    BEFORE DELETE ON containment_gateway_audit
    BEGIN
      SELECT RAISE(ABORT, 'gateway audit is append-only');
    END`,
  `CREATE TRIGGER containment_gateway_audit_no_update
    BEFORE UPDATE ON containment_gateway_audit
    BEGIN
      SELECT RAISE(ABORT, 'gateway audit is append-only');
    END`,
  `CREATE TRIGGER identity_snapshots_incident_binding_insert
    BEFORE INSERT ON identity_snapshots
    FOR EACH ROW WHEN NEW.incident_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM incidents
      WHERE id = NEW.incident_id AND tenant_id = NEW.tenant_id
        AND subject_id = NEW.subject_id
    )
    BEGIN SELECT RAISE(ABORT, 'identity snapshot incident binding invalid'); END`,
  `CREATE TRIGGER identity_snapshots_incident_binding_update
    BEFORE UPDATE OF incident_id, tenant_id, subject_id ON identity_snapshots
    FOR EACH ROW WHEN NEW.incident_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM incidents
      WHERE id = NEW.incident_id AND tenant_id = NEW.tenant_id
        AND subject_id = NEW.subject_id
    )
    BEGIN SELECT RAISE(ABORT, 'identity snapshot incident binding invalid'); END`,
  `CREATE TRIGGER incidents_updated_at_monotonic
    BEFORE UPDATE OF updated_at ON incidents
    WHEN NEW.updated_at < OLD.updated_at
    BEGIN
      SELECT RAISE(ABORT, 'incident updated_at must be monotonic');
    END`,
  `CREATE TRIGGER local_containment_effects_no_delete
    BEFORE DELETE ON local_containment_effects
    BEGIN SELECT RAISE(ABORT, 'local containment effect is append-only'); END`,
  `CREATE TRIGGER local_containment_effects_no_update
    BEFORE UPDATE ON local_containment_effects
    BEGIN SELECT RAISE(ABORT, 'local containment effect is append-only'); END`,
  `CREATE TRIGGER local_incident_provider_effects_no_delete
    BEFORE DELETE ON local_incident_provider_effects
    BEGIN SELECT RAISE(ABORT, 'local provider effect is append-only'); END`,
  `CREATE TRIGGER local_incident_provider_effects_no_update
    BEFORE UPDATE ON local_incident_provider_effects
    BEGIN SELECT RAISE(ABORT, 'local provider effect is append-only'); END`,
  `CREATE TRIGGER retention_audit_events_append_only_delete BEFORE DELETE ON retention_audit_events
    BEGIN SELECT RAISE(ABORT, 'RETENTION_APPEND_ONLY'); END`,
  `CREATE TRIGGER retention_audit_events_append_only_update BEFORE UPDATE ON retention_audit_events
    BEGIN SELECT RAISE(ABORT, 'RETENTION_APPEND_ONLY'); END`,
  `CREATE TRIGGER retention_tombstone_claims_append_only_delete BEFORE DELETE ON retention_tombstone_claims
    BEGIN SELECT RAISE(ABORT, 'RETENTION_APPEND_ONLY'); END`,
  `CREATE TRIGGER retention_tombstone_claims_append_only_update BEFORE UPDATE ON retention_tombstone_claims
    BEGIN SELECT RAISE(ABORT, 'RETENTION_APPEND_ONLY'); END`,
  `CREATE TRIGGER timeline_occurred_at_monotonic
    BEFORE INSERT ON timeline_events
    WHEN EXISTS (
      SELECT 1 FROM timeline_events
      WHERE incident_id = NEW.incident_id AND occurred_at > NEW.occurred_at
    )
    BEGIN
      SELECT RAISE(ABORT, 'timeline occurred_at must be monotonic');
    END`,
  `CREATE TRIGGER workflow_runs_triage_result_immutable
    BEFORE UPDATE OF triage_result_json, triage_result_hash ON workflow_runs
    WHEN OLD.triage_result_json IS NOT NULL AND (
      NEW.triage_result_json IS NOT OLD.triage_result_json
      OR NEW.triage_result_hash IS NOT OLD.triage_result_hash
    )
    BEGIN
      SELECT RAISE(ABORT, 'triage result is immutable');
    END`,
] as const;
