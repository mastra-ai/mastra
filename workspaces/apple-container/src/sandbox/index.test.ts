import { SandboxExecutionError } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { appleContainerSandboxProvider } from '../provider';
import { AppleContainerSandbox, runAppleContainerCli } from './index';
import type { AppleContainerCliResult, AppleContainerCommandRunner, AppleContainerCommandRunnerOptions } from './index';

type RunnerResponse =
  | Partial<AppleContainerCliResult>
  | ((args: string[], options?: AppleContainerCommandRunnerOptions) => Partial<AppleContainerCliResult>);

type MockRunner = AppleContainerCommandRunner & { run: ReturnType<typeof vi.fn> };

function createRunner(responses: RunnerResponse[] = []): MockRunner {
  const queue = [...responses];

  return {
    run: vi.fn(async (args: string[], options?: AppleContainerCommandRunnerOptions) => {
      const response = queue.shift();
      if (response === undefined) {
        throw new Error(`Unexpected runner invocation: ${JSON.stringify(args)}`);
      }
      const resolved = typeof response === 'function' ? response(args, options) : response;
      return cliResult(resolved);
    }),
  };
}

function expectCliCall(
  runner: MockRunner,
  call: number,
  args: string[],
  options: unknown = expect.objectContaining({ timeout: 300_000 }),
): void {
  expect(runner.run).toHaveBeenNthCalledWith(call, args, options);
}

function cliResult(overrides: Partial<AppleContainerCliResult> = {}): AppleContainerCliResult {
  return {
    success: true,
    exitCode: 0,
    stdout: '',
    stderr: '',
    executionTimeMs: 1,
    ...overrides,
  };
}

function inspectResult(status: string, id = 'container-123'): Partial<AppleContainerCliResult> {
  return {
    stdout: JSON.stringify([
      {
        id,
        status: {
          state: status,
          networks: [{ network: 'default' }],
        },
        configuration: {
          id,
          labels: {
            'mastra.sandbox': 'true',
            'mastra.sandbox.id': 'apple-test',
          },
          resources: {
            cpus: 2,
            memoryInBytes: 1024 * 1024 * 512,
          },
        },
      },
    ]),
  };
}

function unownedInspectResult(status: string, id = 'container-123'): Partial<AppleContainerCliResult> {
  return {
    stdout: JSON.stringify([
      {
        id,
        status: { state: status },
        configuration: {
          id,
          labels: {
            app: 'not-mastra',
          },
        },
      },
    ]),
  };
}

function missingContainerResult(): Partial<AppleContainerCliResult> {
  return { success: false, exitCode: 1, stderr: 'container not found' };
}

describe('AppleContainerSandbox', () => {
  it('uses default identity and instructions', () => {
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner: createRunner() });

    expect(sandbox.id).toBe('apple-test');
    expect(sandbox.name).toBe('AppleContainerSandbox');
    expect(sandbox.provider).toBe('apple-container');
    expect(sandbox.status).toBe('pending');
    expect(sandbox.getInstructions()).toContain('Apple container sandbox');
  });

  it('creates a long-lived Apple container when none exists', async () => {
    const runner = createRunner([missingContainerResult(), { stdout: 'created\n' }]);
    const sandbox = new AppleContainerSandbox({
      id: 'apple-test',
      image: 'python:3.12-slim',
      command: ['sleep', '9999'],
      env: { NODE_ENV: 'test' },
      volumes: { '/host/project': '/workspace' },
      mounts: ['source=/host/cache,target=/cache'],
      network: 'bridge',
      publishedPorts: ['127.0.0.1:8080:80'],
      publishedSockets: ['/tmp/app.sock:/var/run/app.sock'],
      cpus: 2,
      memory: '1G',
      platform: 'linux/arm64',
      arch: 'arm64',
      os: 'linux',
      rosetta: true,
      readonlyRootfs: true,
      ssh: true,
      init: true,
      virtualization: true,
      capAdd: ['NET_BIND_SERVICE'],
      capDrop: ['MKNOD'],
      tmpfs: ['/tmp:rw,size=64m'],
      dns: ['1.1.1.1'],
      dnsSearch: ['example.test'],
      noDns: true,
      labels: { app: 'mastra' },
      workingDir: '/workspace',
      runner,
    });

    await sandbox._start();

    expectCliCall(runner, 1, ['inspect', 'apple-test']);
    expectCliCall(runner, 2, [
      'run',
      '-d',
      '--name',
      'apple-test',
      '--workdir',
      '/workspace',
      '--env',
      'NODE_ENV=test',
      '--volume',
      '/host/project:/workspace',
      '--mount',
      'source=/host/cache,target=/cache',
      '--label',
      'app=mastra',
      '--label',
      'mastra.sandbox=true',
      '--label',
      'mastra.sandbox.id=apple-test',
      '--publish',
      '127.0.0.1:8080:80',
      '--publish-socket',
      '/tmp/app.sock:/var/run/app.sock',
      '--cap-add',
      'NET_BIND_SERVICE',
      '--cap-drop',
      'MKNOD',
      '--tmpfs',
      '/tmp:rw,size=64m',
      '--dns',
      '1.1.1.1',
      '--dns-search',
      'example.test',
      '--network',
      'bridge',
      '--cpus',
      '2',
      '--memory',
      '1G',
      '--platform',
      'linux/arm64',
      '--arch',
      'arm64',
      '--os',
      'linux',
      '--rosetta',
      '--read-only',
      '--ssh',
      '--init',
      '--virtualization',
      '--no-dns',
      'python:3.12-slim',
      'sleep',
      '9999',
    ]);
    expect(sandbox.status).toBe('running');
  });

  it('keeps status in sync when plain lifecycle methods are called', async () => {
    const runner = createRunner([
      missingContainerResult(),
      {},
      inspectResult('running'),
      {},
      inspectResult('stopped'),
      {},
    ]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox.start();
    expect(sandbox.status).toBe('running');

    await sandbox.stop();
    expect(sandbox.status).toBe('stopped');

    await sandbox.destroy();
    expect(sandbox.status).toBe('destroyed');
  });

  it('reconnects to an existing stopped container', async () => {
    const runner = createRunner([inspectResult('stopped', 'existing-id'), {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox._start();

    expectCliCall(runner, 1, ['inspect', 'apple-test']);
    expectCliCall(runner, 2, ['start', 'existing-id']);
    expect(sandbox.containerId).toBe('existing-id');
  });

  it('reconnects to an existing running container without restarting it', async () => {
    const runner = createRunner([inspectResult('running', 'existing-id')]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox._start();

    expect(runner.run).toHaveBeenCalledOnce();
    expect(runner.run).toHaveBeenCalledWith(['inspect', 'apple-test'], expect.objectContaining({ timeout: 300_000 }));
    expect(sandbox.containerId).toBe('existing-id');
    expect(sandbox.status).toBe('running');
  });

  it('refuses to reconnect to a container without matching Mastra labels', async () => {
    const runner = createRunner([unownedInspectResult('running', 'existing-id')]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      message: expect.stringContaining('not labeled as Mastra sandbox apple-test'),
    });
    expect(sandbox.status).toBe('error');
    expect(runner.run).toHaveBeenCalledOnce();
  });

  it('throws when reconnecting to a stopped container fails', async () => {
    const runner = createRunner([
      inspectResult('stopped', 'existing-id'),
      { success: false, exitCode: 5, stderr: 'start failed' },
    ]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      exitCode: 5,
      stderr: 'start failed',
    });
    expect(sandbox.status).toBe('error');
  });

  it('executes commands with env, cwd, timeout, streaming and retained output options', async () => {
    const runner = createRunner([missingContainerResult(), {}, { stdout: 'hello\n' }]);
    const onStdout = vi.fn();
    const sandbox = new AppleContainerSandbox({
      id: 'apple-test',
      env: { BASE: '1' },
      runner,
    });

    await sandbox._start();
    runner.run.mockClear();

    const result = await sandbox.executeCommand('node', ['-e', 'console.log("hello")'], {
      cwd: '/app',
      env: { EXTRA: '2' },
      timeout: 1234,
      onStdout,
      maxRetainedBytes: 16,
    });

    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      stdout: 'hello\n',
      command: 'node -e \'console.log("hello")\'',
      args: ['-e', 'console.log("hello")'],
    });
    expect(runner.run).toHaveBeenCalledWith(
      [
        'exec',
        '--env',
        'BASE=1',
        '--env',
        'EXTRA=2',
        '--workdir',
        '/app',
        'apple-test',
        'sh',
        '-lc',
        expect.stringContaining("timeout 1.234s sh -lc 'node -e '\\''console.log(\"hello\")'\\'''"),
      ],
      expect.objectContaining({
        timeout: 11_234,
        onStdout,
        maxRetainedBytes: 16,
      }),
    );
  });

  it('quotes args before executing through the shell', async () => {
    const runner = createRunner([missingContainerResult(), {}, {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox._start();
    runner.run.mockClear();

    await sandbox.executeCommand('printf', ['hello; touch /tmp/pwned']);

    const [cliArgs, cliOptions] = runner.run.mock.calls[0];
    expect(cliArgs.slice(0, -1)).toEqual(['exec', '--workdir', '/workspace', 'apple-test', 'sh', '-lc']);
    expect(cliArgs.at(-1)).toContain('printf');
    expect(cliArgs.at(-1)).toContain('hello; touch /tmp/pwned');
    expect(cliArgs.at(-1)).toContain("'\\''hello; touch /tmp/pwned'\\'''");
    expect(cliOptions).toEqual(expect.objectContaining({ timeout: 310_000 }));
  });

  it('preserves shell command strings when no args are provided', async () => {
    const runner = createRunner([missingContainerResult(), {}, {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox._start();
    runner.run.mockClear();

    await sandbox.executeCommand('printf apple-container');

    expect(runner.run).toHaveBeenCalledWith(
      [
        'exec',
        '--workdir',
        '/workspace',
        'apple-test',
        'sh',
        '-lc',
        expect.stringContaining('printf apple-container'),
      ],
      expect.objectContaining({ timeout: 310_000 }),
    );
  });

  it('marks in-container timeout exits as timed out', async () => {
    const runner = createRunner([missingContainerResult(), {}, { success: false, exitCode: 124, stderr: 'Terminated' }]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    const result = await sandbox.executeCommand('sleep', ['30'], { timeout: 10 });

    expect(result).toMatchObject({
      success: false,
      exitCode: 124,
      timedOut: true,
      killed: true,
    });
    expect(runner.run).toHaveBeenLastCalledWith(
      [
        'exec',
        '--workdir',
        '/workspace',
        'apple-test',
        'sh',
        '-lc',
        expect.stringContaining("timeout 0.01s sh -lc 'sleep 30'"),
      ],
      expect.objectContaining({ timeout: 10_010 }),
    );
  });

  it('stops instead of deletes when deleteOnDestroy is disabled', async () => {
    const runner = createRunner([inspectResult('running'), {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', deleteOnDestroy: false, runner });

    await sandbox.destroy();

    expectCliCall(runner, 1, ['inspect', 'apple-test']);
    expectCliCall(runner, 2, ['stop', 'apple-test']);
  });

  it('does not stop when the container is already stopped or missing', async () => {
    const stoppedRunner = createRunner([inspectResult('stopped')]);
    const missingRunner = createRunner([missingContainerResult()]);

    await new AppleContainerSandbox({ id: 'apple-stopped', runner: stoppedRunner }).stop();
    await new AppleContainerSandbox({ id: 'apple-missing', runner: missingRunner }).stop();

    expect(stoppedRunner.run).toHaveBeenCalledOnce();
    expect(missingRunner.run).toHaveBeenCalledOnce();
  });

  it('ignores a missing container race while stopping', async () => {
    const runner = createRunner([inspectResult('running'), missingContainerResult()]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox.stop();

    expect(sandbox.status).toBe('stopped');
    expectCliCall(runner, 2, ['stop', 'apple-test']);
  });

  it('deletes existing containers on destroy by default', async () => {
    const runner = createRunner([inspectResult('running'), {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox.destroy();

    expectCliCall(runner, 1, ['inspect', 'apple-test']);
    expectCliCall(runner, 2, ['delete', '--force', 'apple-test']);
  });

  it('does not delete when the container is missing', async () => {
    const runner = createRunner([missingContainerResult()]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox.destroy();

    expect(sandbox.status).toBe('destroyed');
    expect(runner.run).toHaveBeenCalledOnce();
  });

  it('ignores a missing container race while deleting', async () => {
    const runner = createRunner([inspectResult('running'), missingContainerResult()]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox.destroy();

    expect(sandbox.status).toBe('destroyed');
    expectCliCall(runner, 2, ['delete', '--force', 'apple-test']);
  });

  it('throws when stop fails unexpectedly', async () => {
    const runner = createRunner([
      inspectResult('running'),
      { success: false, exitCode: 3, stderr: 'permission denied' },
    ]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.stop()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      exitCode: 3,
      stderr: 'permission denied',
    });
    expect(sandbox.status).toBe('error');
  });

  it('throws when destroy fails unexpectedly', async () => {
    const runner = createRunner([
      inspectResult('running'),
      { success: false, exitCode: 4, stderr: 'delete failed' },
    ]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.destroy()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      exitCode: 4,
      stderr: 'delete failed',
    });
    expect(sandbox.status).toBe('error');
  });

  it('surfaces inspect JSON parse errors with CLI output', async () => {
    const runner = createRunner([{ stdout: 'not json' }]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      stdout: 'not json',
    });
  });

  it('throws when inspect fails for an unexpected reason', async () => {
    const runner = createRunner([{ success: false, exitCode: 7, stderr: 'container service unavailable' }]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      exitCode: 7,
      stderr: 'container service unavailable',
    });
    expect(sandbox.status).toBe('error');
  });

  it('throws SandboxExecutionError when create fails', async () => {
    const runner = createRunner([
      missingContainerResult(),
      { success: false, exitCode: 2, stderr: 'bad image' },
    ]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      exitCode: 2,
      stderr: 'bad image',
    });
    expect(sandbox.status).toBe('error');
  });
});

describe('appleContainerSandboxProvider', () => {
  it('describes the Apple container sandbox provider', () => {
    expect(appleContainerSandboxProvider.id).toBe('apple-container');
    expect(appleContainerSandboxProvider.name).toBe('Apple Container Sandbox');
    expect(appleContainerSandboxProvider.description).toContain('Apple container');
  });

  it('creates an AppleContainerSandbox from serializable config', () => {
    const sandbox = appleContainerSandboxProvider.createSandbox({
      image: 'node:22-slim',
      env: { NODE_ENV: 'test' },
      readonlyRootfs: true,
    });

    expect(sandbox).toBeInstanceOf(AppleContainerSandbox);
  });

  it('exposes an exact serializable Studio schema', () => {
    const schema = appleContainerSandboxProvider.configSchema as {
      additionalProperties?: boolean;
      properties?: Record<string, unknown>;
    };

    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      [
        'arch',
        'capAdd',
        'capDrop',
        'command',
        'cpus',
        'deleteOnDestroy',
        'dns',
        'dnsSearch',
        'env',
        'image',
        'init',
        'labels',
        'memory',
        'mounts',
        'name',
        'network',
        'noDns',
        'os',
        'platform',
        'publishedPorts',
        'publishedSockets',
        'readonlyRootfs',
        'rosetta',
        'ssh',
        'timeout',
        'tmpfs',
        'virtualization',
        'volumes',
        'workingDir',
      ].sort(),
    );
    expect(schema.properties).not.toHaveProperty('containerBinary');
  });
});

describe('runAppleContainerCli', () => {
  it('captures stdout and stderr from a child process', async () => {
    const result = await runAppleContainerCli(process.execPath, [
      '-e',
      'process.stdout.write("out"); process.stderr.write("err");',
    ]);

    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      stdout: 'out',
      stderr: 'err',
      timedOut: false,
      killed: false,
    });
  });

  it('retains only the newest output when maxRetainedBytes is set', async () => {
    const result = await runAppleContainerCli(
      process.execPath,
      ['-e', 'process.stdout.write("0123456789"); process.stderr.write("abcdefghij");'],
      { maxRetainedBytes: 4 },
    );

    expect(result.stdout).toBe('6789');
    expect(result.stderr).toBe('ghij');
    expect(result.stdoutTruncated).toBe(true);
    expect(result.stderrTruncated).toBe(true);
    expect(result.stdoutDroppedBytes).toBe(6);
    expect(result.stderrDroppedBytes).toBe(6);
  });

  it('times out and marks the command as killed', async () => {
    const result = await runAppleContainerCli(process.execPath, ['-e', 'setTimeout(() => {}, 1000);'], {
      timeout: 10,
    });

    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.killed).toBe(true);
  });

  it('aborts a running command', async () => {
    const controller = new AbortController();
    const resultPromise = runAppleContainerCli(process.execPath, ['-e', 'setTimeout(() => {}, 1000);'], {
      abortSignal: controller.signal,
    });

    controller.abort();

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.killed).toBe(true);
  });

  it('validates retained output limits with the shared process handle rules', () => {
    expect(() => runAppleContainerCli(process.execPath, ['--version'], { maxRetainedBytes: -1 })).toThrow(RangeError);
  });

  it('rejects with SandboxExecutionError when the CLI binary is missing', async () => {
    await expect(runAppleContainerCli('/definitely/missing/container', [])).rejects.toBeInstanceOf(
      SandboxExecutionError,
    );
  });
});
