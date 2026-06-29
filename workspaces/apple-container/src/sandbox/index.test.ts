import { SandboxExecutionError } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { AppleContainerSandbox, runAppleContainerCli } from './index';
import type { AppleContainerCliResult, AppleContainerCommandRunner, AppleContainerCommandRunnerOptions } from './index';

type RunnerResponse =
  | Partial<AppleContainerCliResult>
  | ((args: string[], options?: AppleContainerCommandRunnerOptions) => Partial<AppleContainerCliResult>);

function createRunner(
  responses: RunnerResponse[] = [],
): AppleContainerCommandRunner & { run: ReturnType<typeof vi.fn> } {
  const queue = [...responses];

  return {
    run: vi.fn(async (args: string[], options?: AppleContainerCommandRunnerOptions) => {
      const response = queue.shift();
      const resolved = typeof response === 'function' ? response(args, options) : response;
      return cliResult(resolved);
    }),
  };
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
        status,
        configuration: {
          id,
          resources: {
            cpus: 2,
            memoryInBytes: 1024 * 1024 * 512,
          },
        },
      },
    ]),
  };
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
    const runner = createRunner([
      { success: false, exitCode: 1, stderr: 'container not found' },
      { stdout: 'created\n' },
    ]);
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
      readOnlyRootfs: true,
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

    expect(runner.run).toHaveBeenNthCalledWith(1, ['inspect', 'apple-test']);
    expect(runner.run).toHaveBeenNthCalledWith(2, [
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

  it('reconnects to an existing stopped container', async () => {
    const runner = createRunner([inspectResult('stopped', 'existing-id'), {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox._start();

    expect(runner.run).toHaveBeenNthCalledWith(1, ['inspect', 'apple-test']);
    expect(runner.run).toHaveBeenNthCalledWith(2, ['start', 'existing-id']);
    expect(sandbox.containerId).toBe('existing-id');
  });

  it('executes commands with env, cwd, timeout, streaming and retained output options', async () => {
    const runner = createRunner([
      { success: false, exitCode: 1, stderr: 'container not found' },
      {},
      { stdout: 'hello\n' },
    ]);
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
        'node -e \'console.log("hello")\'',
      ],
      expect.objectContaining({
        timeout: 1234,
        onStdout,
        maxRetainedBytes: 16,
      }),
    );
  });

  it('stops instead of deletes when deleteOnDestroy is disabled', async () => {
    const runner = createRunner([inspectResult('running'), {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', deleteOnDestroy: false, runner });

    await sandbox.destroy();

    expect(runner.run).toHaveBeenNthCalledWith(1, ['inspect', 'apple-test']);
    expect(runner.run).toHaveBeenNthCalledWith(2, ['stop', 'apple-test']);
  });

  it('deletes existing containers on destroy by default', async () => {
    const runner = createRunner([inspectResult('running'), {}]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await sandbox.destroy();

    expect(runner.run).toHaveBeenNthCalledWith(1, ['inspect', 'apple-test']);
    expect(runner.run).toHaveBeenNthCalledWith(2, ['delete', '--force', 'apple-test']);
  });

  it('surfaces inspect JSON parse errors with CLI output', async () => {
    const runner = createRunner([{ stdout: 'not json' }]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      stdout: 'not json',
    });
  });

  it('throws SandboxExecutionError when create fails', async () => {
    const runner = createRunner([
      { success: false, exitCode: 1, stderr: 'container not found' },
      { success: false, exitCode: 2, stderr: 'bad image' },
    ]);
    const sandbox = new AppleContainerSandbox({ id: 'apple-test', runner });

    await expect(sandbox.start()).rejects.toMatchObject({
      name: 'SandboxExecutionError',
      exitCode: 2,
      stderr: 'bad image',
    });
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

  it('rejects with SandboxExecutionError when the CLI binary is missing', async () => {
    await expect(runAppleContainerCli('/definitely/missing/container', [])).rejects.toBeInstanceOf(
      SandboxExecutionError,
    );
  });
});
