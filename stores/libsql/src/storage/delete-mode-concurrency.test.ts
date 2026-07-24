import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';

const workerPath = fileURLToPath(new URL('./__fixtures__/delete-mode-worker.mjs', import.meta.url));

function runWorker(dbPath: string, workerId: number, writeCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, dbPath, String(workerId), String(writeCount)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`DELETE-mode worker ${workerId} exited with ${code}: ${stderr}`));
    });
  });
}

describe('local DELETE journal concurrency', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('preserves all writes across processes without WAL sidecars', async () => {
    const workerCount = 6;
    const writesPerWorker = 30;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-delete-concurrency-'));
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, 'stress.db');

    const setupClient = createClient({ url: `file:${dbPath}`, timeout: 5000 });
    await setupClient.execute('PRAGMA journal_mode=DELETE;');
    await setupClient.execute(
      'CREATE TABLE stress_writes (id TEXT PRIMARY KEY, worker_id INTEGER NOT NULL, write_index INTEGER NOT NULL);',
    );
    setupClient.close();

    await Promise.all(
      Array.from({ length: workerCount }, (_, workerId) => runWorker(dbPath, workerId, writesPerWorker)),
    );

    const verifyClient = createClient({ url: `file:${dbPath}` });
    const count = await verifyClient.execute('SELECT COUNT(*) AS count FROM stress_writes;');
    const integrity = await verifyClient.execute('PRAGMA quick_check;');
    const mode = await verifyClient.execute('PRAGMA journal_mode;');
    verifyClient.close();

    expect(count.rows[0]?.count).toBe(workerCount * writesPerWorker);
    expect(Object.values(integrity.rows[0] ?? {})[0]).toBe('ok');
    expect(Object.values(mode.rows[0] ?? {})[0]).toBe('delete');
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
  });
});
