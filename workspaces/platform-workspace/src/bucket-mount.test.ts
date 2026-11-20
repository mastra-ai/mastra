import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { E2BFiles } from './e2b-exec.js';
import { PlatformSandbox } from './sandbox.js';

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 201, headers: { 'content-type': 'application/json' } });
}

const lease = () =>
  json({
    provider: 'e2b',
    sandboxId: 'sbx_1',
    providerResourceId: 'e2b_sbx_1',
    jwt: 'envd-access-token',
    wsEndpoint: 'https://49983-e2b-sbx-1.e2b.app',
    subprotocol: 'e2b-access-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });

const bucketMount = {
  endpoint: 'https://proxy.test/v1/s3',
  bucket: 'agent-a',
  region: 'auto',
  accessKeyId: 'MGW1claims',
  secretAccessKey: 'gateway-secret',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

/** Exec runner that answers each command by the first matching prefix in `exits`. */
function execRunner(exits: Record<string, number>) {
  return vi.fn(async (_lease: unknown, options: { command: string }) => {
    const match = Object.keys(exits).find(prefix => options.command.includes(prefix));
    return {
      exitCode: match ? exits[match]! : 0,
      stdout: '',
      stderr: '',
      truncated: false,
      timedOut: false,
      opened: true,
    };
  });
}

function setup(options: { mountBucket?: string; exits?: Record<string, number> }) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ id: 'sbx_1', createdAt: '2026-11-20T00:00:00.000Z', bucketMount }))
    .mockResolvedValueOnce(lease());
  const write = vi.fn().mockResolvedValue(undefined);
  const e2bExecRunner = execRunner(options.exits ?? {});
  const sandbox = new PlatformSandbox({
    accessToken: 'sk_test',
    projectId: 'proj_1',
    environmentId: 'env_1',
    fetch: fetchMock,
    e2bExecRunner,
    e2bFilesFactory: () => ({ write }) as unknown as E2BFiles,
    ...(options.mountBucket && { mountBucket: options.mountBucket }),
  });
  const commands = () => e2bExecRunner.mock.calls.map(([, call]) => call.command);
  const createBody = () => JSON.parse(String(fetchMock.mock.calls[0]![1].body));
  return { sandbox, write, commands, createBody };
}

describe('PlatformSandbox bucket mount', () => {
  beforeEach(() => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('mounts the bucket at /workspace with the issued gateway keys', async () => {
    const { sandbox, write, commands, createBody } = setup({ mountBucket: 'agent-a', exits: { 'mountpoint -q': 1 } });
    // The pre-mount probe says "not mounted"; the post-mount check must pass.
    let probes = 0;
    const runner = sandbox['_e2bExecRunner'];
    sandbox['_e2bExecRunner'] = (l, o) =>
      o.command.includes('mountpoint -q') && probes++ > 0 ? runner(l, { ...o, command: 'true' }) : runner(l, o);

    await sandbox._start();

    expect(createBody().mountBucket).toBe('agent-a');
    expect(write).toHaveBeenCalledWith('/tmp/.passwd-s3fs-workspace', 'MGW1claims:gateway-secret');
    const mount = commands().find(command => command.includes('s3fs '))!;
    expect(mount).toContain('sudo s3fs agent-a /workspace');
    expect(mount).toContain('-o url=https://proxy.test/v1/s3');
    expect(mount).toContain('-o use_path_request_style');
    expect(mount).not.toContain('gateway-secret');
    expect(sandbox.bucketMount).toEqual({ state: 'mounted' });
  });

  it('reports unavailable and keeps running when s3fs is missing', async () => {
    const { sandbox, write, commands } = setup({
      mountBucket: 'agent-a',
      exits: { 'mountpoint -q': 1, 'command -v s3fs': 1 },
    });

    await sandbox._start();

    expect(sandbox.status).toBe('running');
    expect(sandbox.bucketMount).toMatchObject({ state: 'unavailable' });
    expect(write).not.toHaveBeenCalled();
    expect(commands().some(command => command.includes('s3fs '))).toBe(false);
  });

  it('reports an error and keeps running when the mount does not attach', async () => {
    const { sandbox } = setup({ mountBucket: 'agent-a', exits: { 'mountpoint -q': 1 } });

    await sandbox._start();

    expect(sandbox.status).toBe('running');
    expect(sandbox.bucketMount).toMatchObject({ state: 'error' });
  });

  it('does not mount without mountBucket', async () => {
    const { sandbox, write, commands, createBody } = setup({});

    await sandbox._start();

    expect(createBody().mountBucket).toBeUndefined();
    expect(sandbox.bucketMount).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(commands()).toEqual([]);
  });
});
