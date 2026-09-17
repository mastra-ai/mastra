export const workosExpectedCallbackStatements = [
  `CREATE TABLE workos_expected_membership_callbacks (
    provider TEXT NOT NULL DEFAULT 'workos' CHECK(provider = 'workos'),
    idempotency_key TEXT NOT NULL CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 256),
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    incident_id TEXT NOT NULL CHECK(length(trim(incident_id)) BETWEEN 1 AND 128),
    subject_id TEXT NOT NULL CHECK(length(trim(subject_id)) BETWEEN 1 AND 128),
    membership_id TEXT NOT NULL CHECK(length(trim(membership_id)) BETWEEN 1 AND 128),
    expected_previous_role TEXT NOT NULL
      CHECK(expected_previous_role IN ('admin','member','viewer')),
    expected_role TEXT NOT NULL CHECK(expected_role IN ('admin','member','viewer')),
    plan_id TEXT NOT NULL CHECK(length(trim(plan_id)) BETWEEN 1 AND 128),
    action_id TEXT NOT NULL CHECK(length(trim(action_id)) BETWEEN 1 AND 128),
    status TEXT NOT NULL CHECK(status IN ('armed','consumed','expired')),
    armed_at TEXT NOT NULL CHECK(armed_at GLOB '????-??-??T??:??:??.???Z'),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    source_event_id TEXT UNIQUE
      CHECK(source_event_id IS NULL OR length(trim(source_event_id)) BETWEEN 1 AND 128),
    observed_state_hash TEXT
      CHECK(observed_state_hash IS NULL OR
        (length(observed_state_hash) = 64 AND observed_state_hash NOT GLOB '*[^0-9a-f]*')),
    observed_at TEXT
      CHECK(observed_at IS NULL OR observed_at GLOB '????-??-??T??:??:??.???Z'),
    consumed_at TEXT
      CHECK(consumed_at IS NULL OR consumed_at GLOB '????-??-??T??:??:??.???Z'),
    PRIMARY KEY(provider, idempotency_key),
    CHECK(expected_previous_role <> expected_role),
    CHECK(expires_at > armed_at),
    CHECK((status = 'consumed') =
      (source_event_id IS NOT NULL AND observed_state_hash IS NOT NULL
        AND observed_at IS NOT NULL AND consumed_at IS NOT NULL)),
    FOREIGN KEY(provider, idempotency_key)
      REFERENCES provider_effect_ledger(provider, idempotency_key) ON DELETE RESTRICT,
    FOREIGN KEY(tenant_id, incident_id)
      REFERENCES incidents(tenant_id, id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE UNIQUE INDEX idx_workos_expected_membership_active
    ON workos_expected_membership_callbacks(tenant_id, subject_id, membership_id)
    WHERE status = 'armed'`,
  `CREATE INDEX idx_workos_expected_membership_event
    ON workos_expected_membership_callbacks(source_event_id)
    WHERE source_event_id IS NOT NULL`,
] as const;
