import { createSandboxLifecycleTests } from '@internal/workspace-test-utils';
import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { SandboxUnsupportedFeatureError, Workspace } from '@mastra/core/workspace';
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

  it('runs a bare command string through a shell so pipes and chaining work', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await sandbox.executeCommand("printf '%s' native-tool-ok");

    expect(bridge.execs[0]!.argv).toEqual(['/bin/bash', '-c', "printf '%s' native-tool-ok"]);
  });

  it('keeps the env prefix before the shell when running a bare command string', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge, { env: { BASE: '1' } });
    await sandbox._start();

    await sandbox.executeCommand('echo hi');

    expect(bridge.execs[0]!.argv).toEqual(['env', 'BASE=1', '/bin/bash', '-c', 'echo hi']);
  });

  it('treats an empty args array as a bare shell command string', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await sandbox.executeCommand('echo hello && echo world', []);

    expect(bridge.execs[0]!.argv).toEqual(['/bin/bash', '-c', 'echo hello && echo world']);
  });

  it('keeps explicit argument arrays literal', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await sandbox.executeCommand('printf', ['%s', 'direct-control-ok']);

    expect(bridge.execs[0]!.argv).toEqual(['printf', '%s', 'direct-control-ok']);
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

  it('rejects an explicit per-file mode without writing', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await expect(sandbox.writeFiles([{ path: 'a.txt', content: 'x', mode: 0o600 }])).rejects.toThrow(
      SandboxUnsupportedFeatureError,
    );
    expect(bridge.files.size).toBe(0);
  });

  it('reads a file back under /workspace', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();
    await sandbox.writeFiles([{ path: 'src/index.ts', content: 'export const a = 1;' }]);

    const bytes = await sandbox.readFile('src/index.ts');

    expect(Buffer.from(bytes).toString('utf8')).toBe('export const a = 1;');
  });

  it('rejects reads that escape /workspace', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    await expect(sandbox.readFile('../../etc/passwd')).rejects.toThrow(/under \/workspace/);
  });

  it('persists and hydrates /workspace through the bridge', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge);
    await sandbox._start();

    const archive = await sandbox.persistWorkspace({ excludes: ['node_modules'] });
    expect(Buffer.from(archive).toString('utf8')).toBe('fake-tar-archive');
    expect(bridge.persists.at(-1)).toBe('node_modules');

    await sandbox.hydrateWorkspace(new Uint8Array([9, 8, 7]));
    expect(Array.from(bridge.hydrations.at(-1)!)).toEqual([9, 8, 7]);
  });

  it('requires start before readFile, persistWorkspace and hydrateWorkspace', async () => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    const sandbox = createSandbox(bridge, { id: 'not-started-2' });

    await expect(sandbox.readFile('a.txt')).rejects.toThrow(/has not been started/);
    await expect(sandbox.persistWorkspace()).rejects.toThrow(/has not been started/);
    await expect(sandbox.hydrateWorkspace(new Uint8Array([1]))).rejects.toThrow(/has not been started/);
  });

  describe('mounts', () => {
    function fakeFilesystem(config: unknown, id = 'r2-fs'): WorkspaceFilesystem {
      return {
        id,
        name: id,
        provider: 's3',
        getMountConfig: () => config,
      } as unknown as WorkspaceFilesystem;
    }

    const r2Config = {
      type: 's3',
      bucket: 'agent-data',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      prefix: 'tenant-1',
      readOnly: false,
    };

    it('translates an S3-compatible mount config into a bridge mount request', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'mount-1' });
      await sandbox._start();

      const result = await sandbox.mount(fakeFilesystem(r2Config), '/workspace/data');

      expect(result).toEqual({ success: true, mountPath: '/workspace/data' });
      expect(bridge.mounts).toEqual([
        {
          bucket: 'agent-data',
          mountPath: '/workspace/data',
          options: {
            endpoint: 'https://acct.r2.cloudflarestorage.com',
            prefix: '/tenant-1',
            readOnly: false,
            credentials: { accessKeyId: 'AK', secretAccessKey: 'SK' },
          },
        },
      ]);
      expect(sandbox.mounts.get('/workspace/data')?.state).toBe('mounted');
      expect(sandbox.getInstructions()).toContain('/workspace/data');
    });

    it('normalizes the prefix and derives an endpoint to satisfy the bridge contract', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'mount-region' });
      await sandbox._start();

      const awsConfig = {
        type: 's3',
        bucket: 'agent-data',
        region: 'us-east-1',
        accessKeyId: 'AK',
        secretAccessKey: 'SK',
        prefix: 'tenant-1/',
        readOnly: true,
      };

      const result = await sandbox.mount(fakeFilesystem(awsConfig), '/workspace/data');

      expect(result).toEqual({ success: true, mountPath: '/workspace/data' });
      expect(bridge.mounts[0]?.options).toMatchObject({
        endpoint: 'https://s3.us-east-1.amazonaws.com',
        prefix: '/tenant-1/',
      });
    });

    it('unmount removes the bridge mount and the tracked entry', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'mount-2' });
      await sandbox._start();
      await sandbox.mount(fakeFilesystem(r2Config), '/workspace/data');

      await sandbox.unmount('/workspace/data');

      expect(bridge.unmounts).toEqual([{ mountPath: '/workspace/data' }]);
      expect(sandbox.mounts.has('/workspace/data')).toBe(false);
    });

    it('re-mounts a stale mount before an operation after the container sleeps', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'wake-1' });
      await sandbox._start();
      await sandbox.mount(fakeFilesystem(r2Config), '/workspace/data');
      expect(bridge.mounts).toHaveLength(1);

      // The SDK forgets the mount when the idle container stops.
      bridge.sleep();

      await sandbox.executeCommand('true');

      // The probe found the path missing and re-issued the same mount request.
      expect(bridge.mounts).toHaveLength(2);
      expect(bridge.mounts[1]).toMatchObject({ mountPath: '/workspace/data' });
      expect(bridge.activeMounts.has('/workspace/data')).toBe(true);
    });

    it('does not re-mount when the mount is still active', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'wake-2' });
      await sandbox._start();
      await sandbox.mount(fakeFilesystem(r2Config), '/workspace/data');

      await sandbox.executeCommand('true');
      await sandbox.writeFiles([{ path: 'note.txt', content: 'hi' }]);

      // Still one mount request; the probe saw the path was a live mountpoint.
      expect(bridge.mounts).toHaveLength(1);
    });

    it('does not probe when nothing is mounted', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'wake-3' });
      await sandbox._start();

      await sandbox.executeCommand('echo hi');

      expect(bridge.execs).toHaveLength(1);
      expect(bridge.execs.every(exec => !exec.argv.join(' ').includes('mountpoint'))).toBe(true);
    });

    it('mounts end-to-end through Workspace mounts on start, like other providers', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'mount-3' });
      new Workspace({ sandbox, mounts: { '/workspace/data': fakeFilesystem(r2Config) } });

      await sandbox._start();

      expect(bridge.mounts).toHaveLength(1);
      expect(sandbox.mounts.get('/workspace/data')?.state).toBe('mounted');
    });

    it('rejects mount types the bridge cannot serve without calling the bridge', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'mount-4' });
      await sandbox._start();

      const gcs = await sandbox.mount(fakeFilesystem({ type: 'gcs', bucket: 'b' }, 'gcs-fs'), '/workspace/gcs');
      const sts = await sandbox.mount(fakeFilesystem({ ...r2Config, sessionToken: 'tmp' }, 'sts-fs'), '/workspace/sts');
      const noConfig = await sandbox.mount(
        { id: 'plain', name: 'plain', provider: 'x' } as WorkspaceFilesystem,
        '/workspace/plain',
      );

      expect(gcs).toMatchObject({ success: false, error: expect.stringContaining('S3-compatible') });
      expect(sts).toMatchObject({ success: false, error: expect.stringContaining('sessionToken') });
      expect(noConfig).toMatchObject({ success: false, error: expect.stringContaining('mount config') });
      expect(bridge.mounts).toEqual([]);
      expect(sandbox.mounts.get('/workspace/gcs')?.state).toBe('error');
    });

    it('records a bridge mount failure as an error entry', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const failingFetch: typeof fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith('/mount')) return Response.json({ error: 's3fs: 403 AccessDenied' }, { status: 500 });
        return bridge.fetch(input, init);
      };
      const sandbox = createSandbox(bridge, { id: 'mount-5', fetch: failingFetch });
      await sandbox._start();

      const result = await sandbox.mount(fakeFilesystem(r2Config), '/workspace/data');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/AccessDenied/);
      expect(sandbox.mounts.get('/workspace/data')?.state).toBe('error');
    });

    it('rejects unsafe mount paths and requires start', async () => {
      const bridge = createFakeBridge({ apiToken: 'secret' });
      const sandbox = createSandbox(bridge, { id: 'mount-6' });

      await expect(sandbox.mount(fakeFilesystem(r2Config), 'relative/path')).rejects.toThrow(/Invalid mount path/);
      await expect(sandbox.mount(fakeFilesystem(r2Config), '/workspace/data')).rejects.toThrow(/has not been started/);
    });
  });

  it('tells the model /workspace is scratch space when nothing is mounted', () => {
    const sandbox = createSandbox(createFakeBridge({ apiToken: 'secret' }));
    expect(sandbox.getInstructions()).toMatch(/do NOT survive/);
    expect(sandbox.getInstructions()).not.toMatch(/persistent project files/);
  });

  it('lets a custom instructions override win', () => {
    const sandbox = createSandbox(createFakeBridge({ apiToken: 'secret' }), { instructions: 'custom text' });
    expect(sandbox.getInstructions()).toBe('custom text');
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
      supportsMounting: true,
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
