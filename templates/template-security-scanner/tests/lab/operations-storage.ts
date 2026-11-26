import { createClient } from '@libsql/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { loadSettings } from '../../src/config/settings.js';
import { INSTANCE_DATABASE_NAME } from '../../src/config/storage-names.js';
import { acquireInstance } from '../../src/discovery/instance.js';
import { InvestigationStore, type OwnedResource } from '../../src/investigation/store.js';
import { startControlPlane } from '../../src/http/server.js';
import { createBackup, drainOffline, operationStatus, restoreBackup } from '../../src/runtime/operations.js';

/** Recreate the actual historical schema3 table on an isolated fixture copy. */
export async function legacyResourceSchema(url: string) {
  const db = createClient({ url });
  const tx = await db.transaction('write');
  try {
    await tx.execute('DROP TABLE IF EXISTS scanner_current_owned_resources');
    await tx.execute('ALTER TABLE scanner_owned_resources RENAME TO scanner_resources_fixture_source');
    await tx.execute(`CREATE TABLE scanner_owned_resources (
        id TEXT PRIMARY KEY,owner TEXT NOT NULL,target_id TEXT NOT NULL,category TEXT NOT NULL,path TEXT NOT NULL,
        data TEXT NOT NULL,UNIQUE(owner,target_id,category,path))`);
    await tx.execute(
      'INSERT INTO scanner_owned_resources SELECT id,owner,target_id,category,path,data FROM scanner_resources_fixture_source',
    );
    await tx.execute('DROP TABLE scanner_resources_fixture_source');
    await tx.execute('DELETE FROM scanner_migrations WHERE version=4');
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
    db.close();
  }
}

/** Create a compatible legacy database pair for real restore and rollback tests. */
async function legacyBackupPair(settings: ReturnType<typeof loadSettings>, sourceName: string, name: string) {
  const source = join(settings.dataDirectory, 'backups', sourceName);
  const directory = join(settings.dataDirectory, 'backups', name);
  await mkdir(directory, { mode: 0o700 });
  for (const file of ['application.db', 'native.db']) {
    await copyFile(join(source, file), join(directory, file));
    await chmod(join(directory, file), 0o600);
  }
  const application = join(directory, 'application.db');
  await legacyResourceSchema(`file:${application}`);
  const db = createClient({ url: `file:${application}` });
  let schemaHash: string;
  try {
    const schema = await db.execute(
      "SELECT name,type,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND name!='scanner_operation_cleanup_cursor' ORDER BY type,name",
    );
    schemaHash = createHash('sha256').update(JSON.stringify(schema.rows)).digest('hex');
  } finally {
    db.close();
  }
  const content = await readFile(application);
  const original = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  const manifest = {
    ...original,
    applicationSchema: 3,
    application: {
      sha256: createHash('sha256').update(content).digest('hex'),
      bytes: content.length,
      schemaHash,
    },
  };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest), { mode: 0o600 });
  return manifest;
}

/** Interrupt and recover a two-file restore while preserving both compatible databases. */
export async function compatiblePairRollback(databaseStem = 'security-scanner') {
  const root = await mkdtemp(join(tmpdir(), 'scanner-restore-'));
  const settings = loadSettings(
    { DATABASE_URL: `file:./data/${databaseStem}.db`, CONTROL_BOOTSTRAP_SECRET: randomBytes(32).toString('base64url') },
    root,
  );
  let runtime: Awaited<ReturnType<typeof startControlPlane>> | undefined;
  let cookie = '',
    csrf = '';
  const start = async () => {
    runtime = await startControlPlane(settings, 0);
    const response = await fetch(`${runtime.url}/api/session`, {
      method: 'POST',
      headers: { origin: runtime.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
    });
    expect(response.status).toBe(201);
    cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    csrf = ((await response.json()) as { csrfToken: string }).csrfToken;
  };
  const policy = async (name: string) => {
    const response = await fetch(`${runtime!.url}/api/policies`, {
      method: 'POST',
      headers: { origin: runtime!.url, cookie, 'x-csrf-token': csrf, 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        permittedMethods: ['GET'],
        scanLimits: { maxRequests: 10, maxDurationSeconds: 30, maxResponseBytes: 8192, maxConcurrency: 1 },
        retention: { evidenceDays: 1, approvedBy: 'local-operator' },
      }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as { id: string };
  };
  const getPolicy = async (id: string) =>
    fetch(`${runtime!.url}/api/policies/${id}`, { headers: { origin: runtime!.url, cookie } });
  const thread = async (id: string) => {
    const memory = await runtime!.storage.getStore('memory');
    await memory!.saveThread({
      thread: { id, resourceId: 'local-operator', title: id, createdAt: new Date(), updatedAt: new Date() },
    });
  };
  const pairHash = async () =>
    Promise.all(
      [settings.databasePath, settings.mastraDatabasePath].map(async path =>
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      ),
    );
  try {
    await start();
    const fence = createClient({ url: `file:${join(settings.dataDirectory, INSTANCE_DATABASE_NAME)}` });
    let historicalToken: string;
    try {
      historicalToken = String((await fence.execute('SELECT token FROM scanner_local_instance')).rows[0]!.token);
    } finally {
      fence.close();
    }
    await expect(acquireInstance(settings)).rejects.toMatchObject({ code: 'INSTANCE_ACTIVE' });
    await expect(restoreBackup(settings, 'known-good')).rejects.toMatchObject({ code: 'INSTANCE_ACTIVE' });
    const first = await policy('Before backup');
    await thread('before-backup');
    await expect(createBackup(settings, 'live-blocked')).rejects.toMatchObject({ code: 'INSTANCE_ACTIVE' });
    await runtime!.close();
    runtime = undefined;
    expect((await drainOffline(settings)).state).toBe('DRAINED');
    const fixtureTarget = randomUUID(),
      fixtureApproval = randomUUID();
    const restoreState = createClient({ url: settings.databaseUrl });
    try {
      // Snapshot fixtures exercise persisted restoration state independently
      // of the real approval/lease crash journey in the same shared suite.
      await restoreState.execute({
        sql: 'INSERT INTO scanner_approvals(id,job_id,investigation_id,owner,decision,revision,data) VALUES (?,?,?,?,?,?,?)',
        args: [
          fixtureApproval,
          randomUUID(),
          randomUUID(),
          'local-operator',
          'approved',
          1,
          JSON.stringify({ decision: 'approved', revision: 1 }),
        ],
      });
      await restoreState.execute({
        sql: 'INSERT INTO scanner_recurrences(target_id,owner,revision,enabled,next_at,data) VALUES (?,?,?,?,?,?)',
        args: [
          fixtureTarget,
          'local-operator',
          1,
          1,
          '2100-01-01T00:00:00.000Z',
          JSON.stringify({ targetId: fixtureTarget, enabled: true, revision: 1, nextAt: '2100-01-01T00:00:00.000Z' }),
        ],
      });
      await restoreState.execute({
        sql: "INSERT INTO scanner_recurrence_events(id,target_id,owner,occurred_at,state) VALUES (?,?,?,?, 'PENDING')",
        args: [randomUUID(), fixtureTarget, 'local-operator', new Date().toISOString()],
      });
    } finally {
      restoreState.close();
    }
    const resourceStore = new InvestigationStore(settings.databaseUrl);
    await resourceStore.initialize();
    const resource: OwnedResource = {
      id: randomUUID(),
      owner: 'local-operator',
      targetId: fixtureTarget,
      targetRevision: 1,
      policyRevision: 1,
      profileRevisions: [],
      category: 'cors',
      path: '/owned/cors/patched',
      publicProfileId: randomUUID(),
      marker: 'LAB_MARKER_BACKUPRESOURCE01',
      createdAt: new Date().toISOString(),
    };
    await resourceStore.bindOwnedResource(resource);
    const hypothesisId = randomUUID(),
      hypothesisData = JSON.stringify({ id: hypothesisId, resourceBindingId: resource.id, state: 'BLOCKED' });
    await resourceStore.write(async tx => {
      await tx.execute({
        sql: 'INSERT INTO scanner_hypotheses(id,investigation_id,owner,scan_id,role,policy_revision,dedup_key,state,data) VALUES (?,?,?,?,?,?,?,?,?)',
        args: [
          hypothesisId,
          randomUUID(),
          'local-operator',
          randomUUID(),
          'dupin',
          1,
          randomUUID(),
          'BLOCKED',
          hypothesisData,
        ],
      });
    });
    await createBackup(settings, 'legacy-source');
    const legacyManifest = await legacyBackupPair(settings, 'legacy-source', 'legacy-good');
    const renewed = { ...resource, id: randomUUID(), targetRevision: 2 };
    await resourceStore.bindOwnedResource(renewed);
    await resourceStore.close();
    const manifest = await createBackup(settings, 'known-good');
    expect(manifest.applicationSchema).toBe(4);
    for (const file of ['application.db', 'native.db']) {
      const snapshot = join(settings.dataDirectory, 'backups/known-good', file);
      const inspected = createClient({ url: `file:${snapshot}` });
      try {
        expect(
          (await inspected.execute("SELECT name FROM sqlite_master WHERE name='scanner_local_instance'")).rows,
        ).toEqual([]);
      } finally {
        inspected.close();
      }
      expect((await readFile(snapshot)).includes(Buffer.from(historicalToken))).toBe(false);
    }
    await start();
    const later = await policy('After backup');
    await thread('after-backup');
    await runtime!.close();
    runtime = undefined;
    const manifestPath = join(settings.dataDirectory, 'backups/known-good/manifest.json');
    const original = await readFile(manifestPath, 'utf8');
    const hashes = await pairHash();
    await writeFile(manifestPath, JSON.stringify({ ...JSON.parse(original), coreVersion: 'incompatible-code' }), {
      mode: 0o600,
    });
    await expect(restoreBackup(settings, 'known-good')).rejects.toMatchObject({ code: 'BACKUP_CODE_INCOMPATIBLE' });
    expect(await pairHash()).toEqual(hashes);
    await writeFile(manifestPath, original, { mode: 0o600 });
    const applicationSnapshot = join(settings.dataDirectory, 'backups/known-good/application.db');
    const originalSnapshot = await readFile(applicationSnapshot);
    await writeFile(applicationSnapshot, Buffer.concat([originalSnapshot, Buffer.from('tampered-backup')]), {
      mode: 0o600,
    });
    await expect(restoreBackup(settings, 'known-good')).rejects.toMatchObject({ code: 'BACKUP_HASH_MISMATCH' });
    expect(await pairHash()).toEqual(hashes);
    await writeFile(applicationSnapshot, originalSnapshot, { mode: 0o600 });
    const unsupported = createClient({ url: `file:${applicationSnapshot}` });
    try {
      await unsupported.execute('INSERT INTO scanner_migrations(version) VALUES (99)');
    } finally {
      unsupported.close();
    }
    const changed = await readFile(applicationSnapshot);
    await writeFile(
      manifestPath,
      JSON.stringify({
        ...manifest,
        application: {
          ...manifest.application,
          sha256: createHash('sha256').update(changed).digest('hex'),
          bytes: changed.length,
        },
      }),
      { mode: 0o600 },
    );
    await expect(restoreBackup(settings, 'known-good')).rejects.toMatchObject({
      code: 'BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE',
    });
    expect(await pairHash()).toEqual(hashes);
    await writeFile(applicationSnapshot, originalSnapshot, { mode: 0o600 });
    await writeFile(manifestPath, original, { mode: 0o600 });
    const child = fork(resolve(import.meta.dirname, 'restore-worker.ts'), [root, 'known-good', databaseStem], {
      execArgv: ['--import', 'tsx'],
      env: { HOME: process.env.HOME, PATH: process.env.PATH },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('RESTORE_STAGE_TIMEOUT'));
      }, 15000);
      child.on('message', message => {
        const value = message as { stage?: string; error?: string };
        if (value.error) {
          clearTimeout(timer);
          reject(new Error(value.error));
        }
        if (value.stage === 'APPLICATION_SWAPPED') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    child.kill('SIGKILL');
    await exited;
    // Recovery runs while fenced, before either public SDK database opens.
    await start();
    expect((await getPolicy(later.id)).status).toBe(200);
    expect(
      await (await runtime!.storage.getStore('memory'))!.getThreadById({
        threadId: 'after-backup',
        resourceId: 'local-operator',
      }),
    ).toMatchObject({ title: 'after-backup' });
    expect((await operationStatus(settings)).state).toBe('RECOVERED_PREVIOUS_PAIR');
    await runtime!.close();
    runtime = undefined;
    expect(await restoreBackup(settings, 'known-good')).toMatchObject({
      state: 'RESTORED',
      schedulesPaused: true,
      approvalsInvalidated: true,
    });
    const releasedFence = createClient({ url: `file:${join(settings.dataDirectory, INSTANCE_DATABASE_NAME)}` });
    try {
      expect((await releasedFence.execute('SELECT pid,token FROM scanner_local_instance')).rows).toEqual([]);
    } finally {
      releasedFence.close();
    }
    const releaseNewInstance = await acquireInstance(settings);
    try {
      const newFence = createClient({ url: `file:${join(settings.dataDirectory, INSTANCE_DATABASE_NAME)}` });
      try {
        expect(String((await newFence.execute('SELECT token FROM scanner_local_instance')).rows[0]!.token)).not.toBe(
          historicalToken,
        );
      } finally {
        newFence.close();
      }
    } finally {
      await releaseNewInstance();
    }
    expect((await operationStatus(settings)).state).toBe('RESTORED');
    const restoredState = createClient({ url: settings.databaseUrl });
    try {
      expect((await restoredState.execute('SELECT id,data FROM scanner_owned_resources ORDER BY rowid')).rows).toEqual([
        { id: resource.id, data: JSON.stringify(resource) },
        { id: renewed.id, data: JSON.stringify(renewed) },
      ]);
      expect((await restoredState.execute('SELECT resource_id FROM scanner_current_owned_resources')).rows).toEqual([
        { resource_id: renewed.id },
      ]);
      expect(
        (await restoredState.execute({ sql: 'SELECT data FROM scanner_hypotheses WHERE id=?', args: [hypothesisId] }))
          .rows,
      ).toEqual([{ data: hypothesisData }]);
      const approval = (
        await restoredState.execute({
          sql: 'SELECT decision,revision,data FROM scanner_approvals WHERE id=?',
          args: [fixtureApproval],
        })
      ).rows[0]!;
      expect(approval.decision).toBe('expired');
      expect(approval.revision).toBe(2);
      expect(JSON.parse(String(approval.data))).toMatchObject({ decision: 'expired', revision: 2 });
      const recurrence = (
        await restoredState.execute({
          sql: 'SELECT enabled,revision,data FROM scanner_recurrences WHERE target_id=?',
          args: [fixtureTarget],
        })
      ).rows[0]!;
      expect(recurrence.enabled).toBe(0);
      expect(JSON.parse(String(recurrence.data))).toMatchObject({ enabled: false, revision: 2 });
      expect(
        (await restoredState.execute('SELECT state FROM scanner_recurrence_events')).rows.every(
          row => row.state === 'CANCELLED',
        ),
      ).toBe(true);
      const schedule = (await restoredState.execute('SELECT data FROM scanner_advisory_schedule WHERE singleton=1'))
        .rows[0]!;
      expect(JSON.parse(String(schedule.data)).paused).toBe(true);
    } finally {
      restoredState.close();
    }
    const nativeInspection = createClient({ url: settings.mastraDatabaseUrl });
    try {
      const rows = await nativeInspection.execute("SELECT id FROM mastra_threads WHERE id='after-backup'");
      console.log(
        JSON.stringify({
          nativePersistedAfterRestore: rows.rows,
          nativeFileMatchesSnapshot:
            createHash('sha256')
              .update(await readFile(settings.mastraDatabasePath))
              .digest('hex') === manifest.native.sha256,
        }),
      );
      expect(rows.rows).toEqual([]);
    } finally {
      nativeInspection.close();
    }
    await start();
    expect((await getPolicy(first.id)).status).toBe(200);
    expect((await getPolicy(later.id)).status).toBe(404);
    const memory = await runtime!.storage.getStore('memory');
    expect(await memory!.getThreadById({ threadId: 'before-backup', resourceId: 'local-operator' })).toMatchObject({
      title: 'before-backup',
    });
    expect(await memory!.getThreadById({ threadId: 'after-backup', resourceId: 'local-operator' })).toBeNull();
    expect((await operationStatus(settings)).state).toBe('RESTORED');
    await runtime!.close();
    runtime = undefined;
    const legacyPath = join(settings.dataDirectory, 'backups/legacy-good/application.db');
    const legacyBytes = await readFile(legacyPath);
    expect(await restoreBackup(settings, 'legacy-good')).toMatchObject({ state: 'RESTORED' });
    expect(await readFile(legacyPath)).toEqual(legacyBytes);
    expect(
      JSON.parse(await readFile(join(settings.dataDirectory, 'backups/legacy-good/manifest.json'), 'utf8')),
    ).toEqual(legacyManifest);
    const migrated = new InvestigationStore(settings.databaseUrl);
    await migrated.initialize();
    try {
      expect(await migrated.getOwnedResource(resource.id, 'local-operator')).toEqual(resource);
      expect(await migrated.ownedResource('local-operator', fixtureTarget, resource.category, resource.path)).toEqual(
        resource,
      );
      expect((await migrated.bindOwnedResource(renewed)).created).toBe(true);
    } finally {
      await migrated.close();
    }
    // Offline operations also accept a genuine schema3 live pair without
    // upgrading that live database just to derive a compatibility fingerprint.
    await restoreBackup(settings, 'legacy-good');
    await legacyResourceSchema(settings.databaseUrl);
    const liveLegacy = await readFile(settings.databasePath);
    expect((await createBackup(settings, 'offline-upgraded')).applicationSchema).toBe(4);
    expect(await readFile(settings.databasePath)).toEqual(liveLegacy);
    expect(await restoreBackup(settings, 'legacy-good')).toMatchObject({ state: 'RESTORED' });
    expect(await readFile(legacyPath)).toEqual(legacyBytes);
    await start();
    expect(
      await (await runtime!.storage.getStore('memory'))!.getThreadById({
        threadId: 'before-backup',
        resourceId: 'local-operator',
      }),
    ).toMatchObject({ title: 'before-backup' });
  } finally {
    await runtime?.close();
    await rm(root, { recursive: true, force: true });
  }
}
