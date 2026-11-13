import { LocalBillingProvider } from '../../src/billing/providers/local.js';
import { createImageApplication } from '../support/image-application.js';
import { readFile, stat, writeFile, unlink, link, symlink } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import filesystem from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { privateWorkflowFiles } from '../../src/billing/storage/private-files.js';
import { join } from 'node:path';
import { setupLocal } from '../../scripts/setup.js';
import { readLocalProfiles } from '../../src/billing/local-profiles.js';
import { imageBoundary } from '../support/images.js';
import { billingSocket } from '../support/http.js';
import { createBillingApp } from '../../src/billing/server/routes.js';
import { setTimeout } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it.each(['wal', 'shm'] as const)(
    'a disappearing SQLite %s sidecar preserves restart and durable data',
    async sidecar => {
      const database = await temporaryDatabase();
      cleanups.push(database.cleanup);
      await privateWorkflowFiles(database.filename);
      const sql = await independentClient(database.url);
      cleanups.push(() => sql.close());
      await sql.execute('PRAGMA journal_mode = WAL');
      await sql.execute('CREATE TABLE restart_proof (value TEXT NOT NULL)');
      await sql.execute("INSERT INTO restart_proof VALUES ('durable before restart')");
      await sql.execute('PRAGMA wal_checkpoint(TRUNCATE)');
      const filename = `${database.filename}-${sidecar}`;
      expect((await stat(filename)).nlink).toBe(1);
      let removed = false;
      // Schedule a real unlink after the optional file is open but before fstat.
      // The decorator delegates to the real open; file handles and metadata stay real.
      const open = filesystem.open;
      const opening = vi.spyOn(filesystem, 'open').mockImplementation(async (...arguments_) => {
        const handle = await open(...arguments_);
        if (arguments_[0] === filename) {
          unlinkSync(filename);
          removed = true;
        }
        return handle;
      });
      syncBuiltinESMExports();
      try {
        await privateWorkflowFiles(database.filename);
      } finally {
        opening.mockRestore();
        syncBuiltinESMExports();
      }
      expect(removed).toBe(true);
      await expect(stat(filename)).rejects.toMatchObject({ code: 'ENOENT' });
      sql.close();
      const reopened = await independentClient(database.url);
      try {
        expect((await reopened.execute('SELECT value FROM restart_proof')).rows).toEqual([
          { value: 'durable before restart' },
        ]);
      } finally {
        reopened.close();
      }
    },
  );

  it.each(['main', 'wal', 'shm'] as const)('private %s files still reject live hardlinks and symlinks', async part => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const target = join(database.directory, 'other-private-file');
    await writeFile(target, 'must not change', { mode: 0o644 });
    const filename = part === 'main' ? database.filename : `${database.filename}-${part}`;
    for (const makeLink of [link, symlink]) {
      await privateWorkflowFiles(database.filename);
      if (part === 'main') await unlink(filename);
      await makeLink(target, filename);
      try {
        await expect(privateWorkflowFiles(database.filename)).rejects.toMatchObject({ code: 'storage_unavailable' });
        expect((await stat(target)).mode & 0o777).toBe(0o644);
        expect(await readFile(target, 'utf8')).toBe('must not change');
      } finally {
        await unlink(filename);
      }
    }
  });

  it('an unlinked main database is rejected rather than treated as an optional sidecar', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    await privateWorkflowFiles(database.filename);
    const open = filesystem.open;
    let removed = false;
    const opening = vi.spyOn(filesystem, 'open').mockImplementation(async (...arguments_) => {
      const handle = await open(...arguments_);
      if (arguments_[0] === database.filename) {
        unlinkSync(database.filename);
        removed = true;
      }
      return handle;
    });
    syncBuiltinESMExports();
    try {
      await expect(privateWorkflowFiles(database.filename)).rejects.toMatchObject({ code: 'storage_unavailable' });
    } finally {
      opening.mockRestore();
      syncBuiltinESMExports();
    }
    expect(removed).toBe(true);
    await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });

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

  it.each(['newer history', 'historical version', 'checksum drift', 'unknown schema', 'version mismatch'] as const)(
    'rejects %s and preserves accounting history',
    async corruption => {
      const { database, billing, account, observer } = await fixture();
      await billing.provider.reportUsage(usage(account));
      billing.close();
      if (corruption === 'newer history') {
        await observer.execute(
          "INSERT INTO billing_migrations (version, checksum, applied_at) VALUES (19, 'unknown', '2026-11-06T00:00:00Z')",
        );
        await observer.execute('PRAGMA user_version = 19');
      } else if (corruption === 'historical version') await observer.execute('PRAGMA user_version = 16');
      else if (corruption === 'checksum drift')
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
    expect(history.rows).toEqual(
      [1n, 2n, 3n].map(version => ({ version, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) })),
    );
    expect((await observer.execute('PRAGMA user_version')).rows[0].user_version).toBe(3n);
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
      code: 'storage_incompatible',
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
});

// Real setup, Mastra, Hono, SQL and restart; only the paid model API is controlled.
async function developmentFixture() {
  const directory = await temporaryDatabase();
  cleanups.push(directory.cleanup);
  const model = await imageBoundary();
  cleanups.push(model.close);
  const environment = {
    MASTRA_PROJECT_ROOT: directory.directory,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    OPENAI_API_KEY: 'controlled-not-live',
    OPENAI_BASE_URL: model.url,
  };
  const manifest = await setupLocal(environment);
  const observer = await independentClient(manifest.databaseUrl);
  cleanups.push(() => observer.close());
  let application = await createImageApplication({ environment });
  cleanups.push(() => application.close());
  let server = await billingSocket(
    createBillingApp({
      organizations: application.organizations,
      execution: application.execution,
      commercial: application.runtime.commercial,
    }),
  );
  cleanups.push(() => server.close());
  const owner = manifest.profiles.owner!;
  const call = async (path: string, body: unknown, key: string) => {
    const response = await fetch(`${server.url}/billing/workspaces/${owner.workspaceId}/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${owner.credential}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  const summary = () => call('agents/image-agent/generate', { prompt: 'A blue bird' }, 'retained-summary');
  return {
    directory,
    model,
    environment,
    manifest,
    observer,
    summary,
    call,
    restart: async () => {
      await server.close();
      await application.close();
      application = await createImageApplication({ environment });
      server = await billingSocket(
        createBillingApp({
          organizations: application.organizations,
          execution: application.execution,
          commercial: application.runtime.commercial,
        }),
      );
    },
    stop: async () => {
      await server.close();
      await application.close();
    },
  };
}

it('setup reports an existing lock without deleting it and resumes after explicit recovery', async () => {
  const f = await developmentFixture();
  const lockPath = join(f.directory.directory, 'data/setup.lock');
  await writeFile(lockPath, String(process.pid), { mode: 0o600 });
  await expect(setupLocal(f.environment)).rejects.toThrow('Confirm that no setup process is running');
  expect(await readFile(lockPath, 'utf8')).toBe(String(process.pid));
  await unlink(lockPath);
  expect(await setupLocal(f.environment)).toEqual(f.manifest);
});

it('fresh development state starts without Polar and setup preserves spent credit', async () => {
  const f = await developmentFixture();
  expect(Object.values(f.manifest.profiles).map(profile => [profile!.name, profile!.organizationName])).toEqual([
    ['John', "John's Org"],
    ['Emma', "Emma's Org"],
    ['Alex', "Alex's Org"],
  ]);
  expect((await f.observer.execute('SELECT kind FROM workspaces ORDER BY id')).rows.map(row => row.kind)).toEqual([
    'personal',
    'personal',
    'personal',
  ]);
  const credentials = await readFile(join(f.directory.directory, 'data/local-profiles.json'));
  expect(await f.summary()).toMatchObject({
    status: 200,
    body: { result: { text: 'Image generated.' }, billing: { executionStatus: 'completed', billedUnits: 1 } },
  });
  const history = (await f.observer.execute('SELECT * FROM billing_ledger')).rows;
  await f.stop();
  expect(await setupLocal(f.environment)).toEqual(f.manifest);
  expect(await readFile(join(f.directory.directory, 'data/local-profiles.json'))).toEqual(credentials);
  expect(await readLocalProfiles(f.directory.directory)).toEqual(f.manifest);
  expect((await f.observer.execute('SELECT * FROM billing_ledger')).rows).toEqual(history);
  const balances = (
    await f.observer.execute(
      "SELECT a.workspace_id, m.balance FROM commercial_meters m JOIN billing_accounts a ON a.id = m.account_id WHERE m.key = 'credits'",
    )
  ).rows;
  expect(balances.find(row => row.workspace_id === f.manifest.profiles.owner!.workspaceId)?.balance).toBe(29n);
  expect(
    balances.filter(row => row.workspace_id !== f.manifest.profiles.owner!.workspaceId).map(row => row.balance),
  ).toEqual([30n, 30n]);
  expect(
    (
      await f.observer.execute(
        "SELECT name FROM sqlite_schema WHERE name IN ('credit_grants', 'grant_allocations', 'billing_source_owners', 'billing_provider_lifecycle', 'billing_account_sync', 'billing_inbox')",
      )
    ).rows,
  ).toEqual([]);
  await f.restart();
  expect(await f.summary()).toMatchObject({ status: 200, body: { billing: { replayed: true, billedUnits: 1 } } });
  expect((await f.observer.execute('SELECT * FROM billing_ledger')).rows).toEqual(history);
  expect(f.model.images).toHaveLength(1);
});

it('unsupported databases remain untouched and supported operation identities survive restart', async () => {
  const foreign = await temporaryDatabase();
  cleanups.push(foreign.cleanup);
  const client = await independentClient(foreign.url);
  await client.execute('CREATE TABLE important_data (value TEXT) STRICT');
  await client.execute("INSERT INTO important_data VALUES ('retain unsupported state')");
  client.close();
  const before = await readFile(foreign.filename);
  await expect(LocalBillingStorage.open({ url: foreign.url })).rejects.toMatchObject({ code: 'storage_incompatible' });
  expect(await readFile(foreign.filename)).toEqual(before);
  const f = await developmentFixture();
  const completed = await f.summary();
  const created = await f.call('workflows/image-kit/runs', {}, 'retained-report');
  const id = created.body.executionId;
  expect(
    await f.call(`workflows/image-kit/runs/${id}/start`, { inputData: { brief: 'A blue bird kit' } }, 'retained-start'),
  ).toMatchObject({
    status: 200,
    body: { result: { status: 'suspended' }, billing: { settlementStatus: 'reserved', billedUnits: null } },
  });
  const tables = [
    'billing_operations',
    'billing_ledger',
    'billing_remote_operations',
    'billing_admitted_accounts',
    'billing_workflow_operations',
    'billing_workflow_native_handoffs',
    'billing_reservations',
  ];
  const retained = async () =>
    Promise.all(tables.map(async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows));
  const history = await retained();
  const remote = (
    await f.observer.execute(
      'SELECT request, payload, reserve_evidence FROM billing_remote_operations WHERE execution_id = ?',
      [id],
    )
  ).rows[0];
  expect(JSON.parse(String(remote.request))).toMatchObject({
    id: `reserve:${id}`,
    account: { workspaceId: f.manifest.profiles.owner!.workspaceId },
  });
  expect(remote.reserve_evidence).not.toBeNull();
  await f.restart();
  expect(await retained()).toEqual(history);
  expect(await f.summary()).toMatchObject({
    status: 200,
    body: { billing: { executionId: completed.body.billing.executionId, replayed: true, billedUnits: 1 } },
  });
  expect((await f.call('workflows/image-kit/runs', {}, 'retained-report')).body.executionId).toBe(id);
  expect(await retained()).toEqual(history);
  expect(f.model.images).toHaveLength(1);
  expect((await f.observer.execute('PRAGMA foreign_key_check')).rows).toEqual([]);
});

it('v2 local credit names transition without refilling spent or unresolved accounts', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const legacy = configuration();
  legacy.billingKeys.meters[0].key = 'image-credits';
  legacy.resourcePolicies[0].policy.charge = { type: 'credits', meter: 'image-credits', units: 3 };
  legacy.localAccounts = ['spent', 'held'].map(workspaceId => ({
    ...legacy.localAccounts[0],
    workspaceId,
    meters: [{ key: 'image-credits', funding: 'prepaid', balance: 100, periodStart: null, periodEnd: null }],
  }));
  let storage = await LocalBillingStorage.open({ url: database.url });
  const old = new LocalBillingProvider(storage, legacy);
  const spent = await old.ensureAccount({ workspaceId: 'spent' });
  const held = await old.ensureAccount({ workspaceId: 'held' });
  await old.reportUsage(usage(spent, { meter: 'image-credits', units: 7 }));
  const now = Date.now();
  const reserve = old.reservations.prepareReservation({
    id: 'legacy-hold',
    account: held,
    meter: 'image-credits',
    units: 2,
    executionCutoff: now + 10_000,
    confirmationCutoff: now + 20_000,
    expiresAt: now + 30_000,
  });
  expect(await old.reservations.reserve(reserve)).toMatchObject({ status: 'reserved' });
  storage.close();
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  await observer.execute('DROP TABLE local_credit_migrations');
  await observer.execute('DELETE FROM billing_migrations WHERE version = 3');
  await observer.execute('PRAGMA user_version = 2');
  const history = (await observer.execute('SELECT * FROM immutable_usage')).rows;
  storage = await LocalBillingStorage.open({ url: database.url });
  cleanups.push(() => storage.close());
  const current = configuration();
  current.localAccounts = ['spent', 'held'].map(workspaceId => ({ ...current.localAccounts[0], workspaceId }));
  const provider = new LocalBillingProvider(storage, current);
  await provider.ensureAccount({ workspaceId: 'spent' });
  await provider.ensureAccount({ workspaceId: 'held' });
  expect((await provider.getState(spent)).meters).toMatchObject([
    { key: 'credits', confirmedBalance: 93, consumedUnits: 7 },
  ]);
  expect((await provider.getState(held)).meters.some(meter => meter.key === 'credits')).toBe(false);
  expect((await observer.execute('SELECT * FROM immutable_usage')).rows).toEqual(history);
  const release = old.reservations.prepareFinalization(
    { reservation: JSON.parse(reserve), action: 'release', units: 0 },
    reserve,
  );
  expect(await storage.finalize(release)).toMatchObject({ status: 'released' });
  await provider.ensureAccount({ workspaceId: 'held' });
  expect((await provider.getState(held)).meters).toMatchObject([
    { key: 'credits', confirmedBalance: 100, consumedUnits: 0 },
  ]);
  await observer.execute({
    sql: "DELETE FROM commercial_meters WHERE account_id = ? AND key = 'credits'",
    args: [spent.id],
  });
  await provider.ensureAccount({ workspaceId: 'spent' });
  expect((await provider.getState(spent)).meters.some(meter => meter.key === 'credits')).toBe(false);
  expect((await observer.execute('SELECT COUNT(*) AS count FROM local_credit_migrations')).rows[0].count).toBe(2n);
});
