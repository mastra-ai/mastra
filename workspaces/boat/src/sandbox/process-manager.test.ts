/**
 * Boat Process Manager Tests
 *
 * Covers the detached-command machinery against a fake Boat API:
 * - Spawn request shape (detached, cwd, per-command env)
 * - Polling: incremental output, exit codes, tail overflow
 * - kill, abort and timeout
 */

import { UnsupportedStdinCloseError } from '@mastra/core/workspace';
import { beforeEach, describe, expect, it } from 'vitest';

import { createFakeBoatApi } from '../testing/fake-boat-api';
import type { FakeBoatApi } from '../testing/fake-boat-api';
import { BoatSandbox } from './index';

let boat: FakeBoatApi;
let sandbox: BoatSandbox;

const spawnRequests = () =>
  boat.requestsTo('POST', '/sandboxes/bx_fake001/commands').filter(request => request.body?.detached === true);

beforeEach(async () => {
  boat = createFakeBoatApi();
  sandbox = new BoatSandbox({ apiKey: 'sandbox_test_key', fetch: boat.fetch });
  await sandbox._start();
});

describe('BoatProcessManager', () => {
  describe('spawn', () => {
    it('always starts commands detached, so they can be killed and outlive 600s', async () => {
      boat.onCommand('echo hi', { stdout: 'hi\n' });
      await (await sandbox.processes.spawn('echo hi')).wait();

      expect(spawnRequests()[0]?.body).toMatchObject({ command: 'echo hi', detached: true });
    });

    it('defaults cwd to the sandbox working directory', async () => {
      boat.onCommand('pwd', { stdout: '/home/user\n' });
      await (await sandbox.processes.spawn('pwd')).wait();

      expect(spawnRequests()[0]?.body).toMatchObject({ cwd: '/home/user' });
    });

    it('lets a per-command cwd win', async () => {
      boat.onCommand('pwd', { stdout: '/tmp\n' });
      await (await sandbox.processes.spawn('pwd', { cwd: '/tmp' })).wait();

      expect(spawnRequests()[0]?.body).toMatchObject({ cwd: '/tmp' });
    });

    it('carries per-command env in the command, since Boat has no env field', async () => {
      boat.onCommand('echo', { stdout: 'v\n' });
      await (await sandbox.processes.spawn('echo $A', { env: { A: 'v' } })).wait();

      expect(spawnRequests()[0]?.body?.command).toBe("env A=v sh -c 'echo $A'");
      expect(spawnRequests()[0]?.body).not.toHaveProperty('env');
    });
  });

  describe('polling', () => {
    it('resolves with the exit code and output Boat reports', async () => {
      boat.onCommand('build', { stdout: 'done\n', stderr: 'warn\n', exitCode: 0 });

      const result = await (await sandbox.processes.spawn('build')).wait();

      expect(result).toMatchObject({ success: true, exitCode: 0, killed: false, timedOut: false });
      expect(result.stdout).toBe('done\n');
      expect(result.stderr).toBe('warn\n');
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });

    it('reports a failing command as unsuccessful with its real exit code', async () => {
      boat.onCommand('lint', { exitCode: 42 });

      const result = await (await sandbox.processes.spawn('lint')).wait();

      expect(result).toMatchObject({ success: false, exitCode: 42 });
    });

    it('streams output incrementally instead of one lump at exit', async () => {
      boat.onCommand('seq', { stdout: 'one\ntwo\nthree\n', stdoutChunks: 3 });

      const chunks: string[] = [];
      const handle = await sandbox.processes.spawn('seq', { onStdout: chunk => chunks.push(chunk) });
      const result = await handle.wait();

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toBe('one\ntwo\nthree\n');
      expect(result.stdout).toBe('one\ntwo\nthree\n');
    });

    it('never re-emits output it has already published', async () => {
      boat.onCommand('seq', { stdout: 'abcdefghij', stdoutChunks: 5 });

      const handle = await sandbox.processes.spawn('seq');
      const result = await handle.wait();

      expect(result.stdout).toBe('abcdefghij');
    });

    it('accumulates output on a handle nobody is waiting on', async () => {
      boat.onCommand('bg', { stdout: 'running\n', runsUntilKilled: true });

      const arrived = Promise.withResolvers<void>();
      const handle = await sandbox.processes.spawn('bg', { onStdout: () => arrived.resolve() });
      await arrived.promise;

      expect(handle.stdout).toBe('running\n');
      expect(handle.exitCode).toBeUndefined();

      await handle.kill();
      await handle.wait();
    });

    it('falls back to the log file when output overflows the status tail', async () => {
      // A 5-char tail cannot carry a 26-char stream: without the log-file read
      // the head would be silently dropped.
      boat.onCommand('long', { stdout: 'abcdefghijklmnopqrstuvwxyz', stdoutChunks: 4, tailBytes: 5 });

      const result = await (await sandbox.processes.spawn('long')).wait();

      expect(result.stdout).toBe('abcdefghijklmnopqrstuvwxyz');
    });

    it('returns the same result from repeated waits', async () => {
      boat.onCommand('once', { stdout: 'x\n' });

      const handle = await sandbox.processes.spawn('once');
      expect(await handle.wait()).toEqual(await handle.wait());
    });
  });

  describe('kill', () => {
    it('signals the process and its children, then settles as unsuccessful', async () => {
      boat.onCommand('sleep', { runsUntilKilled: true });

      const handle = await sandbox.processes.spawn('sleep 60');
      expect(await handle.kill()).toBe(true);
      const result = await handle.wait();

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);

      const killCommand = boat
        .requestsTo('POST', '/sandboxes/bx_fake001/commands')
        .find(request => String(request.body?.command).includes('pkill'));
      expect(killCommand?.body?.command).toContain(`pkill -TERM -P ${handle.pid}`);
      expect(killCommand?.body).not.toHaveProperty('detached');
    });

    it('returns false for a process that already exited', async () => {
      boat.onCommand('quick', { stdout: 'done\n' });

      const handle = await sandbox.processes.spawn('quick');
      await handle.wait();

      expect(await handle.kill()).toBe(false);
    });
  });

  describe('abort', () => {
    it('never starts a command whose signal already fired', async () => {
      const controller = new AbortController();
      controller.abort();
      const before = spawnRequests().length;

      const handle = await sandbox.processes.spawn('sleep 60', { abortSignal: controller.signal });
      const result = await handle.wait();

      expect(spawnRequests()).toHaveLength(before);
      expect(result).toMatchObject({ success: false, killed: true });
    });

    it('kills a running process when the signal fires', async () => {
      boat.onCommand('sleep', { runsUntilKilled: true });
      const controller = new AbortController();

      const handle = await sandbox.processes.spawn('sleep 60', { abortSignal: controller.signal });
      controller.abort();
      const result = await handle.wait();

      expect(result.success).toBe(false);
    });
  });

  describe('timeout', () => {
    it('kills a command that outlives its timeout and marks it timed out', async () => {
      boat.onCommand('hang', { runsUntilKilled: true });

      const result = await (await sandbox.processes.spawn('hang', { timeout: 300 })).wait();

      expect(result.timedOut).toBe(true);
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('leaves a command that finishes in time alone', async () => {
      boat.onCommand('fast', { stdout: 'ok\n' });

      const result = await (await sandbox.processes.spawn('fast', { timeout: 10_000 })).wait();

      expect(result).toMatchObject({ success: true, timedOut: false });
    });
  });

  describe('stdin', () => {
    it('rejects writes, because Boat has no stdin transport', async () => {
      boat.onCommand('cat', { runsUntilKilled: true });
      const handle = await sandbox.processes.spawn('cat');

      await expect(handle.sendStdin('data')).rejects.toThrow(/stdin is not supported/);
      await expect(handle.closeStdin()).rejects.toThrow(UnsupportedStdinCloseError);

      await handle.kill();
      await handle.wait();
    });
  });

  describe('recovery', () => {
    it('re-acquires and replays the spawn when Boat has archived the sandbox', async () => {
      // Boat auto-archives on TTL expiry, so a session outliving its hour finds
      // the VM gone mid-run. The spawn should recover rather than surface a 404.
      boat.sandboxes.delete('bx_fake001');
      boat.onCommand('echo after', { stdout: 'after\n' });

      const result = await (await sandbox.processes.spawn('echo after')).wait();

      expect(result).toMatchObject({ success: true, exitCode: 0 });
      expect(result.stdout).toBe('after\n');
      expect(sandbox.status).toBe('running');
    });
  });

  describe('error classification', () => {
    /**
     * A started sandbox whose every spawn fails with one Boat error envelope.
     * `attempts` counts how many times the spawn actually reached Boat, which is
     * what distinguishes "retried after re-acquiring" from "failed outright".
     */
    const sandboxFailingSpawnsWith = async (status: number, code: string) => {
      const api = createFakeBoatApi();
      let armed = false;
      let attempts = 0;
      const failing = new BoatSandbox({
        apiKey: 'sandbox_test_key',
        fetch: async (input, init) => {
          const url = new URL(typeof input === 'string' ? input : (input as Request).url);
          if (armed && url.pathname.endsWith('/commands') && (init?.method ?? 'GET') === 'POST') {
            attempts += 1;
            return Response.json(
              { ok: false, type: 'sandbox.error', status, code, message: code, error: { code, message: code, status } },
              { status },
            );
          }
          return api.fetch(input, init);
        },
      });
      await failing._start();
      armed = true;
      return { sandbox: failing, attempts: () => attempts };
    };

    it.each([
      [409, 'fork_failed'],
      [409, 'resume_failed'],
      [409, 'account_not_ready'],
      [429, 'rate_limited'],
    ])('fails outright on %i %s rather than re-acquiring', async (status, code) => {
      // A new sandbox fixes none of these, and acquiring one costs a start
      // against the account's hourly budget.
      const { sandbox: failing, attempts } = await sandboxFailingSpawnsWith(status, code);

      await expect(failing.processes.spawn('echo x')).rejects.toMatchObject({ name: 'SandboxError' });
      expect(attempts()).toBe(1);
    });

    it.each([
      [400, 'machine_not_running'],
      [404, 'not_found'],
      [409, 'boat_starting'],
    ])('re-acquires and retries once on %i %s', async (status, code) => {
      const { sandbox: failing, attempts } = await sandboxFailingSpawnsWith(status, code);

      await expect(failing.processes.spawn('echo x')).rejects.toMatchObject({ name: 'SandboxError' });
      // Exactly twice: the original and one retry. The guard stops it looping.
      expect(attempts()).toBe(2);
    });
  });

  describe('list', () => {
    it('reports the processes this manager spawned and whether they are running', async () => {
      boat.onCommand('done', { stdout: 'x\n' });
      boat.onCommand('alive', { runsUntilKilled: true });

      const finished = await sandbox.processes.spawn('done');
      await finished.wait();
      const running = await sandbox.processes.spawn('alive');

      const listed = await sandbox.processes.list();

      expect(listed).toContainEqual({ pid: finished.pid, command: 'done', running: false, exitCode: 0 });
      expect(listed).toContainEqual({ pid: running.pid, command: 'alive', running: true });

      await running.kill();
      await running.wait();
    });
  });
});
