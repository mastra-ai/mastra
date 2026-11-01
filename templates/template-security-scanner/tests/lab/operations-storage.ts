import { createClient } from '@libsql/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { loadSettings } from '../../src/config/settings.js';
import { startControlPlane } from '../../src/http/server.js';
import { createBackup, drainOffline, operationStatus, restoreBackup } from '../../src/runtime/operations.js';

export async function compatiblePairRollback() {
  const root = await mkdtemp(join(tmpdir(), 'scanner-restore-'));
  const settings = loadSettings({ CONTROL_BOOTSTRAP_SECRET: randomBytes(32).toString('base64url') }, root);
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
    const manifest = await createBackup(settings, 'known-good');
    expect(manifest.applicationSchema).toBe(3);
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
    const child = fork(resolve(import.meta.dirname, 'restore-worker.ts'), [root, 'known-good'], {
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
    const restoredState = createClient({ url: settings.databaseUrl });
    try {
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
  } finally {
    await runtime?.close();
    await rm(root, { recursive: true, force: true });
  }
}
