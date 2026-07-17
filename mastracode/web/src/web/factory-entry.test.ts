import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalSandbox } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { PostgresStore, PgVector } from '@mastra/pg';
import type { WebAuthAdapter, WebAuthAdapterInitContext } from './auth-adapter.js';
import { MastraFactory } from './factory-entry.js';
import { getFactoryWorkspace } from './factory/workspace.js';
import type { FactoryIntegration, IntegrationContext } from './factory-integration.js';
import {
  __resetRuntimeConfigForTests,
  getFactoryStore,
  getSeededAuthAdapter,
  getSeededIntegration,
  getSeededSandbox,
  getSeededStateSigner,
  getSeededStorage,
  getSharedAppPool,
} from './runtime-config.js';
import { FactoryStore } from './storage/factory-store.js';

/**
 * A PostgresStore whose init is stubbed — prepare() must call it (single init
 * path) but these wiring tests never reach a real database. FactoryStore.init
 * is stubbed at the prototype for the same reason (its per-domain DDL is
 * covered by the pg domain suites).
 */
function fakePgStorage(): PostgresStore {
  const storage = new PostgresStore({ id: 'factory-test-storage', connectionString: 'postgres://cfg/app' });
  vi.spyOn(storage, 'init').mockResolvedValue(undefined);
  return storage;
}

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
  // Domain DDL never runs in these wiring tests (covered by the pg domain suites).
  vi.spyOn(FactoryStore.prototype, 'init').mockResolvedValue(undefined);
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
    const storage = fakePgStorage();
    await prepareFactory({ storage, auth, sandbox: { machine: sandbox } });
    expect(getSeededStorage()).toBe(storage);
    expect(getSharedAppPool()).toBe(storage.pool);
    expect(getSeededAuthAdapter()).toBe(auth);
    expect(getSeededSandbox()?.machine).toBe(sandbox);
  });

  it('runs the single init path: storage.init() then the factory domains', async () => {
    const storage = fakePgStorage();
    await prepareFactory({ storage });
    expect(storage.init).toHaveBeenCalledOnce();
    expect(FactoryStore.prototype.init).toHaveBeenCalledExactlyOnceWith({ pool: storage.pool });
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

  it('forwards the storage and vector instances to the SDK mount', async () => {
    const storage = fakePgStorage();
    const vector = new PgVector({ id: 'factory-test-vectors', connectionString: 'postgres://cfg/app' });
    const config = await prepareFactory({ storage, vector });
    expect(config.storage).toBe(storage);
    expect(config.vectorStore).toBe(vector);
  });

  it('installs the Web Factory workspace resolver instead of changing the SDK default', async () => {
    const config = await prepareFactory({});
    expect(config.workspace).toBe(getFactoryWorkspace);
  });

  it('omits storage when no instance is configured', async () => {
    const config = await prepareFactory({});
    expect(config).not.toHaveProperty('storage');
    expect(config).not.toHaveProperty('vectorStore');
  });

  it('passes the pubsub instance through with cross-process leases enabled', async () => {
    const pubsub = { publish: vi.fn(), subscribe: vi.fn() } as never;
    const config = await prepareFactory({ pubsub });
    expect(config.pubsub).toBe(pubsub);
    expect(config.crossProcessPubSub).toBe(true);
  });

  it('calls adapter.init once with the factory context', async () => {
    const auth = fakeAdapter();
    const storage = fakePgStorage();
    await prepareFactory({
      auth,
      storage,
      publicUrl: 'https://factory.acme.com/',
      allowedOrigins: ['https://app.acme.com/'],
    });
    expect(auth.init).toHaveBeenCalledExactlyOnceWith({
      storage,
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

  it('installs the auth gate and tenant credential primer when auth is configured', async () => {
    // The SPA static middleware is environment-dependent (present when ui/dist
    // exists), so assert the delta from the two auth-specific middleware.
    const openConfig = await prepareFactory({});
    const openMiddleware = (openConfig.buildServerConfig as () => { middleware?: unknown[] })().middleware ?? [];

    prepareMock.mockClear();
    __resetRuntimeConfigForTests();

    const gatedConfig = await prepareFactory({ auth: fakeAdapter() });
    const gatedMiddleware = (gatedConfig.buildServerConfig as () => { middleware?: unknown[] })().middleware ?? [];
    expect(gatedMiddleware).toHaveLength(openMiddleware.length + 2);
  });
});

function fakeIntegration(overrides: Partial<FactoryIntegration> & { id: string }): FactoryIntegration {
  return {
    routes: vi.fn((_ctx: IntegrationContext) => []),
    diagnostics: () => ({}),
    ...overrides,
  };
}

describe('MastraFactory.prepare integrations', () => {
  it('rejects duplicate integration ids', async () => {
    const factory = new MastraFactory({
      integrations: [fakeIntegration({ id: 'custom' }), fakeIntegration({ id: 'custom' })],
    });
    await expect(factory.prepare()).rejects.toThrow(/duplicate integration id 'custom'/);
  });

  it('seeds integrations into the runtime-config registry', async () => {
    const custom = fakeIntegration({ id: 'custom' });
    await prepareFactory({ integrations: [custom] });
    expect(getSeededIntegration('custom')).toBe(custom);
    expect(getSeededIntegration('missing')).toBeUndefined();
  });

  it('registers an integration-provided storage domain into the FactoryStore', async () => {
    const domain = { name: 'custom-domain', init: vi.fn(async () => {}) };
    const custom = fakeIntegration({ id: 'custom', storageDomain: domain });
    await prepareFactory({ storage: fakePgStorage(), integrations: [custom] });
    expect(getFactoryStore().get('custom-domain')).toBe(domain);
  });

  it("folds a ready integration's routes into buildApiRoutes", async () => {
    const routes = vi.fn((_ctx: IntegrationContext) => [
      { path: '/web/custom/status', method: 'GET' as const, handler: () => new Response() },
    ]);
    const config = await prepareFactory({ integrations: [fakeIntegration({ id: 'custom', routes })] });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/web/custom/status');
    const ctx = routes.mock.calls[0]![0];
    expect(ctx.stateSigner).toBe(getSeededStateSigner());
    expect(typeof ctx.hooks?.runIssueTriage).toBe('function');
  });

  it('mounts disabled-status stubs for the known ids when no integrations are registered', async () => {
    const config = await prepareFactory({});
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/web/github/status');
    expect(paths).toContain('/web/linear/status');
  });

  it('merges agentTools and sessionTools from ready integrations into extraTools', async () => {
    const agentTool = { description: 'agent' };
    const sessionTool = { description: 'session' };
    const custom = fakeIntegration({
      id: 'custom',
      agentTools: vi.fn(async () => ({ customAgentTool: agentTool }) as never),
      sessionTools: vi.fn(() => ({ customSessionTool: sessionTool }) as never),
    });
    const config = await prepareFactory({ integrations: [custom] });
    const extraTools = config.extraTools as (args: { requestContext: object }) => Promise<Record<string, unknown>>;
    const tools = await extraTools({ requestContext: {} });
    expect(tools.customAgentTool).toBe(agentTool);
    expect(tools.customSessionTool).toBe(sessionTool);
  });

  it('omits extraTools when no integration contributes tools', async () => {
    const config = await prepareFactory({ integrations: [fakeIntegration({ id: 'custom' })] });
    expect(config).not.toHaveProperty('extraTools');
  });

  it('fails loud when a ready integration requires a stable signer but none is configured', async () => {
    const factory = new MastraFactory({
      integrations: [fakeIntegration({ id: 'custom', requiresStableStateSigner: true })],
    });
    await expect(factory.prepare()).rejects.toThrow(/replica-stable state secret/);
  });

  it('accepts a stability-requiring integration when stateSecret is configured', async () => {
    await prepareFactory({
      stateSecret: 'deployment-stable-secret',
      integrations: [fakeIntegration({ id: 'custom', requiresStableStateSigner: true })],
    });
    expect(getSeededStateSigner()?.stable).toBe(true);
  });

  it("falls back to a github integration's webhook secret for the state signer", async () => {
    const github = fakeIntegration({ id: 'github' }) as FactoryIntegration & { webhookSecret?: string };
    github.webhookSecret = 'hook-secret';
    await prepareFactory({ integrations: [github] });
    expect(getSeededStateSigner()?.stable).toBe(true);
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
