import { beforeEach, describe, expect, it, vi } from 'vitest';

const e2b = vi.hoisted(() => {
  class CommandExitError extends Error {
    constructor(
      readonly exitCode: number,
      readonly stdout: string,
      readonly stderr: string,
    ) {
      super(`Command exited with ${exitCode}`);
    }
  }
  class TimeoutError extends Error {}
  const run = vi.fn();
  const constructorOptions: unknown[] = [];
  class Sandbox {
    readonly commands = { run };
    constructor(options: unknown) {
      constructorOptions.push(options);
    }
  }
  return { CommandExitError, TimeoutError, Sandbox, run, constructorOptions };
});

vi.mock('e2b', () => ({
  CommandExitError: e2b.CommandExitError,
  TimeoutError: e2b.TimeoutError,
  Sandbox: e2b.Sandbox,
}));

import { execViaE2BLease } from './e2b-exec.js';

const LEASE = {
  sandboxId: 'sbx_1',
  jwt: 'envd-access-token',
  wsEndpoint: 'https://49983-sbx-1.e2b.app',
  subprotocol: 'e2b-access-token',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

describe('execViaE2BLease', () => {
  beforeEach(() => {
    e2b.run.mockReset();
    e2b.constructorOptions.length = 0;
  });

  it('authenticates directly to the leased sandbox and runs the command through envd', async () => {
    e2b.run.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
    const onStdout = vi.fn();

    const result = await execViaE2BLease(LEASE, {
      command: 'echo ok',
      cwd: '/workspace',
      env: { A: '1' },
      timeoutMs: 5_000,
      onStdout,
    });

    expect(e2b.constructorOptions).toEqual([
      {
        sandboxId: 'sbx_1',
        envdVersion: '0.4.0',
        envdAccessToken: 'envd-access-token',
        sandboxUrl: 'https://49983-sbx-1.e2b.app',
        validateApiKey: false,
      },
    ]);
    expect(e2b.run).toHaveBeenCalledWith(
      'echo ok',
      expect.objectContaining({ cwd: '/workspace', envs: { A: '1' }, timeoutMs: 5_000 }),
    );
    expect(result).toEqual({
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      truncated: false,
      timedOut: false,
      opened: true,
    });
  });

  it('returns non-zero command exits as command results', async () => {
    e2b.run.mockRejectedValue(new e2b.CommandExitError(7, 'out', 'err'));

    await expect(execViaE2BLease(LEASE, { command: 'false' })).resolves.toEqual({
      exitCode: 7,
      stdout: 'out',
      stderr: 'err',
      truncated: false,
      timedOut: false,
      opened: true,
    });
  });

  it('marks E2B timeouts as timed out and preserves streamed output', async () => {
    e2b.run.mockImplementation(async (_command, options) => {
      options.onStdout('partial');
      throw new e2b.TimeoutError('deadline exceeded');
    });

    await expect(execViaE2BLease(LEASE, { command: 'sleep 10' })).resolves.toEqual({
      exitCode: null,
      stdout: 'partial',
      stderr: '',
      truncated: false,
      timedOut: true,
      closeReason: 'deadline exceeded',
      opened: true,
    });
  });
});
