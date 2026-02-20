/**
 * Process management test domain.
 * Tests: spawn, wait, kill, sendStdin, list, get, onStdout/onStderr callbacks,
 * reader/writer streams, concurrent processes, idempotency
 */

import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: WorkspaceSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
}

export function createProcessManagementTests(getContext: () => TestContext): void {
  describe('Process Management', () => {
    describe('spawn', () => {
      it(
        'spawns a process and returns a handle with pid',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo hello');
          expect(handle.pid).toBeGreaterThan(0);
          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'accumulates stdout',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo hello');
          const result = await handle.wait();

          expect(result.success).toBe(true);
          expect(result.exitCode).toBe(0);
          expect(result.stdout.trim()).toBe('hello');
        },
        getContext().testTimeout,
      );

      it(
        'accumulates stderr',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo "error msg" >&2');
          const result = await handle.wait();

          expect(result.stderr).toContain('error msg');
        },
        getContext().testTimeout,
      );

      it(
        'captures non-zero exit code',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('exit 42');
          const result = await handle.wait();

          expect(result.success).toBe(false);
          expect(result.exitCode).toBe(42);
        },
        getContext().testTimeout,
      );

      it(
        'respects env option',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!sandbox.processes) return;
          if (!capabilities.supportsEnvVars) return;

          const handle = await sandbox.processes.spawn('echo $MY_VAR', {
            env: { MY_VAR: 'test_value' },
          });
          const result = await handle.wait();

          expect(result.stdout.trim()).toBe('test_value');
        },
        getContext().testTimeout,
      );
    });

    describe('onStdout / onStderr callbacks', () => {
      it(
        'calls onStdout callback as data arrives',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const chunks: string[] = [];
          const handle = await sandbox.processes.spawn('echo hello', {
            onStdout: data => chunks.push(data),
          });
          await handle.wait();

          expect(chunks.join('')).toContain('hello');
        },
        getContext().testTimeout,
      );

      it(
        'calls onStderr callback as data arrives',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const chunks: string[] = [];
          const handle = await sandbox.processes.spawn('echo "err" >&2', {
            onStderr: data => chunks.push(data),
          });
          await handle.wait();

          expect(chunks.join('')).toContain('err');
        },
        getContext().testTimeout,
      );
    });

    describe('handle properties', () => {
      it(
        'stdout accumulates on the handle',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo hello');
          await handle.wait();

          expect(handle.stdout.trim()).toBe('hello');
        },
        getContext().testTimeout,
      );

      it(
        'stderr accumulates on the handle',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo "err" >&2');
          await handle.wait();

          expect(handle.stderr).toContain('err');
        },
        getContext().testTimeout,
      );

      it(
        'exitCode is undefined while running, set after exit',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 0.05');
          expect(handle.exitCode).toBeUndefined();

          await handle.wait();
          expect(handle.exitCode).toBe(0);
        },
        getContext().testTimeout,
      );
    });

    describe('wait', () => {
      it(
        'wait() is idempotent — returns same result on repeated calls',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo idempotent');
          const result1 = await handle.wait();
          const result2 = await handle.wait();

          expect(result1.exitCode).toBe(0);
          expect(result2.exitCode).toBe(0);
          expect(result1.stdout).toBe(result2.stdout);
        },
        getContext().testTimeout,
      );
    });

    describe('kill', () => {
      it(
        'kills a running process',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 60');
          expect(handle.exitCode).toBeUndefined();

          const killed = await handle.kill();
          expect(killed).toBe(true);

          const result = await handle.wait();
          expect(result.success).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'returns false when killing an already-exited process',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo done');
          await handle.wait();

          const killed = await handle.kill();
          expect(killed).toBe(false);
        },
        getContext().testTimeout,
      );
    });

    describe('sendStdin', () => {
      it(
        'sends data to stdin',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          // Use head -1 to read one line then exit cleanly
          const handle = await sandbox.processes.spawn('head -1');
          await handle.sendStdin('hello from stdin\n');
          const result = await handle.wait();

          expect(result.stdout).toContain('hello from stdin');
        },
        getContext().testTimeout,
      );

      it(
        'throws when sending to an exited process',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo done');
          await handle.wait();

          await expect(handle.sendStdin('data')).rejects.toThrow();
        },
        getContext().testTimeout,
      );
    });

    describe('list', () => {
      it(
        'lists spawned processes',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 60');
          const procs = await sandbox.processes.list();

          expect(procs.length).toBeGreaterThanOrEqual(1);

          const found = procs.find(p => p.pid === handle.pid);
          expect(found).toBeDefined();
          expect(found!.running).toBe(true);

          await handle.kill();
          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'shows exited processes as not running',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('echo done');
          await handle.wait();

          const procs = await sandbox.processes.list();
          const found = procs.find(p => p.pid === handle.pid);

          // Some providers only list running processes (e.g. E2B)
          if (found) {
            expect(found.running).toBe(false);
            expect(found.exitCode).toBe(0);
          }
        },
        getContext().testTimeout,
      );

      it(
        'includes command string in process info',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 60');
          const procs = await sandbox.processes.list();

          const found = procs.find(p => p.pid === handle.pid);
          expect(found).toBeDefined();
          expect(found!.command).toContain('sleep');

          await handle.kill();
          await handle.wait();
        },
        getContext().testTimeout,
      );
    });

    describe('get', () => {
      it(
        'returns handle by pid',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 60');
          const retrieved = await sandbox.processes.get(handle.pid);

          expect(retrieved).toBeDefined();
          expect(retrieved!.pid).toBe(handle.pid);

          await handle.kill();
          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'returns undefined for unknown pid',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const retrieved = await sandbox.processes.get(99999);
          expect(retrieved).toBeUndefined();
        },
        getContext().testTimeout,
      );

      it(
        'returns handle after process is killed',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 60');
          const pid = handle.pid;

          await handle.kill();
          await handle.wait();

          // Should still be retrievable after kill (important for stateless tool layer)
          const retrieved = await sandbox.processes.get(pid);
          // Some providers (e.g. E2B) may not track killed processes
          if (retrieved) {
            expect(retrieved.pid).toBe(pid);
          }
        },
        getContext().testTimeout,
      );
    });

    describe('concurrent processes', () => {
      it(
        'tracks multiple spawned processes independently',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const h1 = await sandbox.processes.spawn('echo first');
          const h2 = await sandbox.processes.spawn('echo second');
          const h3 = await sandbox.processes.spawn('sleep 60');

          // All have unique PIDs
          expect(new Set([h1.pid, h2.pid, h3.pid]).size).toBe(3);

          const r1 = await h1.wait();
          const r2 = await h2.wait();

          expect(r1.stdout.trim()).toBe('first');
          expect(r2.stdout.trim()).toBe('second');

          // Third is still running
          expect(h3.exitCode).toBeUndefined();

          await h3.kill();
          await h3.wait();
        },
        getContext().testTimeout,
      );
    });

    describe('manager kill', () => {
      it(
        'kills a process by pid via the manager',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const handle = await sandbox.processes.spawn('sleep 60');
          const killed = await sandbox.processes.kill(handle.pid);
          expect(killed).toBe(true);

          const result = await handle.wait();
          expect(result.success).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'returns false for unknown pid',
        async () => {
          const { sandbox } = getContext();
          if (!sandbox.processes) return;

          const killed = await sandbox.processes.kill(99999);
          expect(killed).toBe(false);
        },
        getContext().testTimeout,
      );
    });

    describe('reader / writer streams', () => {
      it(
        'reader stream receives stdout data',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!sandbox.processes) return;
          if (!capabilities.supportsStreaming) return;

          const handle = await sandbox.processes.spawn('echo stream-test');

          const chunks: string[] = [];
          handle.reader.on('data', (chunk: Buffer) => {
            chunks.push(chunk.toString());
          });

          await handle.wait();
          // Give the stream a tick to flush
          await new Promise(r => setTimeout(r, 50));

          expect(chunks.join('')).toContain('stream-test');
        },
        getContext().testTimeout,
      );

      it(
        'reader stream ends when process exits',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!sandbox.processes) return;
          if (!capabilities.supportsStreaming) return;

          const handle = await sandbox.processes.spawn('echo done');

          // Must consume the stream (flowing mode) for 'end' to fire
          handle.reader.resume();
          const ended = new Promise<void>(resolve => {
            handle.reader.on('end', resolve);
          });

          await handle.wait();
          // Reader should eventually emit 'end'
          await expect(Promise.race([ended, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))])).resolves.toBeUndefined();
        },
        getContext().testTimeout,
      );

      it(
        'writer stream sends data to stdin',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!sandbox.processes) return;
          if (!capabilities.supportsStreaming) return;

          const handle = await sandbox.processes.spawn('head -1');

          await new Promise<void>((resolve, reject) => {
            handle.writer.write('writer-test\n', err => (err ? reject(err) : resolve()));
          });

          const result = await handle.wait();
          expect(result.stdout).toContain('writer-test');
        },
        getContext().testTimeout,
      );
    });
  });
}
