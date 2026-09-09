import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const fixture = fileURLToPath(new URL('./fixtures/saved-approval-process.ts', import.meta.url));
const root = fileURLToPath(new URL('../../../../../', import.meta.url));

// Build core and its workspace dependencies first. Each phase starts a fresh
// process with empty runtime state and the same real LibSQL database. The fake
// model and tool are local; the child rejects external fetches.
describe('Session approval recovery after a real process restart', () => {
  it.each(['approve', 'decline', 'navigate', 'stop', 'message'])(
    'restores the same saved work and handles %s without automatic execution',
    async decision => {
      const directory = await mkdtemp(path.join(tmpdir(), 'mastra-saved-approval-'));
      const database = path.join(directory, 'storage.db').replaceAll('\\', '/');
      const run = async (phase: string, expectedRunId = '') => {
        const { stdout } = await execute(
          process.execPath,
          ['--import', import.meta.resolve('tsx'), fixture, phase, decision, database, expectedRunId],
          { cwd: root, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 },
        );
        const line = stdout.split('\n').find(line => line.startsWith('RESULT '));
        expect(line).toBeDefined();
        return JSON.parse(line!.slice(7)) as { pid: number; runId: string; executions: number; calls: number };
      };
      try {
        const prepared = await run('prepare');
        expect(prepared.executions).toBe(0);
        // The ID is a test assertion only. Session discovers saved work from
        // native storage; the expected ID is never passed to a recovery API.
        const recovered = await run('resume', prepared.runId);
        expect(recovered.pid).not.toBe(prepared.pid);
        expect(recovered.runId).toBe(prepared.runId);
        expect(recovered.executions).toBe(decision === 'approve' ? 1 : 0);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    65_000,
  );
});
