import * as privateFiles from '../../src/billing/storage/private-files.js';
import { BillingDatabase } from '../../src/billing/storage/database.js';
import { ipcWorker } from '../support/ipc-worker.js';
import { lossyProxy } from '../support/lossy-proxy.js';
import { configuredOrganizations } from '../../src/billing/configuration/environment.js';
import { ConversationStorage } from '../../src/billing/storage/conversations.js';
import { removeConversationMigration } from '../support/billing.js';
import { LocalBillingProvider } from '../../src/billing/providers/local/index.js';
import { createImageApplication } from '../support/image-application.js';
import { readFile, stat, writeFile, unlink, link, symlink, realpath } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import filesystem from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { privateWorkflowFiles, verifyPrivateFiles, privateDirectory } from '../../src/billing/storage/private-files.js';
import { join } from 'node:path';
import { setupLocal } from '../../scripts/setup.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { readLocalProfiles } from '../../src/billing/providers/local/profiles.js';
import { imageBoundary } from '../support/images.js';
import { billingSocket } from '../support/http.js';
import { createBillingApp } from '../../src/billing/server/routes.js';
import { setTimeout } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeBilling } from '../../src/billing/configuration/providers.js';
import { LocalBillingStorage } from '../../src/billing/providers/local/storage.js';
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

it('explicit database URLs reject shared-write directories before opening SQLite', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const environment = { BILLING_MODE: 'local', BILLING_PROVIDER: 'local', BILLING_DATABASE_URL: database.url };
  await filesystem.chmod(database.directory, 0o770);
  await expect(
    configuredOrganizations(environment).then(organizations => {
      cleanups.push(() => organizations.close());
      return organizations;
    }),
  ).rejects.toMatchObject({ code: 'storage_unavailable' });
  await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
  await filesystem.chmod(database.directory, 0o700);
  const organizations = await configuredOrganizations(environment);
  cleanups.push(() => organizations.close());
  const owner = await organizations.provisionLocal({ profileId: 'private-directory', displayName: 'Owner' });
  expect(await organizations.context({ credential: owner.credential! })).toMatchObject({ actorId: owner.identity.id });
  await filesystem.chmod(database.directory, 0o770);
  await expect(organizations.context({ credential: owner.credential! })).rejects.toMatchObject({
    code: 'storage_unavailable',
  });
  await filesystem.chmod(database.directory, 0o700);
  expect(await organizations.context({ credential: owner.credential! })).toMatchObject({ actorId: owner.identity.id });
});

describe('local billing storage', () => {
  it('private storage rejects Windows with an explicit platform error', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    try {
      for (const operation of [
        () => privateWorkflowFiles(database.filename),
        () => verifyPrivateFiles(database.filename),
        () => privateDirectory(database.directory),
      ])
        await expect(operation()).rejects.toThrow('Unsupported platform: this template requires macOS or Linux');
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }
    await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });

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
      [1n, 2n, 3n, 4n, 5n, 6n].map(version => ({ version, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) })),
    );
    expect((await observer.execute('PRAGMA user_version')).rows[0].user_version).toBe(6n);
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
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const write = BillingDatabase.prototype.write;
    let injected = false;
    const failure = vi.spyOn(BillingDatabase.prototype, 'write');
    failure.mockImplementation(async function (this: BillingDatabase, operation, validateSchema) {
      return write.call(
        this,
        async tx => {
          const execute = tx.execute.bind(tx);
          tx.execute = async statement => {
            const sql = typeof statement === 'string' ? statement : statement.sql;
            if (sql.startsWith('INSERT INTO billing_migrations')) {
              expect((await execute("SELECT name FROM sqlite_schema WHERE name = 'billing_accounts'")).rows).toEqual([
                { name: 'billing_accounts' },
              ]);
              injected = true;
              throw new Error('Migration write failed');
            }
            return execute(statement);
          };
          try {
            return await operation(tx);
          } finally {
            tx.execute = execute;
          }
        },
        validateSchema,
      );
    });
    try {
      await expect(LocalBillingStorage.open({ url: database.url })).rejects.toMatchObject({
        code: 'storage_unavailable',
      });
    } finally {
      failure.mockRestore();
    }
    expect(injected).toBe(true);
    const observer = await independentClient(database.url);
    cleanups.push(() => observer.close());
    expect((await observer.execute('PRAGMA user_version')).rows[0].user_version).toBe(0n);
    expect((await observer.execute("SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'")).rows).toEqual([]);
    const retried = await LocalBillingStorage.open({ url: database.url });
    retried.close();
    expect((await observer.execute('SELECT version FROM billing_migrations ORDER BY version')).rows).toEqual(
      [1n, 2n, 3n, 4n, 5n, 6n].map(version => ({ version })),
    );
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

it('setup recovers a provisioned profile after interruption without resetting existing balances', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const environment = {
    MASTRA_PROJECT_ROOT: database.directory,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    BILLING_DATABASE_URL: database.url,
  };
  const provision = OrganizationService.prototype.provisionLocal;
  let interrupted: Awaited<ReturnType<OrganizationService['provisionLocal']>> | undefined;
  const stop = vi.spyOn(OrganizationService.prototype, 'provisionLocal');
  stop.mockImplementationOnce(async function (this: OrganizationService, ...args) {
    interrupted = await provision.call(this, ...args);
    throw new Error('Interrupted after committing the principal');
  });
  try {
    await expect(setupLocal(environment)).rejects.toThrow('Interrupted after committing the principal');
  } finally {
    stop.mockRestore();
  }
  expect(interrupted?.credential).toEqual(expect.any(String));
  const config = configuration();
  config.localAccounts[0].workspaceId = interrupted!.workspaceId;
  config.localAccounts[0].meters[0].balance = 30;
  const initialized = await initializeBilling({ configuration: config, storage: { url: database.url } });
  const account = await initialized.provider.ensureAccount({ workspaceId: interrupted!.workspaceId });
  await initialized.provider.reportUsage(usage(account, { units: 7 }));
  initialized.close();
  const recovered = await setupLocal(environment);
  expect(recovered.ready).toBe(true);
  expect(recovered.profiles.owner).toMatchObject({
    actorId: interrupted!.identity.id,
    workspaceId: interrupted!.workspaceId,
  });
  expect(recovered.profiles.owner!.credential).not.toBe(interrupted!.credential);
  const organizations = await configuredOrganizations(environment);
  cleanups.push(() => organizations.close());
  await expect(organizations.context({ credential: interrupted!.credential! })).rejects.toMatchObject({
    code: 'unauthenticated',
  });
  expect(await organizations.context({ credential: recovered.profiles.owner!.credential })).toMatchObject({
    actorId: interrupted!.identity.id,
  });
  expect(await setupLocal(environment)).toEqual(recovered);
  const manifestPath = join(database.directory, 'data', 'local-profiles.json');
  await unlink(manifestPath);
  await expect(setupLocal(environment)).rejects.toMatchObject({ code: 'state_unavailable' });
  await expect(stat(manifestPath)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await organizations.context({ credential: recovered.profiles.owner!.credential })).toMatchObject({
    actorId: interrupted!.identity.id,
  });
  await writeFile(manifestPath, JSON.stringify(recovered), { mode: 0o600 });
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  expect(
    (
      await observer.execute({
        sql: "SELECT balance, consumed FROM commercial_meters WHERE account_id = ? AND key = 'credits'",
        args: [account.id],
      })
    ).rows,
  ).toEqual([{ balance: 23n, consumed: 7n }]);
  expect((await observer.execute('SELECT COUNT(*) AS count FROM identities')).rows[0].count).toBe(3n);
});

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

it.each(['weather-credits', 'image-credits'])('configured %s remains available beside credits', async source => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const storage = await LocalBillingStorage.open({ url: database.url });
  cleanups.push(() => storage.close());
  const config = configuration();
  config.billingKeys.meters.push({ key: source, unit: 'credits', funding: ['prepaid'] });
  const seed = config.localAccounts[0];
  seed.meters = [
    { ...seed.meters[0], key: source, balance: 11 },
    { ...seed.meters[0], balance: 100 },
  ];
  const provider = new LocalBillingProvider(storage, config);
  const account = await provider.ensureAccount({ workspaceId: seed.workspaceId });
  await provider.ensureAccount({ workspaceId: seed.workspaceId });
  const snapshot = await provider.getState(account);
  expect(snapshot.meters.find(meter => meter.key === source)).toMatchObject({ confirmedBalance: 11, consumedUnits: 0 });
  expect(snapshot.meters.find(meter => meter.key === 'credits')).toMatchObject({
    confirmedBalance: 100,
    consumedUnits: 0,
  });
  const now = Date.now();
  const request = provider.reservations.prepareReservation({
    id: 'configured-meter',
    account,
    meter: source,
    units: 1,
    executionCutoff: now + 10000,
    confirmationCutoff: now + 20000,
    expiresAt: now + 30000,
  });
  expect(await provider.reservations.reserve(request)).toMatchObject({ status: 'reserved' });
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
  await removeConversationMigration(observer);
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

it('native invocation claims survive concurrent replay and reject changed input or message ownership', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const environment = {
    MASTRA_PROJECT_ROOT: database.directory,
    BILLING_DATABASE_URL: database.url,
    BILLING_PROVIDER: 'local',
    BILLING_MODE: 'local',
  };
  const profiles = await setupLocal(environment);
  const organizations = await configuredOrganizations(environment);
  cleanups.push(() => organizations.close());
  const context = await organizations.context({ credential: profiles.profiles.owner!.credential });
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  const historical = (await observer.execute('SELECT version, checksum FROM billing_migrations WHERE version < 4'))
    .rows;
  await removeConversationMigration(observer);
  let conversations = await ConversationStorage.open(database.url, organizations);
  expect((await observer.execute('SELECT version, checksum FROM billing_migrations WHERE version < 4')).rows).toEqual(
    historical,
  );
  const owner = await conversations.thread(context, 'assistant', 'durable-conversation', true);
  const input = {
    messageId: 'persisted-native-user-message',
    toolCallId: 'native-call',
    resourceId: 'business-agent',
    action: 'generate',
    input: { prompt: 'Create this exact artifact' },
  };
  for (let round = 0; round < 20; round++) {
    const invocation = { ...input, toolCallId: `native-call-${round}` };
    const claims = await Promise.all([
      conversations.claim(context, owner, invocation),
      conversations.claim(context, owner, invocation),
    ]);
    expect(claims.filter(claim => claim.claimed)).toHaveLength(1);
    expect(claims[0].id).toBe(claims[1].id);
    expect(claims[0].requestKey).toBe(claims[1].requestKey);
    await expect(
      conversations.claim(context, owner, { ...invocation, input: { prompt: 'Changed input' } }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      conversations.claim(context, owner, { ...invocation, messageId: 'another-native-message' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  }
  const original = await conversations.claim(context, owner, input);
  conversations.close();
  conversations = await ConversationStorage.open(database.url, organizations);
  cleanups.push(() => conversations.close());
  expect(await conversations.claim(context, owner, input)).toEqual({ ...original, claimed: false });
  const next = await conversations.claim(context, owner, { ...input, toolCallId: 'new-native-call' });
  expect(next.id).not.toBe(original.id);
  expect(next.requestKey).not.toBe(original.requestKey);
  const recovered = await conversations.list(context, owner, 'business-agent');
  expect(recovered).toHaveLength(20);
  expect(recovered[0].id).toBe(next.id);
  expect(await conversations.list(context, owner, 'another-resource')).toEqual([]);
  const member = await organizations.context({ credential: profiles.profiles.member!.credential });
  await expect(conversations.thread(member, 'assistant', owner.threadId)).rejects.toMatchObject({ code: 'forbidden' });
  await expect(conversations.list(member, owner, 'business-agent')).rejects.toMatchObject({ code: 'forbidden' });
  await expect(observer.execute('DELETE FROM billing_studio_operations')).rejects.toBeDefined();
  expect((await observer.execute('SELECT COUNT(*) AS count FROM billing_studio_operations')).rows).toEqual([
    { count: 22n },
  ]);
  expect((await observer.execute('SELECT COUNT(*) AS count FROM billing_executions')).rows).toEqual([{ count: 0n }]);
});

it('IPC close waits for the live worker to release its resources and routes concurrent rounds', async () => {
  const worker = ipcWorker<{ type: string; round?: number; pid: number; value: string }>(
    new URL('../support/ipc-lifecycle-worker.mjs', import.meta.url),
    [],
  );
  cleanups.push(worker.close);
  const ready = await worker.wait('ready');
  worker.send({ type: 'echo', round: 1, value: 'first' });
  worker.send({ type: 'echo', round: 2, value: 'second' });
  expect(await worker.wait('echoed', 2)).toMatchObject({ value: 'second' });
  expect(await worker.wait('echoed', 1)).toMatchObject({ value: 'first' });
  await worker.close();
  expect(() => process.kill(ready.pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  await expect(worker.wait('missing')).rejects.toThrow('IPC worker exited');
});

it.each(['success', 'request failure', 'body failure'] as const)(
  'lossy forwarding closes sockets and reports %s through its awaited path',
  async scenario => {
    const upstream = await billingSocket({ fetch: () => new Response('upstream response') });
    cleanups.push(upstream.close);
    const target = scenario === 'request failure' ? `${upstream.url}/unreachable` : upstream.url;
    if (scenario === 'request failure') await upstream.close();
    const proxy = await lossyProxy(async () => {
      const remote = await fetch(target);
      if (scenario === 'body failure') await remote.body!.cancel();
      await remote.arrayBuffer();
    });
    cleanups.push(proxy.close);
    await expect(fetch(proxy.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow('fetch failed');
    if (scenario === 'success') await proxy.completed();
    else await expect(proxy.completed()).rejects.toThrow();
  },
);

it.each(['separators', 'parent symlink'] as const)(
  'database preparation resolves %s aliases without closing locked file descriptors',
  async alias => {
    const { database, account } = await fixture();
    const primary = await BillingDatabase.open({ url: database.url });
    cleanups.push(() => primary.close());
    const aliasDirectory = join(database.directory, 'parent-alias');
    if (alias === 'parent symlink') await symlink(await realpath(database.directory), aliasDirectory, 'dir');
    const filename = alias === 'separators' ? `${database.directory}//billing.db` : `${aliasDirectory}/billing.db`;
    const aliasUrl = `file://${filename}`;
    const prepare = privateFiles.privateWorkflowFiles;
    let held = false;
    const unsafeOpens: string[] = [];
    const opening = vi.spyOn(privateFiles, 'privateWorkflowFiles').mockImplementation(async filename => {
      if (held) unsafeOpens.push(filename);
      return prepare(filename);
    });
    try {
      for (let round = 0; round < 20; round++) {
        let enter!: () => void, release!: () => void;
        const entered = new Promise<void>(resolve => {
          enter = resolve;
        });
        const released = new Promise<void>(resolve => {
          release = resolve;
        });
        const transaction = primary
          .write(async tx => {
            await tx.execute({
              sql: 'UPDATE commercial_state SET version = version + 1 WHERE account_id = ?',
              args: [account.id],
            });
            held = true;
            enter();
            await released;
            held = false;
          })
          .then(
            () => undefined,
            error => {
              enter();
              return error;
            },
          );
        await entered;
        const other = BillingDatabase.open({ url: aliasUrl }).then(
          value => ({ value }),
          error => ({ error }),
        );
        try {
          await setTimeout(30);
        } finally {
          release();
        }
        const transactionError = await transaction;
        const result = await other;
        if ('value' in result) result.value.close();
        expect(unsafeOpens).toEqual([]);
        expect(transactionError).toBeUndefined();
        expect(result).not.toHaveProperty('error');
      }
    } finally {
      held = false;
      opening.mockRestore();
    }
  },
);

it('IPC replies continue after a worker writes more stdout than a pipe can buffer', async () => {
  const worker = ipcWorker<{ type: string; round?: number }>(
    new URL('../support/ipc-lifecycle-worker.mjs', import.meta.url),
    [],
  );
  cleanups.push(worker.close);
  await worker.wait('ready');
  worker.send({ type: 'flood', round: 1 });
  const reply = await Promise.race([
    worker.wait('flushed', 1),
    setTimeout(2000).then(() => {
      throw new Error('Worker stdout blocked the IPC reply');
    }),
  ]);
  expect(reply).toMatchObject({ type: 'flushed', round: 1 });
});
