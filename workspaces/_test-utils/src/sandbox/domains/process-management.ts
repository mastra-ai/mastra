/**
 * Process management test domain.
 * Tests: spawn, wait, kill, sendStdin, list, get, onStdout/onStderr callbacks,
 * reader/writer streams, concurrent processes, idempotency
 */

import type { MastraSandbox, SandboxProcessManager } from '@mastra/core/workspace';
import { describe, it, expect, beforeAll } from 'vitest';

import type { CreateSandboxOptions, SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: MastraSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  createSandbox: (options?: CreateSandboxOptions) => Promise<MastraSandbox> | MastraSandbox;
}

export function createProcessManagementTests(getContext: () => TestContext): void {
  describe('Process Management', () => {
    let processes: SandboxProcessManager;

    beforeAll(() => {
      const { sandbox } = getContext();
      expect(
        sandbox.processes,
        'sandbox.processes must be defined when processManagement tests are enabled',
      ).toBeDefined();
      processes = sandbox.processes!;
    });

    describe('spawn', () => {
      it(
        'spawns a process and returns a handle with pid',
        async () => {
          const handle = await processes.spawn('echo hello');
          expect(handle.pid).toBeGreaterThan(0);
          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'accumulates stdout',
        async () => {
          const handle = await processes.spawn('echo hello');
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
          const handle = await processes.spawn('echo "error msg" >&2');
          const result = await handle.wait();

          expect(result.stderr).toContain('error msg');
        },
        getContext().testTimeout,
      );

      it(
        'captures non-zero exit code',
        async () => {
          const handle = await processes.spawn('exit 42');
          const result = await handle.wait();

          expect(result.success).toBe(false);
          expect(result.exitCode).toBe(42);
        },
        getContext().testTimeout,
      );

      it(
        'respects env option',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsEnvVars) return;

          const handle = await processes.spawn('echo $MY_VAR', {
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
          const chunks: string[] = [];
          const handle = await processes.spawn('echo hello', {
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
          const chunks: string[] = [];
          const handle = await processes.spawn('echo "err" >&2', {
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
          const handle = await processes.spawn('echo hello');
          await handle.wait();

          expect(handle.stdout.trim()).toBe('hello');
        },
        getContext().testTimeout,
      );

      it(
        'stderr accumulates on the handle',
        async () => {
          const handle = await processes.spawn('echo "err" >&2');
          await handle.wait();

          expect(handle.stderr).toContain('err');
        },
        getContext().testTimeout,
      );

      it(
        'exitCode is undefined while running, set after exit',
        async () => {
          const handle = await processes.spawn('sleep 0.05');
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
          const handle = await processes.spawn('echo idempotent');
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
          const handle = await processes.spawn('sleep 60');
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
          const handle = await processes.spawn('echo done');
          await handle.wait();

          const killed = await handle.kill();
          expect(killed).toBe(false);
        },
        getContext().testTimeout,
      );
    });

    describe('abort signal', () => {
      it(
        'aborts a spawned process when signal fires',
        async () => {
          const controller = new AbortController();

          const handle = await processes.spawn(
            `node -e "process.stdout.write('started\\n'); setTimeout(() => {}, 30000)"`,
            {
              abortSignal: controller.signal,
              onStdout: () => controller.abort(),
            },
          );
          const result = await handle.wait();

          expect(result.success).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'aborts immediately when signal is already aborted',
        async () => {
          const controller = new AbortController();
          controller.abort();

          const start = Date.now();
          const handle = await processes.spawn('sleep 60', {
            abortSignal: controller.signal,
          });
          const result = await handle.wait();

          expect(result.success).toBe(false);
          expect(Date.now() - start).toBeLessThan(2000);
        },
        getContext().testTimeout,
      );

      it(
        'captures partial output before abort',
        async () => {
          const controller = new AbortController();

          const handle = await processes.spawn(
            `node -e "process.stdout.write('before abort\\n'); setTimeout(() => {}, 30000)"`,
            {
              abortSignal: controller.signal,
              onStdout: () => controller.abort(),
            },
          );
          const result = await handle.wait();

          expect(result.success).toBe(false);
          expect(result.stdout).toContain('before abort');
        },
        getContext().testTimeout,
      );
    });

    describe('sendStdin', () => {
      it(
        'sends data to stdin',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsStdin) return;

          // Use head -1 to read one line then exit cleanly
          const handle = await processes.spawn('head -1');
          await handle.sendStdin('hello from stdin\n');
          const result = await handle.wait();

          expect(result.stdout).toContain('hello from stdin');
        },
        getContext().testTimeout,
      );

      it(
        'throws when sending to an exited process',
        async () => {
          const handle = await processes.spawn('echo done');
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
          const handle = await processes.spawn('sleep 60');
          const procs = await processes.list();

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
          const handle = await processes.spawn('echo done');
          await handle.wait();

          const procs = await processes.list();
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
          const handle = await processes.spawn('sleep 60');
          const procs = await processes.list();

          const found = procs.find(p => p.pid === handle.pid);
          expect(found).toBeDefined();
          // command is optional — some providers (e.g. E2B) get it from the server,
          // others may not track it
          if (found!.command) {
            expect(found!.command).toContain('sleep');
          }

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
          const handle = await processes.spawn('sleep 60');
          const retrieved = await processes.get(handle.pid);

          expect(retrieved).toBeDefined();
          expect(retrieved!.pid).toBe(handle.pid);

          await handle.kill();
          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'retrieved handle has accumulated stdout from spawn',
        async () => {
          const handle = await processes.spawn('echo get-test');
          await handle.wait();

          const retrieved = await processes.get(handle.pid);
          // Some providers may not track exited processes
          if (retrieved) {
            expect(retrieved.stdout).toContain('get-test');
          }
        },
        getContext().testTimeout,
      );

      it(
        'retrieved handle has accumulated stdout while still running',
        async () => {
          // Use onStdout to know when output has actually arrived (avoids flaky setTimeout)
          let gotOutput: () => void;
          const outputArrived = new Promise<void>(r => (gotOutput = r));

          const handle = await processes.spawn(`node -e "console.log('running-get-test'); setInterval(()=>{},60000)"`, {
            onStdout: () => gotOutput(),
          });
          await outputArrived;

          const retrieved = await processes.get(handle.pid);
          expect(retrieved).toBeDefined();
          expect(retrieved!.stdout).toContain('running-get-test');

          await handle.kill();
          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'spawn then get output then kill (tool flow)',
        async () => {
          // Simulates the full tool flow: execute_command(background:true) → get_process_output → kill_process
          let gotOutput: () => void;
          const outputArrived = new Promise<void>(r => (gotOutput = r));

          const handle = await processes.spawn(`node -e "console.log('spawn-get-kill'); setInterval(()=>{},60000)"`, {
            onStdout: () => gotOutput(),
          });
          await outputArrived;

          const pid = handle.pid;

          // Get output via PID (simulates get_process_output tool)
          const retrieved = await processes.get(pid);
          expect(retrieved).toBeDefined();
          expect(retrieved!.stdout).toContain('spawn-get-kill');

          // Kill via manager (simulates kill_process tool)
          const killed = await processes.kill(pid);
          expect(killed).toBe(true);

          await handle.wait();
        },
        getContext().testTimeout,
      );

      it(
        'first get() after natural exit returns output, second get() returns undefined (pruned)',
        async () => {
          // Spawn a short-lived process and let it exit on its own (no wait() call)
          let gotOutput: () => void;
          const outputArrived = new Promise<void>(r => (gotOutput = r));

          const handle = await processes.spawn('echo prune-test', {
            onStdout: () => gotOutput(),
          });
          const pid = handle.pid;

          // Wait for output to arrive, then poll until process has exited
          await outputArrived;
          const deadline = Date.now() + 5000;
          while (handle.exitCode === undefined && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
          }
          expect(handle.exitCode).toBeDefined();

          // First get() — process exited, should return handle with output
          const first = await processes.get(pid);
          expect(first).toBeDefined();
          expect(first!.stdout).toContain('prune-test');
          expect(first!.exitCode).toBeDefined();

          // Second get() — handle was pruned on first read, should be gone
          const second = await processes.get(pid);
          expect(second).toBeUndefined();
        },
        getContext().testTimeout,
      );

      it(
        'returns undefined for unknown pid',
        async () => {
          const retrieved = await processes.get(99999);
          expect(retrieved).toBeUndefined();
        },
        getContext().testTimeout,
      );

      it(
        'handle.kill() does not remove from tracking (only manager.kill() does)',
        async () => {
          const handle = await processes.spawn('sleep 60');
          const pid = handle.pid;

          await handle.kill();
          await handle.wait();

          // Direct handle.kill() should NOT remove from tracking —
          // only processes.kill() releases the handle.
          const retrieved = await processes.get(pid);
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
          const h1 = await processes.spawn('echo first');
          const h2 = await processes.spawn('echo second');
          const h3 = await processes.spawn('sleep 60');

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
          const handle = await processes.spawn('sleep 60');
          const killed = await processes.kill(handle.pid);
          expect(killed).toBe(true);

          const result = await handle.wait();
          expect(result.success).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'returns false for unknown pid',
        async () => {
          const killed = await processes.kill(99999);
          expect(killed).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'get after manager kill returns undefined (handle released)',
        async () => {
          // Simulates tool flow: kill_process releases the handle from tracking
          const handle = await processes.spawn(`node -e "setInterval(()=>{},60000)"`);
          const pid = handle.pid;

          const killed = await processes.kill(pid);
          expect(killed).toBe(true);

          // Handle should be removed from tracking after kill
          const retrieved = await processes.get(pid);
          expect(retrieved).toBeUndefined();
        },
        getContext().testTimeout,
      );
    });

    describe('sandbox-level env', () => {
      it(
        'spawned process inherits sandbox env',
        async () => {
          const { capabilities, createSandbox } = getContext();
          if (!capabilities.supportsEnvVars) return;

          const envSandbox = await createSandbox({ env: { SANDBOX_VAR: 'from-sandbox' } });
          await envSandbox._start();

          try {
            expect(envSandbox.processes).toBeDefined();
            const handle = await envSandbox.processes!.spawn('printenv SANDBOX_VAR');
            const result = await handle.wait();

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('from-sandbox');
          } finally {
            await envSandbox._destroy();
          }
        },
        getContext().testTimeout,
      );

      it(
        'per-spawn env overrides sandbox env',
        async () => {
          const { capabilities, createSandbox } = getContext();
          if (!capabilities.supportsEnvVars) return;

          const envSandbox = await createSandbox({ env: { SANDBOX_VAR: 'original', EXTRA: 'kept' } });
          await envSandbox._start();

          try {
            expect(envSandbox.processes).toBeDefined();
            const handle = await envSandbox.processes!.spawn("sh -c 'echo $SANDBOX_VAR $EXTRA $SPAWN_VAR'", {
              env: { SANDBOX_VAR: 'overridden', SPAWN_VAR: 'added' },
            });
            const result = await handle.wait();

            expect(result.success).toBe(true);
            expect(result.stdout.trim()).toBe('overridden kept added');
          } finally {
            await envSandbox._destroy();
          }
        },
        getContext().testTimeout,
      );
    });

    describe('reader / writer streams', () => {
      it(
        'reader stream receives stdout data',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsStreaming) return;

          const handle = await processes.spawn('echo stream-test');

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
          const { capabilities } = getContext();
          if (!capabilities.supportsStreaming) return;

          const handle = await processes.spawn('echo done');

          // Must consume the stream (flowing mode) for 'end' to fire
          handle.reader.resume();
          const ended = new Promise<void>(resolve => {
            handle.reader.on('end', resolve);
          });

          await handle.wait();
          // Reader should eventually emit 'end'
          await expect(
            Promise.race([ended, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))]),
          ).resolves.toBeUndefined();
        },
        getContext().testTimeout,
      );

      it(
        'writer stream sends data to stdin',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsStreaming) return;
          if (!capabilities.supportsStdin) return;

          const handle = await processes.spawn('head -1');

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
