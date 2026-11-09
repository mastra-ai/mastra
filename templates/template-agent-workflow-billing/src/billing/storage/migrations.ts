import { createHash } from 'node:crypto';
import type { Transaction } from '@libsql/client/node';
import { BillingError } from '../contracts.js';

const safeInteger = 'BETWEEN 0 AND 9007199254740991';
const historySql = `CREATE TABLE billing_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT`;

const initialStatements = [
  `CREATE TABLE billing_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider = 'local'),
    external_reference TEXT NOT NULL,
    UNIQUE (provider, external_reference)
  ) STRICT`,
  `CREATE TABLE commercial_state (
    account_id TEXT PRIMARY KEY REFERENCES billing_accounts(id),
    version INTEGER NOT NULL CHECK (version ${safeInteger})
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
    balance INTEGER CHECK (balance ${safeInteger}),
    consumed INTEGER NOT NULL CHECK (consumed ${safeInteger}),
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
];

const organizationStatements = [
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
];

const accountingStatements = [
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
    observed_units INTEGER CHECK (observed_units ${safeInteger}),
    billed_units INTEGER CHECK (billed_units ${safeInteger}),
    result TEXT,
    created_at TEXT NOT NULL,
    terminal_at TEXT,
    CHECK ((status IN ('running', 'uncertain') AND terminal_at IS NULL) OR (status IN ('completed', 'failed', 'canceled') AND terminal_at IS NOT NULL))
  ) STRICT`,
  `CREATE TRIGGER billing_execution_terms_immutable BEFORE UPDATE OF actor_id, workspace_id, account_id, resource_id, operation, configuration, created_at ON billing_executions BEGIN SELECT RAISE(ABORT, 'Execution terms are immutable'); END`,
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
    units INTEGER NOT NULL CHECK (units ${safeInteger}),
    PRIMARY KEY (execution_id, id)
  ) STRICT`,
  `CREATE TABLE billing_ledger (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    account_id TEXT REFERENCES billing_accounts(id),
    meter TEXT,
    units INTEGER NOT NULL CHECK (units ${safeInteger}),
    outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'failed', 'canceled')),
    occurred_at TEXT NOT NULL,
    CHECK ((units = 0) OR (account_id IS NOT NULL AND meter IS NOT NULL AND outcome = 'completed'))
  ) STRICT`,
  `CREATE TABLE billing_outbox (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL UNIQUE REFERENCES billing_ledger(execution_id),
    payload TEXT NOT NULL
  ) STRICT`,
  ...['billing_measurements', 'billing_ledger', 'billing_outbox'].flatMap(table => [
    `CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
    `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'Accounting history is immutable'); END`,
  ]),
];

const workflowStatements = [
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
];

const providerStatements = [
  `ALTER TABLE billing_accounts ADD COLUMN effective_provider TEXT NOT NULL DEFAULT 'local' CHECK (effective_provider IN ('local', 'polar'))`,
  `CREATE TABLE provider_links (
    account_id TEXT PRIMARY KEY REFERENCES billing_accounts(id),
    customer_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE credit_grants (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    source_key TEXT NOT NULL,
    meter TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('order', 'subscription')),
    fingerprint TEXT NOT NULL,
    provenance TEXT NOT NULL,
    original_units INTEGER NOT NULL CHECK (original_units BETWEEN 1 AND 9007199254740991),
    consumed_units INTEGER NOT NULL DEFAULT 0 CHECK (consumed_units BETWEEN 0 AND original_units),
    valid_from TEXT NOT NULL,
    valid_until TEXT,
    available INTEGER NOT NULL CHECK (available IN (0, 1)),
    UNIQUE (account_id, source_key),
    CHECK (valid_until IS NULL OR julianday(valid_until) > julianday(valid_from))
  ) STRICT`,
  `CREATE TRIGGER credit_grant_terms_immutable BEFORE UPDATE OF id, account_id, source_key, meter, kind, fingerprint, provenance, original_units, valid_from ON credit_grants BEGIN SELECT RAISE(ABORT, 'Grant provenance is immutable'); END`,
  `CREATE TRIGGER credit_grants_no_delete BEFORE DELETE ON credit_grants BEGIN SELECT RAISE(ABORT, 'Grant history is retained'); END`,
  `CREATE TABLE grant_allocations (
    execution_id TEXT NOT NULL REFERENCES billing_executions(id),
    grant_id TEXT NOT NULL REFERENCES credit_grants(id),
    reserved_units INTEGER NOT NULL CHECK (reserved_units BETWEEN 1 AND 9007199254740991),
    committed_units INTEGER CHECK (committed_units BETWEEN 0 AND reserved_units),
    PRIMARY KEY (execution_id, grant_id)
  ) STRICT`,
  `CREATE TABLE hosted_operations (
    actor_id TEXT NOT NULL REFERENCES identities(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    operation TEXT NOT NULL CHECK (operation IN ('checkout', 'portal')),
    key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    url TEXT,
    PRIMARY KEY (actor_id, workspace_id, operation, key)
  ) STRICT`,
  `CREATE TABLE provider_usage (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    payload TEXT NOT NULL,
    delivered INTEGER NOT NULL CHECK (delivered IN (0, 1))
  ) STRICT`,
  `CREATE TRIGGER provider_usage_terms_immutable BEFORE UPDATE OF id, account_id, payload ON provider_usage BEGIN SELECT RAISE(ABORT, 'Usage identity is immutable'); END`,
];

const recoveryStatements = [
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
  `CREATE TABLE billing_account_sync (
    account_id TEXT PRIMARY KEY REFERENCES billing_accounts(id),
    generation INTEGER NOT NULL DEFAULT 0 CHECK (generation BETWEEN 0 AND 9007199254740991),
    synchronized_generation INTEGER NOT NULL DEFAULT 0 CHECK (synchronized_generation BETWEEN 0 AND generation),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 9007199254740991),
    next_attempt INTEGER NOT NULL DEFAULT 0,
    lease_token TEXT,
    lease_until INTEGER,
    last_error TEXT
  ) STRICT`,
  `CREATE TABLE billing_inbox (
    id TEXT PRIMARY KEY,
    digest TEXT NOT NULL,
    event_type TEXT NOT NULL,
    account_id TEXT REFERENCES billing_accounts(id),
    occurred_at TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    generation INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'ignored'))
  ) STRICT`,
  `CREATE TRIGGER billing_inbox_terms_immutable BEFORE UPDATE OF id, digest, event_type, account_id, occurred_at, received_at, generation ON billing_inbox BEGIN SELECT RAISE(ABORT, 'Notification identity is immutable'); END`,
  `CREATE TRIGGER billing_inbox_no_delete BEFORE DELETE ON billing_inbox BEGIN SELECT RAISE(ABORT, 'Notification history is retained'); END`,
  `CREATE TABLE billing_refresh_leases (
    token TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    generation INTEGER NOT NULL,
    revision TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT`,
  `CREATE TABLE billing_runtimes (id TEXT PRIMARY KEY, pid INTEGER NOT NULL) STRICT`,
  `ALTER TABLE billing_executions ADD COLUMN recovery_fenced INTEGER NOT NULL DEFAULT 0 CHECK (recovery_fenced IN (0, 1))`,
  `INSERT INTO billing_delivery (event_id, status, created_at) SELECT id, 'pending', CAST(unixepoch() * 1000 AS INTEGER) FROM billing_outbox`,
];

const expiryRecoveryStatements = [
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
  `INSERT INTO billing_expiry_recovery (run_id) SELECT id FROM billing_workflow_runs WHERE status = 'canceling' AND owner IS NULL`,
];

const usageBindingStatements = [
  `CREATE TABLE billing_usage_bindings (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    payload TEXT NOT NULL CHECK (length(payload) BETWEEN 1 AND 16384),
    evidence TEXT CHECK (evidence IS NULL OR length(evidence) BETWEEN 1 AND 2048)
  ) STRICT`,
  `CREATE TRIGGER billing_usage_bindings_no_update BEFORE UPDATE ON billing_usage_bindings BEGIN SELECT RAISE(ABORT, 'Usage bindings are immutable'); END`,
  `CREATE TRIGGER billing_usage_bindings_no_delete BEFORE DELETE ON billing_usage_bindings BEGIN SELECT RAISE(ABORT, 'Usage bindings are immutable'); END`,
];

const hostedDispatchStatements = [
  // Old pending claims cannot prove whether a provider POST happened.
  `ALTER TABLE hosted_operations ADD COLUMN dispatch_state TEXT NOT NULL DEFAULT 'dispatched' CHECK (dispatch_state IN ('not_dispatched', 'dispatched'))`,
];

const commercialCatalogStatements = [
  `CREATE TABLE billing_catalog (
    kind TEXT NOT NULL CHECK (kind IN ('allowance', 'offer')),
    key TEXT NOT NULL,
    version TEXT NOT NULL,
    terms TEXT NOT NULL,
    PRIMARY KEY (kind, key, version)
  ) STRICT`,
  `CREATE TRIGGER billing_catalog_no_update BEFORE UPDATE ON billing_catalog BEGIN SELECT RAISE(ABORT, 'Catalog revisions are immutable'); END`,
  `CREATE TRIGGER billing_catalog_no_delete BEFORE DELETE ON billing_catalog BEGIN SELECT RAISE(ABORT, 'Catalog revisions are retained'); END`,
];

const driverStatements = [
  `ALTER TABLE billing_accounts ADD COLUMN active_provider TEXT`,
  `CREATE TABLE billing_provider_links (
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    provider TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    external_reference TEXT NOT NULL,
    source_key_mode TEXT NOT NULL CHECK (source_key_mode IN ('legacy', 'namespaced')),
    PRIMARY KEY (account_id, provider),
    UNIQUE (provider, organization_id, customer_id)
  ) STRICT`,
  `CREATE TABLE billing_driver_configurations (
    provider TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    configuration TEXT NOT NULL,
    PRIMARY KEY (provider, fingerprint)
  ) STRICT`,
  `CREATE TABLE billing_source_owners (
    account_id TEXT NOT NULL REFERENCES billing_accounts(id),
    source_key TEXT NOT NULL,
    provider TEXT NOT NULL,
    PRIMARY KEY (account_id, source_key),
    FOREIGN KEY (account_id, source_key) REFERENCES credit_grants(account_id, source_key)
  ) STRICT`,
  `CREATE TABLE billing_admitted_accounts (
    execution_id TEXT PRIMARY KEY REFERENCES billing_executions(id),
    payload TEXT NOT NULL
  ) STRICT`,
  ...[
    'billing_provider_links',
    'billing_driver_configurations',
    'billing_source_owners',
    'billing_admitted_accounts',
  ].flatMap(table => [
    `CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'Provider history is immutable'); END`,
    `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'Provider history is retained'); END`,
  ]),
  `INSERT INTO billing_provider_links SELECT a.id, 'polar', l.customer_id, l.organization_id, a.external_reference, 'legacy' FROM billing_accounts a JOIN provider_links l ON l.account_id = a.id`,
  `INSERT INTO billing_source_owners SELECT account_id, source_key, 'polar' FROM credit_grants`,
  // Before this migration provider replacement was impossible. Existing binding
  // evidence and the original account establish admission ownership additively.
  `INSERT INTO billing_admitted_accounts SELECT e.id, json_object('id', a.id, 'workspaceId', a.workspace_id, 'provider', COALESCE(json_extract(b.payload, '$.provider'), a.effective_provider), 'externalReference', a.external_reference) FROM billing_executions e JOIN billing_accounts a ON a.id = e.account_id LEFT JOIN billing_usage_bindings b ON b.execution_id = e.id`,
];

const webhookStatements = [
  `DROP TRIGGER billing_inbox_terms_immutable`,
  `DROP TRIGGER billing_inbox_no_delete`,
  `ALTER TABLE billing_inbox RENAME TO billing_inbox_legacy`,
  `CREATE TABLE billing_inbox (
    id TEXT NOT NULL,
    digest TEXT NOT NULL,
    event_type TEXT NOT NULL,
    account_id TEXT REFERENCES billing_accounts(id),
    occurred_at TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    generation INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'ignored')),
    provider TEXT NOT NULL,
    PRIMARY KEY (provider, id)
  ) STRICT`,
  `INSERT INTO billing_inbox SELECT *, 'polar' FROM billing_inbox_legacy`,
  `DROP TABLE billing_inbox_legacy`,
  `CREATE TRIGGER billing_inbox_terms_immutable BEFORE UPDATE OF provider, id, digest, event_type, account_id, occurred_at, received_at, generation ON billing_inbox BEGIN SELECT RAISE(ABORT, 'Notification identity is immutable'); END`,
  `CREATE TRIGGER billing_inbox_no_delete BEFORE DELETE ON billing_inbox BEGIN SELECT RAISE(ABORT, 'Notification history is retained'); END`,
];

const lifecycleStatements = [
  `CREATE TABLE billing_provider_lifecycle (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('retired', 'reactivated')),
    evidence TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (account_id, provider) REFERENCES billing_provider_links(account_id, provider)
  ) STRICT`,
  `CREATE TABLE billing_external_effects (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('usage', 'checkout', 'portal')),
    external_key TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending', 'uncertain', 'complete')),
    FOREIGN KEY (account_id, provider) REFERENCES billing_provider_links(account_id, provider)
  ) STRICT`,
  `CREATE TABLE billing_usage_events (
    id TEXT PRIMARY KEY REFERENCES provider_usage(id),
    payload TEXT NOT NULL
  ) STRICT`,
  ...['billing_provider_lifecycle', 'billing_usage_events'].flatMap(table => [
    `CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'Lifecycle evidence is immutable'); END`,
    `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'Lifecycle evidence is retained'); END`,
  ]),
  `CREATE TRIGGER billing_external_effects_terms_immutable BEFORE UPDATE OF id, account_id, provider, kind, external_key ON billing_external_effects BEGIN SELECT RAISE(ABORT, 'External effect identity is immutable'); END`,
  `CREATE TRIGGER billing_external_effects_no_delete BEFORE DELETE ON billing_external_effects BEGIN SELECT RAISE(ABORT, 'External effect history is retained'); END`,
];

const effectOwnershipStatements = [
  `CREATE TABLE billing_external_effect_owners (
    effect_id TEXT PRIMARY KEY REFERENCES billing_external_effects(id),
    runtime_id TEXT NOT NULL REFERENCES billing_runtimes(id)
  ) STRICT`,
  ...['billing_external_effect_owners', 'billing_runtimes'].flatMap(table => [
    `CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'Runtime ownership is immutable'); END`,
    `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'Runtime ownership is retained'); END`,
  ]),
];

const migrations = [
  { version: 1, statements: initialStatements },
  { version: 2, statements: organizationStatements },
  { version: 3, statements: accountingStatements },
  { version: 4, statements: workflowStatements },
  { version: 5, statements: providerStatements },
  { version: 6, statements: recoveryStatements },
  { version: 7, statements: expiryRecoveryStatements },
  { version: 8, statements: usageBindingStatements },
  { version: 9, statements: hostedDispatchStatements },
  { version: 10, statements: commercialCatalogStatements },
  { version: 11, statements: driverStatements },
  { version: 12, statements: webhookStatements },
  { version: 13, statements: lifecycleStatements },
  { version: 14, statements: effectOwnershipStatements },
].map(migration => ({
  ...migration,
  checksum: createHash('sha256').update(migration.statements.join('\n')).digest('hex'),
}));

const normalizedSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

export async function migrateStorage(transaction: Transaction): Promise<void> {
  const catalog = await transaction.execute(
    "SELECT name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'trigger', 'view', 'index') AND sql IS NOT NULL",
  );
  const hasHistory = catalog.rows.some(row => row.name === 'billing_migrations');
  if (!hasHistory && catalog.rows.length > 0) throw new BillingError('storage_incompatible');
  const userVersion = (await transaction.execute('PRAGMA user_version')).rows[0].user_version;
  if (!hasHistory) {
    if (userVersion !== 0n) throw new BillingError('storage_incompatible');
    await transaction.execute(historySql);
  }
  const history = await transaction.execute('SELECT version, checksum FROM billing_migrations ORDER BY version');
  for (const [index, row] of history.rows.entries()) {
    const expected = migrations[index];
    if (!expected || row.version !== BigInt(expected.version) || row.checksum !== expected.checksum)
      throw new BillingError('storage_incompatible');
  }
  if (hasHistory && userVersion !== BigInt(history.rows.length)) throw new BillingError('storage_incompatible');
  for (const migration of migrations.slice(history.rows.length)) {
    for (const sql of migration.statements) await transaction.execute(sql);
    await transaction.execute({
      sql: 'INSERT INTO billing_migrations (version, checksum, applied_at) VALUES (?, ?, ?)',
      args: [migration.version, migration.checksum, new Date().toISOString()],
    });
    await transaction.execute(`PRAGMA user_version = ${migration.version}`);
  }
  const schema = await transaction.execute(
    "SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name",
  );
  const actual = schema.rows.map(row => normalizedSql(String(row.sql))).sort();
  const accountSql = initialStatements[0].replace(
    'external_reference TEXT NOT NULL,',
    "external_reference TEXT NOT NULL, effective_provider TEXT NOT NULL DEFAULT 'local' CHECK (effective_provider IN ('local', 'polar')), active_provider TEXT,",
  );
  const expected = [
    historySql,
    accountSql,
    ...initialStatements.slice(1),
    ...organizationStatements,
    ...accountingStatements.map(sql =>
      sql.startsWith('CREATE TABLE billing_executions')
        ? sql.replace(
            'terminal_at TEXT,',
            'terminal_at TEXT, recovery_fenced INTEGER NOT NULL DEFAULT 0 CHECK (recovery_fenced IN (0, 1)),',
          )
        : sql,
    ),
    ...workflowStatements,
    ...providerStatements
      .slice(1)
      .map(sql =>
        sql.startsWith('CREATE TABLE hosted_operations')
          ? sql.replace(
              'url TEXT,',
              "url TEXT, dispatch_state TEXT NOT NULL DEFAULT 'dispatched' CHECK (dispatch_state IN ('not_dispatched', 'dispatched')),",
            )
          : sql,
      ),
    ...recoveryStatements.filter(sql => sql.startsWith('CREATE') && !sql.includes('billing_inbox')),
    ...webhookStatements.filter(sql => sql.startsWith('CREATE')),
    ...expiryRecoveryStatements.filter(sql => sql.startsWith('CREATE')),
    ...usageBindingStatements,
    ...commercialCatalogStatements,
    ...driverStatements.filter(sql => sql.startsWith('CREATE')),
    ...lifecycleStatements,
    ...effectOwnershipStatements,
  ]
    .map(normalizedSql)
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new BillingError('storage_incompatible');
  if ((await transaction.execute('PRAGMA foreign_key_check')).rows.length > 0)
    throw new BillingError('storage_incompatible');
}
