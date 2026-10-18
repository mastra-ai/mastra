export const stagingPrivilegeIntentStatements = [
  `CREATE TABLE staging_privilege_change_intents (
    id TEXT PRIMARY KEY CHECK(length(trim(id)) BETWEEN 1 AND 128),
    tenant_id TEXT NOT NULL CHECK(length(trim(tenant_id)) BETWEEN 1 AND 128),
    subject_id TEXT NOT NULL CHECK(length(trim(subject_id)) BETWEEN 1 AND 128),
    membership_id TEXT NOT NULL CHECK(length(trim(membership_id)) BETWEEN 1 AND 128),
    actor_id TEXT NOT NULL CHECK(length(trim(actor_id)) BETWEEN 1 AND 128),
    previous_role TEXT NOT NULL CHECK(previous_role IN ('admin','member','viewer')),
    current_role TEXT NOT NULL CHECK(current_role IN ('admin','member','viewer')),
    previous_state_hash TEXT NOT NULL
      CHECK(length(previous_state_hash) = 64 AND previous_state_hash NOT GLOB '*[^0-9a-f]*'),
    approved INTEGER NOT NULL DEFAULT 0 CHECK(approved = 0),
    status TEXT NOT NULL CHECK(status IN ('pending','consumed','expired')),
    created_at TEXT NOT NULL CHECK(created_at GLOB '????-??-??T??:??:??.???Z'),
    expires_at TEXT NOT NULL CHECK(expires_at GLOB '????-??-??T??:??:??.???Z'),
    consumed_at TEXT CHECK(consumed_at IS NULL OR consumed_at GLOB '????-??-??T??:??:??.???Z'),
    source_event_id TEXT UNIQUE,
    CHECK(previous_role <> current_role),
    CHECK(expires_at > created_at),
    CHECK((status = 'consumed' AND consumed_at IS NOT NULL AND source_event_id IS NOT NULL)
      OR (status IN ('pending','expired') AND consumed_at IS NULL AND source_event_id IS NULL))
  ) STRICT`,
  `CREATE UNIQUE INDEX idx_staging_privilege_intent_pending
    ON staging_privilege_change_intents(tenant_id, subject_id, membership_id, current_role)
    WHERE status = 'pending'`,
  `CREATE INDEX idx_staging_privilege_intent_expiry
    ON staging_privilege_change_intents(status, expires_at)`,
] as const;
