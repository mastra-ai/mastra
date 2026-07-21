import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

function readJournalHeader(file: string): 'delete' | 'wal' | 'unknown' {
  if (statSync(file).size < 100) return 'unknown';
  const header = readFileSync(file).subarray(18, 20);
  return header[0] === 1 && header[1] === 1 ? 'delete' : header[0] === 2 && header[1] === 2 ? 'wal' : 'unknown';
}

async function waitForDeleteHeader(file: string): Promise<'delete' | 'wal' | 'unknown'> {
  let mode: 'delete' | 'wal' | 'unknown' = 'unknown';
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      mode = readJournalHeader(file);
      if (mode === 'delete') return mode;
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
  async prepare({ appDataDir, dbPath }) {
    const vectorPath = join(appDataDir, 'mastra-vectors.db');
    const { DatabaseSync } = await import('node:sqlite');
    for (const file of [dbPath, vectorPath]) {
      const database = new DatabaseSync(file);
      database.exec('PRAGMA journal_mode=WAL; CREATE TABLE seed (id INTEGER PRIMARY KEY);');
      // Preserve the WAL header to model a database left by an older Mastra Code
      // process. The product path under test owns the safe transition to DELETE.
      database.close();
      if (readJournalHeader(file) !== 'wal') throw new Error(`Failed to seed WAL database: ${file}`);
    }
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
        terminal.write(`STORAGE_WAL_MAIN=${existsSync(`${dbPath}-wal`) || existsSync(`${dbPath}-shm`)}\r\n`);
        terminal.write(`STORAGE_WAL_VECTOR=${existsSync(`${vectorPath}-wal`) || existsSync(`${vectorPath}-shm`)}\r\n`);
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForOutputText(/STORAGE_JOURNAL_MAIN=delete/i, terminal);
    await runtime.waitForOutputText(/STORAGE_JOURNAL_VECTOR=delete/i, terminal);
    await runtime.waitForOutputText(/STORAGE_WAL_MAIN=false/i, terminal);
    await runtime.waitForOutputText(/STORAGE_WAL_VECTOR=false/i, terminal);
  },
};
