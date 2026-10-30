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

async function temporarySettings() {
  const root = await mkdtemp(join(tmpdir(), 'scanner-storage-'));
  return { root, settings: loadSettings({}, root) };
}

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
