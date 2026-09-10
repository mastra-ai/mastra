import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const fixture = fileURLToPath(new URL('./fixtures/scheduled-approval-process.ts', import.meta.url));
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
describe.each(['resume', 'targeted'])('scheduled approval after a real process exit (%s)', phase => {
  it.each(['manual', 'auto', 'blocked'])(
    'restores %s with no browser consumer',
    async policy => {
      const directory = await mkdtemp(path.join(tmpdir(), 'mastra-scheduled-policy-'));
      const db = path.join(directory, 'storage.db').replaceAll('\\', '/');
      const run = async (phase: string, runId = '') => {
        const { stdout } = await execute(
          process.execPath,
          ['--import', import.meta.resolve('tsx'), fixture, phase, policy, db, runId],
          { cwd: root, timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
        );
        const result = stdout.split('\n').find(line => line.startsWith('RESULT '));
        expect(result).toBeDefined();
        return JSON.parse(result!.slice(7));
      };
      try {
        const prepared = await run('prepare');
        expect(prepared.executions).toBe(0);
        expect(prepared.policy).toBe(policy === 'manual' ? 'manual' : 'auto');
        const resumed = await run(phase, prepared.runId);
        expect(resumed.pid).not.toBe(prepared.pid);
        expect(resumed.runId).toBe(prepared.runId);
        expect(resumed.executions).toBe(policy === 'blocked' ? 0 : 2);
      } finally {
        // mkdtemp creates this exact private fixture directory under the OS temp root.
        if (path.dirname(directory) !== tmpdir()) throw new Error('Unexpected fixture cleanup path');
        await rm(directory, { recursive: true, force: true });
      }
    },
    65000,
  );
});
