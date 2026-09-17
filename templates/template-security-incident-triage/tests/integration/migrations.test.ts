import { afterEach, describe, expect, it } from 'vitest';

import { migrateOperationalStore } from '../../src/db/migrate.js';
import { migrationChecksum, migrations, type Migration } from '../../src/db/migrations/index.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('operational database migrations', () => {
  it('creates the complete schema and staging intent extension', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store, {
        appliedAt: '2026-09-01T12:00:00.000Z',
      });

      const ledger = await store.execute({
        sql: 'SELECT version, name, checksum FROM soc_schema_migrations',
      });
      expect(ledger.rows).toEqual(
        migrations.map(({ version, name, checksum }) => ({
          version,
          name,
          checksum,
        })),
      );

      const schema = await store.execute({
        sql: `SELECT name FROM sqlite_schema
          WHERE type IN ('table','index','trigger') ORDER BY name`,
      });
      const names = schema.rows.map(row => String(row.name));
      expect(names).toEqual(
        expect.arrayContaining([
          'incidents',
          'alerts',
          'evidence_items',
          'workflow_runs',
          'runbook_versions',
          'runbook_retrievals',
          'runbook_authority_snapshots',
          'approvals',
          'containment_plans',
          'containment_actions',
          'provider_deliveries',
          'provider_effect_ledger',
          'consumer_effect_ledger',
          'retention_audit_events',
          'retention_tombstone_claims',
          'retention_source_cursors',
          'local_incident_provider_effects',
          'local_containment_effects',
          'staging_privilege_change_intents',
          'device_attestations',
          'device_authorization_audit',
          'workos_expected_membership_callbacks',
        ]),
      );
      expect(names.some(name => /phase|legacy|reconciliation/u.test(name))).toBe(false);
      expect(names).not.toContain('analytics_export_events');
      expect(names).not.toContain('retention_tenant_quarantine');

      const workflowColumns = await store.execute({
        sql: 'PRAGMA table_info(workflow_runs)',
      });
      expect(workflowColumns.rows.map(row => row.name)).toEqual(
        expect.arrayContaining([
          'triage_result_json',
          'triage_result_hash',
          'trace_context_json',
          'trace_context_version',
        ]),
      );
    } finally {
      store.close();
    }
  });

  it('is idempotent after all schema migrations have been applied', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      await expect(migrateOperationalStore(store)).resolves.toBeUndefined();
      await expect(
        store.execute({
          sql: 'SELECT count(*) AS count FROM soc_schema_migrations',
        }),
      ).resolves.toMatchObject({ rows: [{ count: migrations.length }] });
    } finally {
      store.close();
    }
  });

  it('supports a new sequential migration without changing the baseline', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const statements = [
      `CREATE TABLE schema_extension_probe (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      ) STRICT`,
    ] as const;
    const extension: Migration = {
      version: 6,
      name: 'schema-extension-probe',
      statements,
      checksum: migrationChecksum(statements),
    };
    try {
      await migrateOperationalStore(store, {
        migrationSet: [...migrations, extension],
      });
      await expect(
        store.execute({
          sql: "SELECT name FROM sqlite_schema WHERE type='table' AND name='schema_extension_probe'",
        }),
      ).resolves.toMatchObject({
        rows: [{ name: 'schema_extension_probe' }],
      });
      await expect(
        store.execute({
          sql: 'SELECT version, name FROM soc_schema_migrations ORDER BY version',
        }),
      ).resolves.toMatchObject({
        rows: [
          { version: 1, name: 'initial-schema' },
          { version: 2, name: 'staging-privilege-intents' },
          { version: 3, name: 'first-party-device-trust' },
          { version: 4, name: 'workos-expected-membership-callbacks' },
          { version: 5, name: 'analytics-journal' },
          { version: 6, name: 'schema-extension-probe' },
        ],
      });
    } finally {
      store.close();
    }
  });

  it('rejects checksum drift in an applied migration', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await migrateOperationalStore(store);
      const drifted: Migration = {
        ...migrations[0]!,
        checksum: migrationChecksum(['SELECT 1']),
      };
      await expect(migrateOperationalStore(store, { migrationSet: [drifted] })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    } finally {
      store.close();
    }
  });

  it('rejects a non-sequential migration set before opening a transaction', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    const invalid: Migration = {
      version: 3,
      name: 'invalid-gap',
      statements: [],
      checksum: migrationChecksum([]),
    };
    try {
      await expect(migrateOperationalStore(store, { migrationSet: [invalid] })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
      await expect(
        store.execute({
          sql: "SELECT name FROM sqlite_schema WHERE name='soc_schema_migrations'",
        }),
      ).resolves.toMatchObject({ rows: [] });
    } finally {
      store.close();
    }
  });

  it('requires foreign-key enforcement before applying schema changes', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
      await store.execute({ sql: 'PRAGMA foreign_keys = OFF' });
      await expect(migrateOperationalStore(store)).rejects.toMatchObject({
        code: 'STORAGE_UNAVAILABLE',
      });
    } finally {
      store.close();
    }
  });
});
