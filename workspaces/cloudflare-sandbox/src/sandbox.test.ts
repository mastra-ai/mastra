import { createSandboxLifecycleTests } from '@internal/workspace-test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CloudflareSandbox } from './sandbox';
import { createFakeBridge, type FakeBridge } from './testing/fake-bridge';

const BASE_URL = 'https://bridge.example.com';

function createSandbox(bridge: FakeBridge, options: Partial<ConstructorParameters<typeof CloudflareSandbox>[0]> = {}) {
  return new CloudflareSandbox({ baseUrl: BASE_URL, apiToken: 'secret', fetch: bridge.fetch, ...options });
}

describe('CloudflareSandbox', () => {
  it('creates a remote sandbox on start and deletes it on destroy', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge, { id: 'logical-1' });

    await sandbox._start();

    expect(bridge.sandboxes.has('sbx-1')).toBe(true);
    expect(sandbox.getInfo().id).toBe('logical-1');
    expect(sandbox.getInfo().metadata?.sandboxId).toBe('sbx-1');

    await sandbox._destroy();

    expect(bridge.sandboxes.size).toBe(0);
  });

  it('reconnects to an existing sandbox instead of creating one', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    bridge.sandboxes.add('existing-1');
    const sandbox = createSandbox(bridge, { sandboxId: 'existing-1' });

    await sandbox._start();

    expect(bridge.requests.map(request => request.url)).toEqual([`${BASE_URL}/v1/sandbox/existing-1/running`]);
    expect(sandbox.getInfo().metadata?.sandboxId).toBe('existing-1');
  });

  it('passes command, args, env and cwd through as argv', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge, { env: { BASE: '1' }, workingDirectory: '/workspace/app' });
    await sandbox._start();

    await sandbox.executeCommand('echo', ["it's fine"], { env: { EXTRA: 'a b' } });

    expect(bridge.execs[0]).toEqual({
      argv: ['env', 'BASE=1', 'EXTRA=a b', 'echo', "it's fine"],
      timeout_ms: 300_000,
      cwd: '/workspace/app',
    });
  });

  it('per-command cwd overrides the configured workingDirectory', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge, { workingDirectory: '/workspace/app' });
    await sandbox._start();

    await sandbox.executeCommand('pwd', undefined, { cwd: '/workspace/other' });

    expect(bridge.execs[0]!.cwd).toBe('/workspace/other');
    expect(sandbox.workingDirectory).toBe('/workspace/app');
  });

  it('omits cwd when no workingDirectory is configured', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await sandbox.executeCommand('pwd');

    expect(bridge.execs[0]!.cwd).toBeUndefined();
    expect(sandbox.workingDirectory).toBeUndefined();
  });

  it('setEnv after construction reaches subsequent commands', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'tok_1' }));
    await sandbox.executeCommand('echo', ['hi']);

    expect(bridge.execs[0]!.argv).toEqual(['env', 'GH_TOKEN=tok_1', 'echo', 'hi']);
  });

  it('decodes streamed output and reports the exit code', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    bridge.onExec = () => ({ stdout: 'hello wörld\n', stderr: 'oops\n', exitCode: 2, stdoutChunks: 5 });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const result = await sandbox.executeCommand('echo', ['hello'], {
      onStdout: chunk => stdoutChunks.push(chunk),
      onStderr: chunk => stderrChunks.push(chunk),
    });

    expect(result.stdout).toBe('hello wörld\n');
    expect(result.stderr).toBe('oops\n');
    expect(result.exitCode).toBe(2);
    expect(result.success).toBe(false);
    expect(stdoutChunks.join('')).toBe('hello wörld\n');
    expect(stderrChunks.join('')).toBe('oops\n');
  });

  it('records bridge error events as stderr', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    bridge.onExec = () => ({ error: { error: 'container is gone', code: 'NOT_RUNNING' } });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    const result = await sandbox.executeCommand('echo', ['hi']);

    expect(result.stderr).toContain('container is gone');
    expect(result.success).toBe(false);
  });

  it('writes each file with its own request under /workspace', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await sandbox.writeFiles([
      { path: 'src/index.ts', content: 'export const a = 1;' },
      { path: '/workspace/bin/data', content: Buffer.from('hi') },
    ]);

    expect(bridge.files.get('/workspace/src/index.ts')).toBe('export const a = 1;');
    expect(bridge.files.get('/workspace/bin/data')).toBe('hi');
  });

  it('rejects writes that escape /workspace', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await expect(sandbox.writeFiles([{ path: '/etc/passwd', content: 'x' }])).rejects.toThrow(/under \/workspace/);
    await expect(sandbox.writeFiles([{ path: '../../etc/passwd', content: 'x' }])).rejects.toThrow(/under \/workspace/);
    expect(bridge.files.size).toBe(0);
  });

  it('requires start before remote operations', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge, { id: 'not-started' });

    await expect(sandbox.executeCommand('echo', ['hi'])).rejects.toThrow(/has not been started/);
    await expect(sandbox.writeFiles([{ path: 'a.txt', content: 'x' }])).rejects.toThrow(/has not been started/);
  });
});

describe('CloudflareSandbox conformance', () => {
  const bridge = createFakeBridge({ apiToken: 'secret' });
  let sandbox: CloudflareSandbox;

  beforeAll(async () => {
    sandbox = createSandbox(bridge, { id: `conformance-${Date.now()}` });
    await sandbox._start();
  });

  afterAll(async () => {
    await sandbox._destroy();
  });

  createSandboxLifecycleTests(() => ({
    sandbox,
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      defaultCommandTimeout: 5000,
      supportsStreaming: true,
      supportsStdin: false,
    },
    testTimeout: 5000,
    fastOnly: false,
    createSandbox: () => createSandbox(bridge),
  }));
});
