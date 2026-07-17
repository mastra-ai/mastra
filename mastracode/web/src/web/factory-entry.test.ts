import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalSandbox } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import type { WebAuthAdapter, WebAuthAdapterInitContext } from './auth-adapter.js';
import { MastraFactory } from './factory-entry.js';
import { getFactoryWorkspace } from './factory/workspace.js';
import {
  __resetRuntimeConfigForTests,
  getAppDatabaseUrl,
  getSeededAuthAdapter,
  getSeededSandbox,
} from './runtime-config.js';

/**
 * `MastraFactory.prepare()` wiring: explicit config flows through to the SDK
 * mount (storage, pubsub) and the auth adapter (registry seeding, one-time
 * `init()` with factory context, gate + `/auth/*` routes). The SDK mount is
 * mocked — full-boot coverage lives in `../mastra/index.test.ts`.
 */

const prepareMock = vi.fn(async (config: Record<string, unknown>) => ({
  base: '/agents',
  mastraArgs: { __capturedConfig: config },
  finalize: vi.fn(async () => {}),
}));

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

function fakeAdapter(overrides: Partial<WebAuthAdapter> = {}): WebAuthAdapter {
  return {
    kind: 'fake',
    init: vi.fn(async () => {}),
    authenticate: vi.fn(async () => null),
    ensureOrg: vi.fn(async () => undefined),
    publicRoutes: () => [{ path: '/auth/fake-login', method: 'GET', handler: c => c.redirect('/fake') }],
    sessionClearCookie: () => 'fake_session=; Max-Age=0',
    ...overrides,
  };
}

async function prepareFactory(config: ConstructorParameters<typeof MastraFactory>[0]) {
  const factory = new MastraFactory(config);
  await factory.prepare();
  expect(prepareMock).toHaveBeenCalledOnce();
  return prepareMock.mock.calls[0]![0];
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRuntimeConfigForTests();
});

afterEach(() => {
  __resetRuntimeConfigForTests();
});

describe('MastraFactory.prepare', () => {
  it('throws when called twice', async () => {
    const factory = new MastraFactory({});
    await factory.prepare();
    await expect(factory.prepare()).rejects.toThrow(/called twice/);
  });

  it('rejects overlapping concurrent calls (guard set before the first await)', async () => {
    const auth = fakeAdapter();
    const factory = new MastraFactory({ auth });
    const [first, second] = await Promise.allSettled([factory.prepare(), factory.prepare()]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    expect((second as PromiseRejectedResult).reason.message).toMatch(/called twice/);
    // The overlapping call must not double-run one-time adapter init.
    expect(auth.init).toHaveBeenCalledOnce();
    expect(prepareMock).toHaveBeenCalledOnce();
  });

  it('seeds the runtime-config registry with the explicit config', async () => {
    const auth = fakeAdapter();
    const sandbox = new LocalSandbox({ workingDirectory: '/tmp/mc-factory-test' });
    await prepareFactory({ database: 'postgres://cfg/app', auth, sandbox: { machine: sandbox } });
    expect(getAppDatabaseUrl()).toBe('postgres://cfg/app');
    expect(getSeededAuthAdapter()).toBe(auth);
    expect(getSeededSandbox()?.machine).toBe(sandbox);
  });

  it('leaves the sandbox runtime unset when the slot is omitted', async () => {
    await prepareFactory({});
    expect(getSeededSandbox()).toBeUndefined();
  });

  it('rejects a sandbox that does not implement clone()', async () => {
    const uncloneable = {
      id: 'sb-1',
      name: 'Uncloneable',
      provider: 'custom',
    } as unknown as WorkspaceSandbox;
    const factory = new MastraFactory({ sandbox: { machine: uncloneable } });
    await expect(factory.prepare()).rejects.toThrow(/does not implement clone\(\)/);
  });

  it("defaults the workdir base to the machine's workingDirectory, else /workspace", async () => {
    await prepareFactory({ sandbox: { machine: new LocalSandbox({ workingDirectory: '/srv/checkouts/' }) } });
    expect(getSeededSandbox()?.workdirBase).toBe('/srv/checkouts');

    prepareMock.mockClear();
    __resetRuntimeConfigForTests();

    const remote = {
      id: 'sb-2',
      name: 'Remote',
      provider: 'railway',
      clone: () => remote,
    } as unknown as WorkspaceSandbox;
    await prepareFactory({ sandbox: { machine: remote } });
    expect(getSeededSandbox()?.workdirBase).toBe('/workspace');
  });

  it('honors an explicit workdir override and passes maxSandboxes through', async () => {
    await prepareFactory({
      sandbox: {
        machine: new LocalSandbox({ workingDirectory: '/tmp/mc-factory-test' }),
        workdir: '/custom/base/',
        maxSandboxes: 5,
      },
    });
    expect(getSeededSandbox()?.workdirBase).toBe('/custom/base');
    expect(getSeededSandbox()?.maxSandboxes).toBe(5);
  });

  it('maps database onto the pg storage config for the SDK mount', async () => {
    const config = await prepareFactory({ database: 'postgres://cfg/app' });
    expect(config.storage).toEqual({ backend: 'pg', connectionString: 'postgres://cfg/app' });
  });

  it('installs the Web Factory workspace resolver instead of changing the SDK default', async () => {
    const config = await prepareFactory({});
    expect(config.workspace).toBe(getFactoryWorkspace);
  });

  it('omits storage when no database is configured', async () => {
    const config = await prepareFactory({});
    expect(config).not.toHaveProperty('storage');
  });

  it('passes the pubsub instance through with cross-process leases enabled', async () => {
    const pubsub = { publish: vi.fn(), subscribe: vi.fn() } as never;
    const config = await prepareFactory({ pubsub });
    expect(config.pubsub).toBe(pubsub);
    expect(config.crossProcessPubSub).toBe(true);
  });

  it('calls adapter.init once with the factory context', async () => {
    const auth = fakeAdapter();
    await prepareFactory({
      auth,
      database: 'postgres://cfg/app',
      publicUrl: 'https://factory.acme.com/',
      allowedOrigins: ['https://app.acme.com/'],
    });
    expect(auth.init).toHaveBeenCalledExactlyOnceWith({
      databaseUrl: 'postgres://cfg/app',
      publicUrl: 'https://factory.acme.com',
      allowedOrigins: ['https://app.acme.com'],
    } satisfies WebAuthAdapterInitContext);
  });

  it('surfaces adapter init failures at prepare()', async () => {
    const auth = fakeAdapter({ init: vi.fn(async () => Promise.reject(new Error('adapter misconfigured'))) });
    const factory = new MastraFactory({ auth });
    await expect(factory.prepare()).rejects.toThrow('adapter misconfigured');
  });

  it('folds the adapter /auth/* routes into buildApiRoutes when auth is configured', async () => {
    const config = await prepareFactory({ auth: fakeAdapter() });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/auth/fake-login');
    expect(paths).toContain('/auth/me');
  });

  it('omits auth routes when auth is not configured', async () => {
    const config = await prepareFactory({});
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths.some(p => p.startsWith('/auth/'))).toBe(false);
  });

  it('installs exactly one extra middleware (the auth gate) when auth is configured', async () => {
    // The SPA static middleware is environment-dependent (present when ui/dist
    // exists), so assert the delta: configuring auth prepends exactly one gate.
    const openConfig = await prepareFactory({});
    const openMiddleware = (openConfig.buildServerConfig as () => { middleware?: unknown[] })().middleware ?? [];

    prepareMock.mockClear();
    __resetRuntimeConfigForTests();

    const gatedConfig = await prepareFactory({ auth: fakeAdapter() });
    const gatedMiddleware = (gatedConfig.buildServerConfig as () => { middleware?: unknown[] })().middleware ?? [];
    expect(gatedMiddleware).toHaveLength(openMiddleware.length + 1);
  });
});

describe('MastraFactory.finalize', () => {
  it('throws before prepare()', async () => {
    const factory = new MastraFactory({});
    await expect(factory.finalize()).rejects.toThrow(/before prepare/);
  });

  it('runs the prepared finalize after prepare()', async () => {
    const factory = new MastraFactory({});
    await factory.prepare();
    await factory.finalize();
    const prepared = await prepareMock.mock.results[0]!.value;
    expect(prepared.finalize).toHaveBeenCalledOnce();
  });
});
