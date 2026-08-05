import { spawn, execFileSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

const RESOURCE_ID = 'mc-e2e-concurrent-thread-resource';
const LOCKED_THREAD_ID = 'thread-owned-by-another-process';
let lockOwner: ChildProcess | undefined;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function stopLockOwner(): void {
  lockOwner?.kill();
  lockOwner = undefined;
}

export const concurrentThreadStartupScenario: McE2eScenario = {
  name: 'concurrent-thread-startup',
  description: 'Start Mastra Code on a new thread when the most recent thread is owned by another process.',
  testName: 'starts on a different thread when the latest thread is locked',
  env() {
    return { MASTRA_RESOURCE_ID: RESOURCE_ID };
  },
  prepare({ appDataDir, dbPath, projectDir }) {
    lockOwner = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    if (!lockOwner.pid) throw new Error('Failed to start thread lock owner');
    lockOwner.unref();

    try {
      const locksDir = join(appDataDir, 'locks');
      mkdirSync(locksDir, { recursive: true });
      writeFileSync(join(locksDir, `${LOCKED_THREAD_ID}.1.lock`), String(lockOwner.pid));

      const now = new Date().toISOString();
      const metadata = JSON.stringify({ projectPath: projectDir });
      const sql = `
INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES (${quoteSql(LOCKED_THREAD_ID)}, ${quoteSql(RESOURCE_ID)}, ${quoteSql('Active in another terminal')}, ${quoteSql(metadata)}, ${quoteSql(now)}, ${quoteSql(now)});
`;
      execFileSync('sqlite3', [dbPath], { input: sql });
    } catch (error) {
      stopLockOwner();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    try {
      runtime.startLiveOutput(terminal);
      await runtime.waitForScreenText(/Resource ID:/i, terminal);
      terminal.submit('/threads');
      await runtime.waitForScreenText(/Active in another terminal/i, terminal);
      terminal.write('\u001B');
      await runtime.sleep(100);

      terminal.submit('/thread');
      await runtime.waitForScreenText(/^\s*ID:\s+(?!thread-owned-by-another-process)\S+/im, terminal);
    } finally {
      stopLockOwner();
      terminal.keyCtrlC();
    }
  },
};
