import { createClient } from '@libsql/client';
import { LibSQLStore } from '@mastra/libsql';
import { mkdtemp, lstat, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import { initializeStorage } from '../src/http/server.js';
import { prepareDataDirectory } from '../src/runtime/files.js';
import { inspectStorageFiles } from '../src/runtime/storage-files.js';
import { randomUUID } from 'node:crypto';
import { DomainStore } from '../src/core/store.js';
import { DiscoveryStore } from '../src/discovery/store.js';
import { InvestigationStore, type OwnedResource } from '../src/investigation/store.js';
import { compatiblePairRollback, legacyResourceSchema } from './lab/operations-storage.js';

async function temporarySettings() {
  const root = await mkdtemp(join(tmpdir(), 'scanner-storage-'));
  return { root, settings: loadSettings({}, root) };
}

/** Persist a real native Mastra memory thread for storage separation and restore assertions. */
async function saveNativeThread(store: LibSQLStore, id: string) {
  const memory = await store.getStore('memory');
  if (!memory) throw new Error('NATIVE_MEMORY_STORE_MISSING');
  const timestamp = new Date();
  await memory.saveThread({
    thread: {
      id,
      resourceId: 'local-operator',
      title: 'Retained native state',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });
  return memory;
}

describe('separate native Mastra storage', () => {
  it('migrates_resource_history_atomically_and_serializes_current_selection_across_reopen', async () => {
    const { root, settings } = await temporarySettings();
    await prepareDataDirectory(settings);
    const domain = new DomainStore(settings.databaseUrl),
      discovery = new DiscoveryStore(settings.databaseUrl);
    await domain.initialize();
    await discovery.initialize();
    let store = new InvestigationStore(settings.databaseUrl);
    await store.initialize();
    const resource: OwnedResource = {
      id: randomUUID(),
      owner: 'local-operator',
      targetId: randomUUID(),
      targetRevision: 1,
      policyRevision: 1,
      profileRevisions: [],
      createdAt: new Date().toISOString(),
      category: 'cors',
      path: '/owned/cors',
      publicProfileId: randomUUID(),
      marker: 'LAB_MARKER_MIGRATION01',
    };
    try {
      await store.bindOwnedResource(resource);
      const hypothesisId = randomUUID(),
        hypothesisData = JSON.stringify({ id: hypothesisId, resourceBindingId: resource.id });
      await store.write(async tx => {
        await tx.execute({
          sql: 'INSERT INTO scanner_hypotheses(id,investigation_id,owner,scan_id,role,policy_revision,dedup_key,state,data) VALUES (?,?,?,?,?,?,?,?,?)',
          args: [
            hypothesisId,
            randomUUID(),
            resource.owner,
            randomUUID(),
            'dupin',
            1,
            randomUUID(),
            'BLOCKED',
            hypothesisData,
          ],
        });
      });
      await store.close();
      await legacyResourceSchema(settings.databaseUrl);
      const db = createClient({ url: settings.databaseUrl });
      try {
        const original = (await db.execute('SELECT data FROM scanner_owned_resources')).rows;
        await db.execute('CREATE TABLE scanner_owned_resources_next(sentinel TEXT)');
        store = new InvestigationStore(settings.databaseUrl);
        await expect(store.initialize()).rejects.toThrow();
        expect((await db.execute('SELECT version FROM scanner_migrations ORDER BY version')).rows).toEqual([
          { version: 1 },
          { version: 2 },
          { version: 3 },
        ]);
        expect((await db.execute('SELECT data FROM scanner_owned_resources')).rows).toEqual(original);
        expect(
          (await db.execute("SELECT name FROM sqlite_master WHERE name='scanner_current_owned_resources'")).rows,
        ).toEqual([]);
        await db.execute('DROP TABLE scanner_owned_resources_next');
        await store.initialize();
        await store.initialize();
        expect((await db.execute('SELECT version FROM scanner_migrations ORDER BY version')).rows).toEqual([
          { version: 1 },
          { version: 2 },
          { version: 3 },
          { version: 4 },
        ]);
        expect((await db.execute('SELECT data FROM scanner_owned_resources')).rows).toEqual(original);
        expect(
          (await db.execute({ sql: 'SELECT data FROM scanner_hypotheses WHERE id=?', args: [hypothesisId] })).rows,
        ).toEqual([{ data: hypothesisData }]);
        const peer = new InvestigationStore(settings.databaseUrl);
        await peer.initialize();
        try {
          const renewed = { ...resource, id: randomUUID(), targetRevision: 2 };
          const results = await Promise.all([
            store.bindOwnedResource(renewed),
            store.bindOwnedResource({ ...renewed, id: randomUUID() }),
          ]);
          expect(results.map(item => item.created).sort()).toEqual([false, true]);
          expect(results[0]!.binding.id).toBe(results[1]!.binding.id);
          const current = results[0]!.binding;
          expect((await peer.bindOwnedResource({ ...renewed, id: randomUUID() })).binding).toEqual(current);
          expect(await store.getOwnedResource(resource.id, resource.owner)).toEqual(resource);
          await expect(store.getOwnedResource(resource.id, 'another-owner')).rejects.toMatchObject({
            code: 'NOT_FOUND',
          });
          await expect(
            store.bindOwnedResource({ ...current, id: randomUUID(), marker: 'LAB_MARKER_CONFLICT01' } as OwnedResource),
          ).rejects.toMatchObject({ code: 'RESOURCE_BINDING_CONFLICT' });
          await expect(store.bindOwnedResource({ ...resource, id: randomUUID() })).rejects.toMatchObject({
            code: 'REVISION_CONFLICT',
          });
          for (const separate of [
            { owner: 'another-owner' },
            { targetId: randomUUID() },
            {
              category: 'misconfiguration' as const,
              headerName: 'x-content-type-options' as const,
              expectedValue: 'nosniff',
            },
            { path: '/another-owned' },
          ])
            expect(
              (await store.bindOwnedResource({ ...resource, ...separate, id: randomUUID() } as OwnedResource)).created,
            ).toBe(true);
          expect((await db.execute('SELECT resource_id FROM scanner_current_owned_resources')).rows).toHaveLength(5);
          await peer.close();
          const reopened = new InvestigationStore(settings.databaseUrl);
          try {
            await reopened.initialize();
            expect(
              await reopened.ownedResource(resource.owner, resource.targetId, resource.category, resource.path),
            ).toEqual(current);
          } finally {
            await reopened.close();
          }
          await db.execute('DROP TABLE scanner_current_owned_resources');
          await expect(store.initialize()).rejects.toMatchObject({ code: 'DATABASE_SCHEMA_UNSUPPORTED' });
          expect(
            (await db.execute("SELECT data FROM scanner_owned_resources WHERE id='" + resource.id + "'")).rows,
          ).toEqual(original);
        } finally {
          await peer.close();
        }
      } finally {
        db.close();
      }
    } finally {
      await store.close();
      await discovery.close();
      await domain.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it(
    'restores_schema3_and4_pairs_without_mutating_original_backups_or_native_history',
    () => compatiblePairRollback('discovery-instance-history'),
    120000,
  );

  it('registers one local planning schedule only when enabled and removes it after disable', async () => {
    const { root } = await temporarySettings();
    const enabled = loadSettings({ SCANNER_INVESTIGATION_ENABLED: 'true' }, root);
    const disabled = loadSettings({}, root);
    let planningCalls = 0;
    try {
      for (let boot = 0; boot < 2; boot++) {
        const runtime = await initializeStorage(enabled, async () => {
          planningCalls++;
        });
        try {
          await runtime.mastra.startWorkers();
          const schedules = await runtime.mastra.schedules.list();
          expect(schedules.filter(item => item.workflowId === 'local-investigation-planning')).toMatchObject([
            { cron: '* * * * *', timezone: 'UTC', status: 'active' },
          ]);
          await runtime.mastra.schedules.run(schedules[0]!.id);
          for (let attempt = 0; planningCalls < boot + 1 && attempt < 50; attempt++)
            await new Promise(resolve => setTimeout(resolve, 100));
          expect(planningCalls).toBe(boot + 1);
        } finally {
          await runtime.mastra.shutdown();
          await runtime.storage.close();
        }
      }
      const runtime = await initializeStorage(disabled);
      try {
        await runtime.mastra.startWorkers();
        expect(
          (await runtime.mastra.schedules.list()).filter(item => item.workflowId === 'local-investigation-planning'),
        ).toEqual([]);
        expect(planningCalls).toBe(2);
      } finally {
        await runtime.mastra.shutdown();
        await runtime.storage.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('creates two owned private files and retains native state across a fresh restart', async () => {
    const { root, settings } = await temporarySettings();
    try {
      expect((await inspectStorageFiles(settings)).status).toBe('not-initialized');
      await expect(lstat(settings.databasePath)).rejects.toMatchObject({ code: 'ENOENT' });
      const first = await initializeStorage(settings);
      try {
        await saveNativeThread(first.storage, 'new-install-thread');
      } finally {
        await first.mastra.shutdown();
        await first.storage.close();
      }
      for (const path of [settings.databasePath, settings.mastraDatabasePath]) {
        const stat = await lstat(path);
        expect(stat.isFile()).toBe(true);
        expect(stat.mode & 0o777).toBe(0o600);
        expect(stat.uid).toBe(process.getuid?.());
      }
      const main = createClient({ url: settings.databaseUrl });
      const native = createClient({ url: settings.mastraDatabaseUrl });
      try {
        const mainTables = await main.execute("SELECT name FROM sqlite_master WHERE type='table'");
        const nativeTables = await native.execute("SELECT name FROM sqlite_master WHERE type='table'");
        expect(mainTables.rows).toHaveLength(0);
        expect(nativeTables.rows.length).toBeGreaterThan(0);
      } finally {
        main.close();
        native.close();
      }
      expect((await inspectStorageFiles(settings)).status).toBe('ready');
      const restarted = await initializeStorage(settings);
      try {
        const memory = await restarted.storage.getStore('memory');
        expect(
          await memory?.getThreadById({ threadId: 'new-install-thread', resourceId: 'local-operator' }),
        ).toMatchObject({
          title: 'Retained native state',
        });
      } finally {
        await restarted.mastra.shutdown();
        await restarted.storage.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('blocks existing native records in the original database without moving or deleting them', async () => {
    const { root, settings } = await temporarySettings();
    try {
      await prepareDataDirectory(settings);
      const legacy = new LibSQLStore({ id: 'security-scanner', url: settings.databaseUrl, disableInit: true });
      try {
        await legacy.init();
        await saveNativeThread(legacy, 'legacy-thread');
      } finally {
        await legacy.close();
      }
      await expect(initializeStorage(settings)).rejects.toMatchObject({ code: 'LEGACY_MASTRA_STATE' });
      await expect(inspectStorageFiles(settings)).rejects.toMatchObject({ code: 'LEGACY_MASTRA_STATE' });
      await expect(lstat(settings.mastraDatabasePath)).rejects.toMatchObject({ code: 'ENOENT' });
      const preserved = new LibSQLStore({ id: 'security-scanner', url: settings.databaseUrl, disableInit: true });
      try {
        await preserved.init();
        const memory = await preserved.getStore('memory');
        expect(await memory?.getThreadById({ threadId: 'legacy-thread', resourceId: 'local-operator' })).toMatchObject({
          title: 'Retained native state',
        });
      } finally {
        await preserved.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('permits an older empty native schema without copying or dropping its tables', async () => {
    const { root, settings } = await temporarySettings();
    try {
      await prepareDataDirectory(settings);
      const legacy = new LibSQLStore({ id: 'security-scanner', url: settings.databaseUrl, disableInit: true });
      try {
        await legacy.init();
      } finally {
        await legacy.close();
      }
      const runtime = await initializeStorage(settings);
      try {
        expect((await inspectStorageFiles(settings)).status).toBe('ready');
      } finally {
        await runtime.mastra.shutdown();
        await runtime.storage.close();
      }
      const original = createClient({ url: settings.databaseUrl });
      try {
        const tables = await original.execute(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*'",
        );
        expect(tables.rows.length).toBeGreaterThan(0);
      } finally {
        original.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a symlink at the native file path before opening the SDK', async () => {
    const { root, settings } = await temporarySettings();
    try {
      await prepareDataDirectory(settings);
      const sentinel = join(settings.dataDirectory, 'sentinel.txt');
      await writeFile(sentinel, 'unchanged', { mode: 0o600 });
      await symlink(sentinel, settings.mastraDatabasePath);
      await expect(initializeStorage(settings)).rejects.toMatchObject({ code: 'UNSAFE_MASTRA_DATABASE' });
      expect(await readFile(sentinel, 'utf8')).toBe('unchanged');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not create a replacement application database beside orphaned native state', async () => {
    const { root, settings } = await temporarySettings();
    try {
      await prepareDataDirectory(settings);
      await writeFile(settings.mastraDatabasePath, 'preserve-native-file', { mode: 0o600 });
      await expect(initializeStorage(settings)).rejects.toMatchObject({ code: 'ORPHANED_MASTRA_DATABASE' });
      await expect(lstat(settings.databasePath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(settings.mastraDatabasePath, 'utf8')).toBe('preserve-native-file');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
