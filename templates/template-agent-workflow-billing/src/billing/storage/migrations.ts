import { transitionImageCredits } from '../providers/local/credit-transitions.js';
import { createHash } from 'node:crypto';
import type { Transaction } from '@libsql/client/node';
import { BillingError } from '../contracts/core.js';

// This development schema deliberately does not import older paid-source data.
// Existing files must match its complete version, checksum and SQL definition.
const schemaStatements = [
  `CREATE TABLE billing_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT`,
  `CREATE TABLE billing_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('local', 'autumn')),
    external_reference TEXT NOT NULL,
    UNIQUE (provider, external_reference)
  ) STRICT`,
  `CREATE TABLE commercial_state (
    account_id TEXT PRIMARY KEY REFERENCES billing_accounts(id),
    version INTEGER NOT NULL CHECK (version BETWEEN 0 AND 9007199254740991)
  ) STRICT`,
  `CREATE TABLE commercial_grants (
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    kind TEXT NOT NULL CHECK (kind IN ('entitlement', 'subscription')),
    key TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_until TEXT,
    PRIMARY KEY (account_id, kind, key),
    CHECK (valid_until IS NULL OR julianday(valid_until) > julianday(valid_from))
  ) STRICT`,
  `CREATE TABLE commercial_meters (
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    key TEXT NOT NULL,
    funding TEXT NOT NULL CHECK (funding IN ('prepaid', 'metered')),
    balance INTEGER CHECK (balance BETWEEN 0 AND 9007199254740991),
    consumed INTEGER NOT NULL CHECK (consumed BETWEEN 0 AND 9007199254740991),
    period_start TEXT,
    period_end TEXT,
    PRIMARY KEY (account_id, key),
    CHECK ((funding = 'prepaid' AND balance IS NOT NULL) OR (funding = 'metered' AND balance IS NULL)),
    CHECK ((period_start IS NULL AND period_end IS NULL) OR (period_start IS NOT NULL AND period_end IS NOT NULL AND julianday(period_end) > julianday(period_start)))
  ) STRICT`,
  `CREATE TABLE immutable_usage (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    meter TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 9007199254740991),
    occurred_at TEXT NOT NULL,
    payload TEXT NOT NULL,
    FOREIGN KEY (account_id, meter) REFERENCES commercial_meters(account_id, key)
  ) STRICT`,
  `CREATE TRIGGER immutable_usage_no_update BEFORE UPDATE ON immutable_usage BEGIN SELECT RAISE(ABORT, 'Usage is immutable'); END`,
  `CREATE TRIGGER immutable_usage_no_delete BEFORE DELETE ON immutable_usage BEGIN SELECT RAISE(ABORT, 'Usage is immutable'); END`,
  `CREATE TABLE identities (
    id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('local', 'jwt')),
    display_name TEXT NOT NULL,
    active INTEGER NOT NULL CHECK (active IN (0, 1)),
    UNIQUE (issuer, subject)
  ) STRICT`,
  `CREATE TABLE local_credentials (
    hash TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL REFERENCES identities(id),
    active INTEGER NOT NULL CHECK (active IN (0, 1))
  ) STRICT`,
  `CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    personal_identity_id TEXT NOT NULL UNIQUE REFERENCES identities(id),
    kind TEXT NOT NULL CHECK (kind IN ('personal', 'shared'))
  ) STRICT`,
  `CREATE TABLE memberships (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    identity_id TEXT NOT NULL REFERENCES identities(id),
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    PRIMARY KEY (workspace_id, identity_id)
  ) STRICT`,
  `CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    recipient_id TEXT NOT NULL REFERENCES identities(id),
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT
  ) STRICT`,
  `CREATE TABLE organization_operations (
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    operation TEXT NOT NULL,
    key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    result TEXT NOT NULL,
    PRIMARY KEY (actor_id, workspace_id, operation, key)
  ) STRICT`,
  `CREATE TABLE private_records (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    actor_id TEXT NOT NULL REFERENCES identities(id),
    result TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE billing_executions (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    account_id TEXT REFERENCES billing_accounts(id),
    resource_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('generate', 'start', 'resume', 'cancel')),
    configuration TEXT NOT NULL,
    runtime_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'canceled', 'uncertain')),
    settlement TEXT NOT NULL CHECK (settlement IN ('not_required', 'reserved', 'pending', 'settled', 'released', 'uncertain')),
    observed_units INTEGER CHECK (observed_units BETWEEN 0 AND 9007199254740991),
    billed_units INTEGER CHECK (billed_units BETWEEN 0 AND 9007199254740991),
    result TEXT,
    created_at TEXT NOT NULL,
    terminal_at TEXT, recovery_fenced INTEGER NOT NULL DEFAULT 0 CHECK (recovery_fenced IN (0, 1)),
    CHECK ((status IN ('running', 'uncertain') AND terminal_at IS NULL) OR (status IN ('completed', 'failed', 'canceled') AND terminal_at IS NOT NULL))
  ) STRICT`,
  `CREATE TABLE billing_operations (
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    resource_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    execution_id TEXT NOT NULL UNIQUE REFERENCES billing_executions(id),
    PRIMARY KEY (actor_id, workspace_id, resource_id, operation, key)
  ) STRICT`,
  `CREATE TRIGGER billing_operations_no_update BEFORE UPDATE ON billing_operations BEGIN SELECT RAISE(ABORT, 'Operation claims are immutable'); END`,
  `CREATE TRIGGER billing_operations_no_delete BEFORE DELETE ON billing_operations BEGIN SELECT RAISE(ABORT, 'Operation tombstones are retained'); END`,
  `CREATE TABLE billing_reservations (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    meter TEXT NOT NULL,
    units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 9007199254740991),
    active INTEGER NOT NULL CHECK (active IN (0, 1))
  ) STRICT`,
  `CREATE TABLE billing_measurements (
    execution_id TEXT NOT NULL REFERENCES billing_executions(id),
    id TEXT NOT NULL,
    measure TEXT NOT NULL,
    units INTEGER NOT NULL CHECK (units BETWEEN 0 AND 9007199254740991),
    PRIMARY KEY (execution_id, id)
  ) STRICT`,
  `CREATE TABLE billing_ledger (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    account_id TEXT REFERENCES billing_accounts(id),
    meter TEXT,
    units INTEGER NOT NULL CHECK (units BETWEEN 0 AND 9007199254740991),
    outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'failed', 'canceled')),
    occurred_at TEXT NOT NULL,
    CHECK ((units = 0) OR (account_id IS NOT NULL AND meter IS NOT NULL AND outcome = 'completed'))
  ) STRICT`,
  `CREATE TABLE billing_outbox (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL UNIQUE REFERENCES billing_ledger(execution_id),
    payload TEXT NOT NULL
  ) STRICT`,
  `CREATE TRIGGER billing_measurements_no_update BEFORE UPDATE ON billing_measurements BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  `CREATE TRIGGER billing_measurements_no_delete BEFORE DELETE ON billing_measurements BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  `CREATE TRIGGER billing_ledger_no_update BEFORE UPDATE ON billing_ledger BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  `CREATE TRIGGER billing_ledger_no_delete BEFORE DELETE ON billing_ledger BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  `CREATE TRIGGER billing_outbox_no_update BEFORE UPDATE ON billing_outbox BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  `CREATE TRIGGER billing_outbox_no_delete BEFORE DELETE ON billing_outbox BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  `CREATE TABLE billing_workflow_runs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    resource_id TEXT NOT NULL,
    configuration TEXT NOT NULL,
    adapter_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('created', 'running', 'suspended', 'canceling', 'completed', 'failed', 'canceled', 'uncertain')),
    version INTEGER NOT NULL CHECK (version BETWEEN 0 AND 9007199254740991),
    owner TEXT,
    expires_at INTEGER,
    measurement_complete INTEGER NOT NULL CHECK (measurement_complete IN (0, 1)),
    input TEXT,
    result TEXT,
    created_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TRIGGER billing_workflow_identity_immutable BEFORE UPDATE OF id, actor_id, workspace_id, resource_id, configuration, adapter_version, created_at ON billing_workflow_runs BEGIN SELECT RAISE(ABORT, 'Workflow terms are immutable'); END`,
  `CREATE TABLE billing_workflow_operations (
    run_id TEXT NOT NULL REFERENCES billing_workflow_runs(id),
    operation TEXT NOT NULL CHECK (operation IN ('create', 'start', 'resume', 'cancel')),
    key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    version INTEGER NOT NULL,
    PRIMARY KEY (run_id, operation, key)
  ) STRICT`,
  `CREATE TRIGGER billing_workflow_operations_no_update BEFORE UPDATE ON billing_workflow_operations BEGIN SELECT RAISE(ABORT, 'Workflow claims are immutable'); END`,
  `CREATE TRIGGER billing_workflow_operations_no_delete BEFORE DELETE ON billing_workflow_operations BEGIN SELECT RAISE(ABORT, 'Workflow claims are retained'); END`,
  `CREATE TABLE hosted_operations (
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    operation TEXT NOT NULL CHECK (operation IN ('checkout', 'portal')),
    key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    url TEXT, dispatch_state TEXT NOT NULL DEFAULT 'dispatched' CHECK (dispatch_state IN ('not_dispatched', 'dispatched')),
    PRIMARY KEY (actor_id, workspace_id, operation, key)
  ) STRICT`,
  `CREATE TABLE billing_delivery (
    event_id TEXT PRIMARY KEY REFERENCES billing_outbox(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'retrying', 'failed', 'uncertain')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 9007199254740991),
    next_attempt INTEGER NOT NULL DEFAULT 0,
    lease_token TEXT,
    lease_until INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL
  ) STRICT`,
  `CREATE TABLE billing_runtimes (id TEXT PRIMARY KEY, pid INTEGER NOT NULL) STRICT`,
  `CREATE TABLE billing_expiry_recovery (
    run_id TEXT PRIMARY KEY REFERENCES billing_workflow_runs(id),
    confirmed_suspended INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_suspended IN (0, 1)),
    next_attempt INTEGER NOT NULL DEFAULT 0,
    lease_token TEXT,
    lease_until INTEGER,
    CHECK ((lease_token IS NULL AND lease_until IS NULL) OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
  ) STRICT`,
  `CREATE TRIGGER billing_expiry_identity_immutable BEFORE UPDATE OF run_id ON billing_expiry_recovery BEGIN SELECT RAISE(ABORT, 'Expiry identity is immutable'); END`,
  `CREATE TRIGGER billing_expiry_confirmation_monotonic BEFORE UPDATE OF confirmed_suspended ON billing_expiry_recovery WHEN OLD.confirmed_suspended = 1 AND NEW.confirmed_suspended != 1 BEGIN SELECT RAISE(ABORT, 'Suspension evidence is retained'); END`,
  `CREATE TRIGGER billing_expiry_no_delete BEFORE DELETE ON billing_expiry_recovery BEGIN SELECT RAISE(ABORT, 'Expiry intent is retained'); END`,
  `CREATE TABLE billing_usage_bindings (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    payload TEXT NOT NULL CHECK (length(payload) BETWEEN 1 AND 16384),
    evidence TEXT CHECK (evidence IS NULL OR length(evidence) BETWEEN 1 AND 2048)
  ) STRICT`,
  `CREATE TRIGGER billing_usage_bindings_no_update BEFORE UPDATE ON billing_usage_bindings BEGIN SELECT RAISE(ABORT, 'Usage bindings are immutable'); END`,
  `CREATE TRIGGER billing_usage_bindings_no_delete BEFORE DELETE ON billing_usage_bindings BEGIN SELECT RAISE(ABORT, 'Usage bindings are immutable'); END`,
  `CREATE TABLE billing_catalog (
    kind TEXT NOT NULL CHECK (kind IN ('allowance', 'offer')),
    key TEXT NOT NULL,
    version TEXT NOT NULL,
    terms TEXT NOT NULL,
    PRIMARY KEY (kind, key, version)
  ) STRICT`,
  `CREATE TRIGGER billing_catalog_no_update BEFORE UPDATE ON billing_catalog BEGIN SELECT RAISE(ABORT, 'Catalog revisions are immutable'); END`,
  `CREATE TRIGGER billing_catalog_no_delete BEFORE DELETE ON billing_catalog BEGIN SELECT RAISE(ABORT, 'Catalog revisions are retained'); END`,
  `CREATE TABLE billing_provider_links (
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    provider TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    external_reference TEXT NOT NULL,
    PRIMARY KEY (account_id, provider),
    UNIQUE (provider, organization_id, customer_id)
  ) STRICT`,
  `CREATE TABLE billing_admitted_accounts (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    payload TEXT NOT NULL
  ) STRICT`,
  `CREATE TRIGGER billing_provider_links_no_update BEFORE UPDATE ON billing_provider_links BEGIN SELECT RAISE(ABORT, 'Provider history is immutable'); END`,
  `CREATE TRIGGER billing_provider_links_no_delete BEFORE DELETE ON billing_provider_links BEGIN SELECT RAISE(ABORT, 'Provider history is retained'); END`,
  `CREATE TRIGGER billing_admitted_accounts_no_update BEFORE UPDATE ON billing_admitted_accounts BEGIN SELECT RAISE(ABORT, 'Provider history is immutable'); END`,
  `CREATE TRIGGER billing_admitted_accounts_no_delete BEFORE DELETE ON billing_admitted_accounts BEGIN SELECT RAISE(ABORT, 'Provider history is retained'); END`,
  `CREATE TRIGGER billing_runtimes_no_update BEFORE UPDATE ON billing_runtimes BEGIN SELECT RAISE(ABORT, 'Runtime ownership is immutable'); END`,
  `CREATE TRIGGER billing_runtimes_no_delete BEFORE DELETE ON billing_runtimes BEGIN SELECT RAISE(ABORT, 'Runtime ownership is retained'); END`,
  `CREATE TRIGGER billing_execution_terms_immutable BEFORE UPDATE OF actor_id, workspace_id, resource_id, operation, configuration, created_at ON billing_executions BEGIN SELECT RAISE(ABORT, 'Execution terms are immutable'); END`,
  `CREATE TRIGGER billing_execution_account_immutable BEFORE UPDATE OF account_id ON billing_executions WHEN OLD.account_id IS NOT NULL OR NEW.account_id IS NULL BEGIN SELECT RAISE(ABORT, 'Execution account is immutable'); END`,
  `CREATE TABLE billing_remote_operations (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    request TEXT NOT NULL,
    payload TEXT NOT NULL,
    reserve_state TEXT NOT NULL CHECK (reserve_state IN ('prepared', 'dispatched', 'reserved', 'denied', 'uncertain')),
    reserve_evidence TEXT,
    segment_deadline INTEGER,
    outcome_units INTEGER CHECK (outcome_units BETWEEN 0 AND 9007199254740991),
    terminal_request TEXT,
    terminal_payload TEXT,
    terminal_dispatched INTEGER NOT NULL DEFAULT 0 CHECK (terminal_dispatched IN (0, 1)),
    terminal_state TEXT NOT NULL DEFAULT 'pending' CHECK (terminal_state IN ('pending', 'confirmed', 'released')),
    terminal_evidence TEXT,
    CHECK ((terminal_request IS NULL AND terminal_payload IS NULL AND terminal_dispatched = 0) OR (terminal_request IS NOT NULL AND terminal_payload IS NOT NULL AND terminal_dispatched = 1))
  ) STRICT`,
  `CREATE TRIGGER billing_remote_identity_immutable BEFORE UPDATE OF request, payload, execution_id ON billing_remote_operations BEGIN SELECT RAISE(ABORT, 'Reservation identity is immutable'); END`,
  `CREATE TRIGGER billing_remote_outcome_immutable BEFORE UPDATE OF outcome_units ON billing_remote_operations WHEN OLD.outcome_units IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Known execution outcome is immutable'); END`,
  `CREATE TRIGGER billing_remote_dispatch_immutable BEFORE UPDATE OF terminal_dispatched ON billing_remote_operations WHEN OLD.terminal_dispatched = 1 BEGIN SELECT RAISE(ABORT, 'Financial dispatch claim is immutable'); END`,
  `CREATE TRIGGER billing_remote_terminal_immutable BEFORE UPDATE OF terminal_request, terminal_payload ON billing_remote_operations WHEN OLD.terminal_request IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Terminal intent is immutable'); END`,
  `CREATE TRIGGER billing_remote_no_delete BEFORE DELETE ON billing_remote_operations BEGIN SELECT RAISE(ABORT, 'Financial operations are retained'); END`,
  `CREATE TABLE local_provider_reservations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    meter TEXT NOT NULL,
    units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 9007199254740991),
    expires_at INTEGER NOT NULL,
    payload TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('reserved', 'confirmed', 'released')),
    terminal_payload TEXT
  ) STRICT`,
  `CREATE TRIGGER local_reservation_identity_immutable BEFORE UPDATE OF id, account_id, meter, units, expires_at, payload ON local_provider_reservations BEGIN SELECT RAISE(ABORT, 'Reservation identity is immutable'); END`,
  `CREATE TRIGGER local_reservation_terminal_immutable BEFORE UPDATE ON local_provider_reservations WHEN OLD.state != 'reserved' BEGIN SELECT RAISE(ABORT, 'Reservation is terminal'); END`,
  `CREATE TABLE billing_workflow_dispatch_claims (
    execution_id TEXT PRIMARY KEY REFERENCES billing_remote_operations(execution_id)
  ) STRICT`,
  `CREATE TRIGGER billing_workflow_dispatch_no_update BEFORE UPDATE ON billing_workflow_dispatch_claims BEGIN SELECT RAISE(ABORT, 'Workflow dispatch claims are immutable'); END`,
  `CREATE TRIGGER billing_workflow_dispatch_no_delete BEFORE DELETE ON billing_workflow_dispatch_claims BEGIN SELECT RAISE(ABORT, 'Workflow dispatch claims are retained'); END`,
  `CREATE TABLE billing_workflow_native_handoffs (
    execution_id TEXT NOT NULL REFERENCES billing_remote_operations(execution_id),
    version INTEGER NOT NULL CHECK (version BETWEEN 1 AND 9007199254740991),
    state TEXT NOT NULL CHECK (state IN ('handing_off', 'active')),
    PRIMARY KEY (execution_id, version)
  ) STRICT`,
  `CREATE TRIGGER billing_workflow_handoff_identity_immutable BEFORE UPDATE OF execution_id, version ON billing_workflow_native_handoffs BEGIN SELECT RAISE(ABORT, 'Workflow handoff identity is immutable'); END`,
  `CREATE TRIGGER billing_workflow_handoff_active_immutable BEFORE UPDATE OF state ON billing_workflow_native_handoffs WHEN OLD.state = 'active' BEGIN SELECT RAISE(ABORT, 'Active workflow handoffs are retained'); END`,
  `CREATE TRIGGER billing_workflow_handoff_no_delete BEFORE DELETE ON billing_workflow_native_handoffs BEGIN SELECT RAISE(ABORT, 'Workflow handoffs are retained'); END`,
  `CREATE TABLE billing_workflow_resume_preparations (
    execution_id TEXT NOT NULL REFERENCES billing_remote_operations(execution_id),
    version INTEGER NOT NULL CHECK (version BETWEEN 2 AND 9007199254740991),
    PRIMARY KEY (execution_id, version)
  ) STRICT`,
  `CREATE TRIGGER billing_workflow_resume_preparation_no_update BEFORE UPDATE ON billing_workflow_resume_preparations BEGIN SELECT RAISE(ABORT, 'Workflow resume preparations are immutable'); END`,
  `CREATE TRIGGER billing_workflow_resume_preparation_no_delete BEFORE DELETE ON billing_workflow_resume_preparations BEGIN SELECT RAISE(ABORT, 'Workflow resume preparations are retained'); END`,
];
const imageStatements = [
  `CREATE TABLE local_image_credit_migrations (
    account_id TEXT PRIMARY KEY REFERENCES billing_accounts(id),
    source_meter TEXT NOT NULL CHECK (source_meter = 'weather-credits'),
    target_meter TEXT NOT NULL CHECK (target_meter = 'image-credits'),
    balance INTEGER NOT NULL CHECK (balance BETWEEN 0 AND 9007199254740991),
    consumed INTEGER NOT NULL CHECK (consumed BETWEEN 0 AND 9007199254740991)
  ) STRICT`,
  `CREATE TRIGGER local_image_credit_migration_no_update BEFORE UPDATE ON local_image_credit_migrations BEGIN SELECT RAISE(ABORT, 'Local credit transitions are immutable'); END`,
  `CREATE TRIGGER local_image_credit_migration_no_delete BEFORE DELETE ON local_image_credit_migrations BEGIN SELECT RAISE(ABORT, 'Local credit transition tombstones are retained'); END`,
  `CREATE TABLE image_slots (
    execution_id TEXT NOT NULL REFERENCES billing_executions(id),
    slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 2),
    identity TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('dispatched', 'completed', 'failed', 'uncertain')),
    artifact_id TEXT UNIQUE,
    PRIMARY KEY (execution_id, slot)
  ) STRICT`,
  `CREATE TRIGGER image_slot_identity_immutable BEFORE UPDATE OF execution_id, slot, identity ON image_slots BEGIN SELECT RAISE(ABORT, 'Image slot identity is immutable'); END`,
  `CREATE TRIGGER image_slot_terminal_immutable BEFORE UPDATE ON image_slots WHEN OLD.state != 'dispatched' BEGIN SELECT RAISE(ABORT, 'Image slot is terminal'); END`,
  `CREATE TRIGGER image_slot_no_delete BEFORE DELETE ON image_slots BEGIN SELECT RAISE(ABORT, 'Image claims are retained'); END`,
  `CREATE TABLE image_artifacts (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    slot INTEGER NOT NULL,
    metadata TEXT NOT NULL,
    FOREIGN KEY (execution_id, slot) REFERENCES image_slots(execution_id, slot),
    UNIQUE (execution_id, slot)
  ) STRICT`,
  `CREATE TRIGGER image_artifact_no_update BEFORE UPDATE ON image_artifacts BEGIN SELECT RAISE(ABORT, 'Artifact metadata is immutable'); END`,
  `CREATE TRIGGER image_artifact_no_delete BEFORE DELETE ON image_artifacts BEGIN SELECT RAISE(ABORT, 'Artifact identities are retained'); END`,
];
const creditStatements = [
  `CREATE TABLE local_credit_migrations (
    account_id TEXT PRIMARY KEY REFERENCES billing_accounts(id),
    source_meter TEXT NOT NULL,
    target_meter TEXT NOT NULL,
    balance INTEGER NOT NULL CHECK (balance BETWEEN 0 AND 9007199254740991),
    consumed INTEGER NOT NULL CHECK (consumed BETWEEN 0 AND 9007199254740991),
    CHECK (source_meter != target_meter)
  ) STRICT`,
  `CREATE TRIGGER local_credit_migration_no_update BEFORE UPDATE ON local_credit_migrations BEGIN SELECT RAISE(ABORT, 'Local credit transitions are immutable'); END`,
  `CREATE TRIGGER local_credit_migration_no_delete BEFORE DELETE ON local_credit_migrations BEGIN SELECT RAISE(ABORT, 'Local credit transition tombstones are retained'); END`,
];
const studioStatements = [
  `CREATE TABLE billing_studio_threads (
    thread_id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    agent_id TEXT NOT NULL,
    resource_id TEXT NOT NULL
  ) STRICT`,
  `CREATE TRIGGER billing_studio_threads_no_update BEFORE UPDATE ON billing_studio_threads BEGIN SELECT RAISE(ABORT, 'Conversation ownership is immutable'); END`,
  `CREATE TRIGGER billing_studio_threads_no_delete BEFORE DELETE ON billing_studio_threads BEGIN SELECT RAISE(ABORT, 'Conversation ownership is retained'); END`,
  `CREATE TABLE billing_studio_runs (
    run_id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES billing_studio_threads(thread_id)
  ) STRICT`,
  `CREATE TRIGGER billing_studio_runs_no_update BEFORE UPDATE ON billing_studio_runs BEGIN SELECT RAISE(ABORT, 'Conversation run ownership is immutable'); END`,
  `CREATE TRIGGER billing_studio_runs_no_delete BEFORE DELETE ON billing_studio_runs BEGIN SELECT RAISE(ABORT, 'Conversation run ownership is retained'); END`,
  `CREATE TABLE billing_studio_operations (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES billing_studio_threads(thread_id),
    message_id TEXT NOT NULL,
    tool_call_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    action TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    request_key TEXT NOT NULL UNIQUE,
    execution_id TEXT,
    pending TEXT,
    UNIQUE (thread_id, tool_call_id)
  ) STRICT`,
  `CREATE TRIGGER billing_studio_operation_identity_immutable BEFORE UPDATE OF id, thread_id, message_id, tool_call_id, resource_id, action, fingerprint, request_key, pending ON billing_studio_operations BEGIN SELECT RAISE(ABORT, 'Conversation invocation is immutable'); END`,
  `CREATE TRIGGER billing_studio_operation_execution_immutable BEFORE UPDATE OF execution_id ON billing_studio_operations WHEN OLD.execution_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Conversation execution is immutable'); END`,
  `CREATE TRIGGER billing_studio_operations_no_delete BEFORE DELETE ON billing_studio_operations BEGIN SELECT RAISE(ABORT, 'Conversation invocation is retained'); END`,
  `CREATE TABLE billing_studio_approvals (
    operation_id TEXT PRIMARY KEY REFERENCES billing_studio_operations(id),
    approved INTEGER NOT NULL CHECK (approved IN (0, 1)),
    accepted INTEGER NOT NULL DEFAULT 0 CHECK (accepted IN (0, 1))
  ) STRICT`,
  `CREATE TRIGGER billing_studio_approval_identity_immutable BEFORE UPDATE OF operation_id, approved ON billing_studio_approvals BEGIN SELECT RAISE(ABORT, 'Native approval decision is immutable'); END`,
  `CREATE TRIGGER billing_studio_approval_accepted_monotonic BEFORE UPDATE OF accepted ON billing_studio_approvals WHEN OLD.accepted = 1 BEGIN SELECT RAISE(ABORT, 'Native approval acknowledgement is retained'); END`,
  `CREATE TRIGGER billing_studio_approvals_no_delete BEFORE DELETE ON billing_studio_approvals BEGIN SELECT RAISE(ABORT, 'Native approval decisions are retained'); END`,
];
// Derived pending set: immutable account and payload equality is the only
// evidence that permits removing a debit from admission accounting.
const unreflectedStatements = [
  `CREATE TABLE billing_unreflected_debits (
    event_id TEXT PRIMARY KEY REFERENCES billing_outbox(id),
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    meter TEXT NOT NULL,
    units INTEGER NOT NULL CHECK (units BETWEEN 0 AND 9007199254740991)
  ) STRICT`,
  `CREATE INDEX billing_unreflected_debits_account_meter ON billing_unreflected_debits(account_id, meter)`,
  `CREATE TRIGGER billing_unreflected_debits_valid_insert BEFORE INSERT ON billing_unreflected_debits
    WHEN NOT EXISTS (SELECT 1 FROM billing_outbox o JOIN billing_ledger l ON l.execution_id = o.execution_id
      WHERE o.id = NEW.event_id AND l.account_id = NEW.account_id AND l.meter = NEW.meter AND l.units = NEW.units
      AND NOT EXISTS (SELECT 1 FROM immutable_usage u WHERE u.id = o.id AND u.account_id = l.account_id AND u.payload = o.payload))
    BEGIN SELECT RAISE(ABORT, 'Unreflected debit must match immutable accounting'); END`,
  `CREATE TRIGGER billing_unreflected_debits_no_update BEFORE UPDATE ON billing_unreflected_debits
    BEGIN SELECT RAISE(ABORT, 'Unreflected debit terms are immutable'); END`,
  `CREATE TRIGGER billing_unreflected_debits_verified_delete BEFORE DELETE ON billing_unreflected_debits
    WHEN NOT EXISTS (SELECT 1 FROM immutable_usage u JOIN billing_outbox o ON o.id = u.id
      WHERE u.id = OLD.event_id AND u.account_id = OLD.account_id AND u.payload = o.payload)
    BEGIN SELECT RAISE(ABORT, 'Unreflected debit requires matching reflection'); END`,
  `CREATE TRIGGER billing_outbox_track_unreflected AFTER INSERT ON billing_outbox
    BEGIN INSERT INTO billing_unreflected_debits (event_id, account_id, meter, units)
      SELECT NEW.id, l.account_id, l.meter, l.units FROM billing_ledger l WHERE l.execution_id = NEW.execution_id
      AND l.account_id IS NOT NULL AND l.meter IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM immutable_usage u WHERE u.id = NEW.id AND u.account_id = l.account_id AND u.payload = NEW.payload); END`,
  `CREATE TRIGGER immutable_usage_reflect_debit AFTER INSERT ON immutable_usage
    BEGIN DELETE FROM billing_unreflected_debits WHERE event_id = NEW.id AND account_id = NEW.account_id
      AND EXISTS (SELECT 1 FROM billing_outbox o WHERE o.id = NEW.id AND o.payload = NEW.payload); END`,
];
const deliveryQueueStatements = [
  `CREATE INDEX billing_delivery_retryable ON billing_delivery(next_attempt, created_at, event_id)
    WHERE status IN ('pending', 'retrying', 'uncertain')`,
];
const checksum = (statements: readonly string[]) => createHash('sha256').update(statements.join('\n')).digest('hex');
const normalizedSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();
async function validateCatalog(transaction: Transaction, statements: readonly string[]) {
  const actual = (
    await transaction.execute("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL")
  ).rows
    .map(row => normalizedSql(String(row.sql)))
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(statements.map(normalizedSql).sort()))
    throw new BillingError('storage_incompatible');
  if ((await transaction.execute('PRAGMA foreign_key_check')).rows.length > 0)
    throw new BillingError('storage_incompatible');
}
export async function migrateStorage(transaction: Transaction): Promise<void> {
  const catalog = await transaction.execute(
    "SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL",
  );
  const version = (await transaction.execute('PRAGMA user_version')).rows[0].user_version;
  if (catalog.rows.length === 0 && version === 0n) {
    for (const sql of schemaStatements) await transaction.execute(sql);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations VALUES (1, ?, ?)',
      args: [checksum(schemaStatements), new Date().toISOString()],
    });
  } else {
    if (
      ![1n, 2n, 3n, 4n, 5n, 6n].includes(version as bigint) ||
      !catalog.rows.some(row => row.name === 'billing_migrations')
    )
      throw new BillingError('storage_incompatible');
    const history = (await transaction.execute('SELECT version, checksum FROM billing_migrations ORDER BY version'))
      .rows;
    if (
      history.length !== Number(version) ||
      history[0].version !== 1n ||
      history[0].checksum !== checksum(schemaStatements) ||
      (Number(version) >= 2 && (history[1].version !== 2n || history[1].checksum !== checksum(imageStatements))) ||
      (Number(version) >= 3 && (history[2].version !== 3n || history[2].checksum !== checksum(creditStatements))) ||
      (Number(version) >= 4 && (history[3].version !== 4n || history[3].checksum !== checksum(studioStatements))) ||
      (Number(version) >= 5 &&
        (history[4].version !== 5n || history[4].checksum !== checksum(unreflectedStatements))) ||
      (version === 6n && (history[5].version !== 6n || history[5].checksum !== checksum(deliveryQueueStatements)))
    )
      throw new BillingError('storage_incompatible');
    // Validate the complete recognized old schema before the first migration write.
    await validateCatalog(
      transaction,
      version === 1n
        ? schemaStatements
        : version === 2n
          ? [...schemaStatements, ...imageStatements]
          : [
              ...schemaStatements,
              ...imageStatements,
              ...creditStatements,
              ...(Number(version) >= 4 ? studioStatements : []),
              ...(Number(version) >= 5 ? unreflectedStatements : []),
              ...(version === 6n ? deliveryQueueStatements : []),
            ],
    );
    if (version === 6n) return;
  }
  if (Number(version) < 2) {
    for (const sql of imageStatements) await transaction.execute(sql);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations VALUES (2, ?, ?)',
      args: [checksum(imageStatements), new Date().toISOString()],
    });
    await transitionImageCredits(transaction);
    await transaction.execute('PRAGMA user_version = 2');
  }
  if (Number(version) < 3) {
    for (const sql of creditStatements) await transaction.execute(sql);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations VALUES (3, ?, ?)',
      args: [checksum(creditStatements), new Date().toISOString()],
    });
    await transaction.execute('PRAGMA user_version = 3');
  }
  if (Number(version) < 4) {
    for (const sql of studioStatements) await transaction.execute(sql);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations VALUES (4, ?, ?)',
      args: [checksum(studioStatements), new Date().toISOString()],
    });
    await transaction.execute('PRAGMA user_version = 4');
  }
  if (Number(version) < 5) {
    for (const sql of unreflectedStatements) await transaction.execute(sql);
    await transaction.execute(`INSERT INTO billing_unreflected_debits (event_id, account_id, meter, units)
      SELECT o.id, l.account_id, l.meter, l.units FROM billing_outbox o JOIN billing_ledger l ON l.execution_id = o.execution_id
      WHERE l.account_id IS NOT NULL AND l.meter IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM immutable_usage u WHERE u.id = o.id AND u.account_id = l.account_id AND u.payload = o.payload)`);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations VALUES (5, ?, ?)',
      args: [checksum(unreflectedStatements), new Date().toISOString()],
    });
    await transaction.execute('PRAGMA user_version = 5');
  }
  if (Number(version) < 6) {
    for (const sql of deliveryQueueStatements) await transaction.execute(sql);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations VALUES (6, ?, ?)',
      args: [checksum(deliveryQueueStatements), new Date().toISOString()],
    });
    await transaction.execute('PRAGMA user_version = 6');
  }
  await validateCatalog(transaction, [
    ...schemaStatements,
    ...imageStatements,
    ...creditStatements,
    ...studioStatements,
    ...unreflectedStatements,
    ...deliveryQueueStatements,
  ]);
}
