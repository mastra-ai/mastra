import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

async function waitForDeleteHeader(file: string): Promise<'delete' | 'wal' | 'unknown'> {
  let mode: 'delete' | 'wal' | 'unknown' = 'unknown';
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if (statSync(file).size >= 100) {
        const header = readFileSync(file).subarray(18, 20);
        mode = header[0] === 1 && header[1] === 1 ? 'delete' : header[0] === 2 && header[1] === 2 ? 'wal' : 'unknown';
        if (mode === 'delete') return mode;
      }
    } catch {
      // The database may still be initializing during application setup.
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return mode;
}

export const storageDeleteModeScenario: McE2eScenario = {
  name: 'storage-delete-mode',
  description: 'Starts real Mastra Code storage and verifies local main and vector databases use rollback journals.',
  testName: 'uses DELETE journal mode for local main and vector databases',
  async prepare({ appDataDir }) {
    const vectorPath = join(appDataDir, 'mastra-vectors.db');
    const { createStorage } = await import('@mastra/code-sdk/utils/storage-factory');
    const seeded = await createStorage({ backend: 'libsql', url: `file:${vectorPath}`, isRemote: false });
    await seeded.storage.init();
    await seeded.storage.close?.();
  },
  inProcessApp: ({ appDataDir, dbPath, startMastraCodeApp, terminal }) => {
    const vectorPath = join(appDataDir, 'mastra-vectors.db');
    return startMastraCodeApp({
      config: {
        storage: {
          backend: 'libsql',
          url: `file:${dbPath}`,
          vectorUrl: `file:${vectorPath}`,
          isRemote: false,
        },
      },
      onCreated: async () => {
        const mainMode = await waitForDeleteHeader(dbPath);
        const vectorMode = await waitForDeleteHeader(vectorPath);
        terminal.write(`STORAGE_JOURNAL_MAIN=${mainMode}\r\n`);
        terminal.write(`STORAGE_JOURNAL_VECTOR=${vectorMode}\r\n`);
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForOutputText(/STORAGE_JOURNAL_MAIN=delete/i, terminal);
    await runtime.waitForOutputText(/STORAGE_JOURNAL_VECTOR=delete/i, terminal);
  },
};
