import { removeDriverMigration } from '../support/billing.js';
import { setTimeout } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeBilling } from '../../src/billing/setup.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { configuration, independentClient, temporaryDatabase, usage } from '../support/billing.js';
import { processWriter } from '../support/process-writer.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture() {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const billing = await initializeBilling({ configuration: configuration(), storage: { url: database.url } });
  cleanups.push(billing.close);
  const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  return { database, billing, account, observer };
}

describe('local billing storage', () => {
  it('independent readers cannot strand a usage commit or retain a partial debit', async () => {
    const { billing, account, observer } = await fixture();
    const reader = await observer.transaction('deferred');
    try {
      expect(
        (await reader.execute("SELECT balance FROM commercial_meters WHERE key = 'credits'")).rows[0].balance,
      ).toBe(100n);
      expect(await billing.provider.reportUsage(usage(account))).toEqual({ status: 'accepted', eventId: 'event-1' });
      expect(
        (await reader.execute("SELECT balance FROM commercial_meters WHERE key = 'credits'")).rows[0].balance,
      ).toBe(100n);
      await reader.commit();
    } finally {
      reader.close();
    }
    expect(
      (await observer.execute("SELECT balance, consumed FROM commercial_meters WHERE key = 'credits'")).rows,
    ).toEqual([{ balance: 97n, consumed: 3n }]);
    expect((await observer.execute('SELECT id FROM immutable_usage')).rows).toEqual([{ id: 'event-1' }]);
    expect((await observer.execute('PRAGMA journal_mode')).rows[0].journal_mode).toBe('wal');
  });

  it('failed accounting transaction leaves no partial records', async () => {
    const { billing, account, observer, database } = await fixture();
    // A real late CHECK failure follows usage insertion and the meter debit.
    await observer.execute({
      sql: 'UPDATE commercial_state SET version = ? WHERE account_id = ?',
      args: [BigInt(Number.MAX_SAFE_INTEGER), account.id],
    });
    await expect(billing.provider.reportUsage(usage(account))).rejects.toMatchObject({ code: 'storage_unavailable' });
    billing.close();
    const reopened = await LocalBillingStorage.open({ url: database.url });
    cleanups.push(() => reopened.close());
    const state = await reopened.getState(account);
    expect(state.meters[0]).toMatchObject({ confirmedBalance: 100, consumedUnits: 0 });
    expect(state.evidence).toEqual({ version: String(Number.MAX_SAFE_INTEGER) });
    expect((await observer.execute('SELECT COUNT(*) AS count FROM immutable_usage')).rows[0].count).toBe(0n);
    expect(
      (await observer.execute("SELECT balance, consumed FROM commercial_meters WHERE key = 'credits'")).rows,
    ).toEqual([{ balance: 100n, consumed: 0n }]);
  });

  it('rolls back event claims when metered totals would overflow safe integers', async () => {
    const { billing, account, observer } = await fixture();
    await observer.execute({
      sql: "UPDATE commercial_meters SET consumed = ? WHERE account_id = ? AND key = 'tokens'",
      args: [BigInt(Number.MAX_SAFE_INTEGER), account.id],
    });
    await expect(billing.provider.reportUsage(usage(account, { meter: 'tokens', units: 1 }))).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect((await observer.execute('SELECT COUNT(*) AS count FROM immutable_usage')).rows[0].count).toBe(0n);
    expect((await billing.provider.getState(account)).meters.find(meter => meter.key === 'tokens')?.consumedUnits).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect((await billing.provider.getState(account)).evidence).toEqual({ version: '0' });
  });

  it('enforces immutable history, account uniqueness, foreign keys and integer constraints', async () => {
    const { billing, account, observer } = await fixture();
    await billing.provider.reportUsage(usage(account));
    await expect(observer.execute("UPDATE immutable_usage SET units = 9 WHERE id = 'event-1'")).rejects.toMatchObject({
      extendedCode: 'SQLITE_CONSTRAINT_TRIGGER',
    });
    await expect(observer.execute("DELETE FROM immutable_usage WHERE id = 'event-1'")).rejects.toMatchObject({
      extendedCode: 'SQLITE_CONSTRAINT_TRIGGER',
    });
    await expect(
      observer.execute({
        sql: 'INSERT INTO billing_accounts (id, workspace_id, provider, external_reference) VALUES (?, ?, ?, ?)',
        args: ['other-id', 'team', 'local', 'different'],
      }),
    ).rejects.toMatchObject({ extendedCode: 'SQLITE_CONSTRAINT_UNIQUE' });
    await expect(
      observer.execute("INSERT INTO commercial_state (account_id, version) VALUES ('missing', 0)"),
    ).rejects.toMatchObject({ extendedCode: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
    await expect(
      observer.execute("UPDATE commercial_meters SET consumed = 0.5 WHERE key = 'credits'"),
    ).rejects.toMatchObject({ rawCode: 3091 });
    await expect(
      observer.execute("UPDATE commercial_meters SET balance = -1 WHERE key = 'credits'"),
    ).rejects.toMatchObject({ extendedCode: 'SQLITE_CONSTRAINT_CHECK' });
    expect((await observer.execute('SELECT units FROM immutable_usage')).rows).toEqual([{ units: 3n }]);
  });

  it.each(['newer history', 'checksum drift', 'unknown schema', 'version mismatch'] as const)(
    'rejects %s and preserves accounting history',
    async corruption => {
      const { database, billing, account, observer } = await fixture();
      await billing.provider.reportUsage(usage(account));
      billing.close();
      if (corruption === 'newer history') {
        await observer.execute(
          "INSERT INTO billing_migrations (version, checksum, applied_at) VALUES (15, 'unknown', '2026-11-06T00:00:00Z')",
        );
        await observer.execute('PRAGMA user_version = 15');
      } else if (corruption === 'checksum drift')
        await observer.execute("UPDATE billing_migrations SET checksum = 'changed'");
      else if (corruption === 'unknown schema')
        await observer.execute('CREATE TABLE unexpected (id TEXT PRIMARY KEY) STRICT');
      else await observer.execute('PRAGMA user_version = 0');
      await expect(LocalBillingStorage.open({ url: database.url })).rejects.toMatchObject({
        code: 'storage_incompatible',
      });
      expect((await observer.execute('SELECT id, units FROM immutable_usage')).rows).toEqual([
        { id: 'event-1', units: 3n },
      ]);
      expect(
        (await observer.execute("SELECT balance FROM commercial_meters WHERE key = 'credits'")).rows[0].balance,
      ).toBe(97n);
    },
  );

  it('migrates a fresh file once and preserves unrelated incompatible files', async () => {
    const { billing, database, observer } = await fixture();
    billing.close();
    const reopened = await LocalBillingStorage.open({ url: database.url });
    cleanups.push(() => reopened.close());
    const history = await observer.execute('SELECT version, checksum FROM billing_migrations');
    expect(history.rows).toEqual([
      { version: 1n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 2n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 3n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 4n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 5n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 6n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 7n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 8n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 9n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 10n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 11n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 12n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 13n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 14n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
    expect((await observer.execute('PRAGMA user_version')).rows[0].user_version).toBe(14n);
    const foreignDatabase = await temporaryDatabase();
    cleanups.push(foreignDatabase.cleanup);
    const foreignClient = await independentClient(foreignDatabase.url);
    cleanups.push(() => foreignClient.close());
    await foreignClient.execute('CREATE TABLE important_data (value TEXT) STRICT');
    await foreignClient.execute("INSERT INTO important_data VALUES ('retain')");
    await expect(LocalBillingStorage.open({ url: foreignDatabase.url })).rejects.toMatchObject({
      code: 'storage_incompatible',
    });
    expect((await foreignClient.execute('SELECT value FROM important_data')).rows).toEqual([{ value: 'retain' }]);
    expect(
      (await foreignClient.execute("SELECT name FROM sqlite_schema WHERE name = 'billing_migrations'")).rows,
    ).toEqual([]);
  });

  it('rejects remote, ephemeral and credential-bearing database configuration', async () => {
    for (const url of [
      'libsql://example.com',
      'https://example.com',
      'file::memory:',
      'file:///tmp/billing.db?authToken=secret',
      'file://host/tmp/billing.db',
    ])
      await expect(LocalBillingStorage.open({ url })).rejects.toMatchObject({ code: 'invalid_configuration' });
  });

  it('failed migration rolls back schema changes and migration history together', async () => {
    const { billing, observer, database } = await fixture();
    billing.close();
    await observer.execute('PRAGMA foreign_keys = OFF');
    const objects = await observer.execute(
      "SELECT name, type FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name != 'billing_migrations' AND type IN ('table', 'trigger') ORDER BY type DESC",
    );
    for (const row of objects.rows)
      await observer.execute(
        `DROP ${row.type === 'trigger' ? 'TRIGGER' : 'TABLE'} "${String(row.name).replaceAll('"', '""')}"`,
      );
    await observer.execute('DELETE FROM billing_migrations');
    await observer.execute('PRAGMA user_version = 0');
    await observer.execute(
      "CREATE TRIGGER refuse_migration BEFORE INSERT ON billing_migrations BEGIN SELECT RAISE(ABORT, 'Migration write failed'); END",
    );
    await observer.execute('PRAGMA foreign_keys = ON');
    await expect(LocalBillingStorage.open({ url: database.url })).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect((await observer.execute('SELECT version FROM billing_migrations')).rows).toEqual([]);
    expect((await observer.execute('PRAGMA user_version')).rows[0].user_version).toBe(0n);
    expect(
      (await observer.execute("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).rows,
    ).toEqual([{ name: 'billing_migrations' }]);
    expect((await observer.execute("SELECT name FROM sqlite_schema WHERE type = 'trigger'")).rows).toEqual([
      { name: 'refuse_migration' },
    ]);
  });

  it('independent processes claim replayed events once and cannot overspend shared credit', async () => {
    const { database, billing, account, observer } = await fixture();
    const writers = [processWriter(database.url), processWriter(database.url)];
    cleanups.push(...writers.map(writer => writer.close));
    await Promise.all(writers.map(writer => writer.wait('ready')));
    for (let round = 0; round < 21; round++) {
      const barrier = await observer.transaction('write');
      try {
        for (const [index, writer] of writers.entries())
          writer.claim(
            round,
            usage(account, {
              id: round === 20 ? `last-${index}` : `race-${round}`,
              executionId: `run-${round}`,
              units: round === 20 ? 30 : 3,
            }),
          );
        const attempts = await Promise.all(writers.map(writer => writer.wait('attempting', round)));
        expect(attempts.map(attempt => attempt.contended)).toEqual([true, true]);
        // Both processes attempt SQL while an independent connection holds the
        // write lock; their complete domain transactions must retry safely.
        await setTimeout(100);
        await barrier.commit();
      } finally {
        barrier.close();
      }
      const statuses = (await Promise.all(writers.map(writer => writer.wait('result', round))))
        .map(result => result.status)
        .sort();
      expect(statuses).toEqual(round === 20 ? ['accepted', 'insufficient_credits'] : ['accepted', 'duplicate']);
    }
    const state = await billing.provider.getState(account);
    expect(state.meters[0]).toMatchObject({ confirmedBalance: 10, consumedUnits: 90 });
    expect(state.evidence).toEqual({ version: '21' });
    expect((await observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM immutable_usage')).rows).toEqual(
      [{ count: 21n, units: 90n }],
    );
  }, 60_000);
  it('additive provider migration preserves existing local usage and migration checksums', async () => {
    const { billing, account, observer, database } = await fixture();
    await billing.provider.reportUsage(usage(account));
    billing.close();
    const checksums = (
      await observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 4 ORDER BY version')
    ).rows;
    await removeDriverMigration(observer);
    // Reconstruct the previously shipped v4 schema while retaining its actual
    // local account, immutable usage and meter debit. No production reset API.
    for (const table of [
      'billing_catalog',
      'billing_usage_bindings',
      'billing_expiry_recovery',
      'billing_refresh_leases',
      'billing_inbox',
      'billing_account_sync',
      'billing_delivery',
      'billing_runtimes',
    ])
      await observer.execute(`DROP TABLE ${table}`);
    await observer.execute('ALTER TABLE billing_executions DROP COLUMN recovery_fenced');
    await observer.execute('DELETE FROM billing_migrations WHERE version >= 6');
    for (const table of ['provider_usage', 'hosted_operations', 'grant_allocations', 'credit_grants', 'provider_links'])
      await observer.execute(`DROP TABLE ${table}`);
    await observer.execute('ALTER TABLE billing_accounts DROP COLUMN effective_provider');
    await observer.execute('DELETE FROM billing_migrations WHERE version = 5');
    await observer.execute('PRAGMA user_version = 4');
    const upgraded = await LocalBillingStorage.open({ url: database.url });
    cleanups.push(() => upgraded.close());
    expect(await upgraded.ensureAccount({ workspaceId: 'team' })).toEqual(account);
    expect((await upgraded.getState(account)).meters[0]).toMatchObject({ confirmedBalance: 97, consumedUnits: 3 });
    expect(
      (await observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 4 ORDER BY version'))
        .rows,
    ).toEqual(checksums);
    expect((await observer.execute('SELECT id, units FROM immutable_usage')).rows).toEqual([
      { id: 'event-1', units: 3n },
    ]);
    expect((await observer.execute('PRAGMA foreign_key_check')).rows).toEqual([]);
    expect((await observer.execute('PRAGMA user_version')).rows[0].user_version).toBe(14n);
  });
});
