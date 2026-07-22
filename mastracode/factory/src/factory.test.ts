import type * as authStudioModule from '@mastra/auth-studio';
import { RequestContext } from '@mastra/core/request-context';
import type { AuthInitContext, IMastraAuthProvider } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import { LocalSandbox } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgVector } from '@mastra/pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionControl } from './capabilities/version-control.js';
import { MastraFactory } from './factory.js';
import type { FactoryIntegration, IntegrationContext } from './integrations/base.js';
import type * as surfaceModule from './routes/surface.js';
import type * as tenantCredentialsModule from './routes/tenant-credentials.js';
import { defaultFactoryRules, DEFAULT_FACTORY_RULE_VERSION } from './rules/defaults.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';
import { getFactoryWorkspace } from './workspace.js';
/** A real in-memory FactoryStorage with init spied for boot-order assertions. */
function fakeStorage(): LibSQLFactoryStorage {
  const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'factory-test-storage' });
  const init = storage.init.bind(storage);
  vi.spyOn(storage, 'init').mockImplementation(() => init());
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

// The default-auth path constructs `MastraAuthStudio` internally (no service
// locator to peek at), so capture every instance the factory creates and let
// tests observe the resolved default provider directly.
const studioInstances = vi.hoisted(() => [] as unknown[]);
vi.mock('@mastra/auth-studio', async importOriginal => {
  const mod = (await importOriginal()) as typeof authStudioModule;
  class TrackedMastraAuthStudio extends mod.MastraAuthStudio {
    constructor(...args: ConstructorParameters<typeof mod.MastraAuthStudio>) {
      super(...args);
      studioInstances.push(this);
    }
  }
  return { ...mod, MastraAuthStudio: TrackedMastraAuthStudio };
});

/** The default `MastraAuthStudio` provider minted by the last `prepare()`. */
function lastStudioProvider():
  | (IMastraAuthProvider & {
      getSessionHeaders?: (s: { id: string; userId: string }) => Record<string, string>;
    })
  | undefined {
  return studioInstances.at(-1) as ReturnType<typeof lastStudioProvider>;
}

// Keep the real tenant-credentials module but spy on the registration so tests
// can assert whether the factory registers the per-tenant resolver. Registering
// in local/auth-disabled mode would force model calls through an empty tenant
// store and break chat with "Not logged in", so the factory must gate it.
const registerTenantCredentialResolverMock = vi.fn();
vi.mock('./routes/tenant-credentials', async importOriginal => {
  const actual = await importOriginal<typeof tenantCredentialsModule>();
  return { ...actual, registerTenantCredentialResolver: () => registerTenantCredentialResolverMock() };
});

// Wrap the route-surface assembly with a spy so tests can assert the DI deps
// the factory threads into it (e.g. the resolved Factory rules) — there is no
// service locator to read them back from anymore.
const assembleFactoryApiRoutesSpy = vi.fn();
vi.mock('./routes/surface', async importOriginal => {
  const actual = await importOriginal<typeof surfaceModule>();
  return {
    ...actual,
    assembleFactoryApiRoutes: (deps: Parameters<typeof actual.assembleFactoryApiRoutes>[0]) => {
      assembleFactoryApiRoutesSpy(deps);
      return actual.assembleFactoryApiRoutes(deps);
    },
  };
});

/** An SSO-shaped fake provider: gets the hosted-login `/auth/*` routes. */
function fakeProvider(
  overrides: Record<string, unknown> = {},
): IMastraAuthProvider & { init: ReturnType<typeof vi.fn> } {
  return {
    name: 'fake',
    init: vi.fn(async () => {}),
    authenticateToken: vi.fn(async () => null),
    authorizeUser: vi.fn(async () => true),
    getLoginUrl: vi.fn(async () => 'https://sso.example.com/login'),
    handleCallback: vi.fn(async () => ({ user: {}, tokens: { accessToken: 't' } })),
    getClearSessionHeaders: () => ({ 'Set-Cookie': 'fake_session=; Max-Age=0' }),
    ...overrides,
  } as unknown as IMastraAuthProvider & { init: ReturnType<typeof vi.fn> };
}

async function prepareFactory(config: ConstructorParameters<typeof MastraFactory>[0]) {
  const factory = new MastraFactory(config);
  await factory.prepare();
  expect(prepareMock).toHaveBeenCalledOnce();
  return prepareMock.mock.calls[0]![0];
}

/**
 * Prepare the factory with a probe integration and return the
 * {@link IntegrationContext} the factory hands to `routes()` — the fleet has
 * no global getter anymore, so tests observe it through the context.
 */
async function prepareIntegrationContext(config: ConstructorParameters<typeof MastraFactory>[0]) {
  const routes = vi.fn((_ctx: IntegrationContext) => []);
  const prepared = await prepareFactory({
    ...config,
    integrations: [...(config.integrations ?? []), fakeIntegration({ id: 'context-probe', routes })],
  });
  const buildApiRoutes = prepared.buildApiRoutes as (deps: object) => unknown;
  buildApiRoutes({ controller: {}, authStorage: {} });
  expect(routes).toHaveBeenCalledOnce();
  return routes.mock.calls[0]![0];
}

beforeEach(() => {
  vi.clearAllMocks();
  studioInstances.length = 0;
});

describe('MastraFactory constructor', () => {
  it('requires a storage backend', () => {
    expect(() => new MastraFactory({} as never)).toThrow(/'storage' is required/);
  });
});

describe('MastraFactory.prepare', () => {
  it('throws when called twice', async () => {
    const factory = new MastraFactory({ storage: fakeStorage() });
    await factory.prepare();
    await expect(factory.prepare()).rejects.toThrow(/called twice/);
  });

  it('rejects overlapping concurrent calls (guard set before the first await)', async () => {
    const auth = fakeProvider();
    const factory = new MastraFactory({ storage: fakeStorage(), auth });
    const [first, second] = await Promise.allSettled([factory.prepare(), factory.prepare()]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    expect((second as PromiseRejectedResult).reason.message).toMatch(/called twice/);
    // The overlapping call must not double-run one-time adapter init.
    expect(auth.init).toHaveBeenCalledOnce();
    expect(prepareMock).toHaveBeenCalledOnce();
  });

  it('constructs an enabled sandbox fleet from the configured machine', async () => {
    const sandbox = new LocalSandbox({ workingDirectory: '/tmp/mc-factory-test' });
    const ctx = await prepareIntegrationContext({ storage: fakeStorage(), sandbox: { machine: sandbox } });
    expect(ctx.fleet.enabled).toBe(true);
    expect(ctx.fleet.provider).toBe('local');
  });

  it('threads conservative versioned Factory rules when the slot is omitted', async () => {
    const prepared = await prepareFactory({ storage: fakeStorage() });
    (prepared.buildApiRoutes as (deps: object) => unknown)({ controller: {}, authStorage: {} });
    expect(assembleFactoryApiRoutesSpy).toHaveBeenCalledOnce();
    const rules = assembleFactoryApiRoutesSpy.mock.calls[0]![0].rules;
    expect(rules?.version).toBe(DEFAULT_FACTORY_RULE_VERSION);
    expect(rules?.work.triage?.issue?.onEnter).toBeTypeOf('function');
    expect(rules?.review.review?.pullRequest?.onEnter).toBeTypeOf('function');
    expect(rules?.tools.submit_plan?.onResult).toBeTypeOf('function');
    expect(rules?.github.issueOpened?.onEvent).toBeTypeOf('function');
    expect(rules?.github.pullRequestOpened?.onEvent).toBeTypeOf('function');
    expect(rules?.github.pullRequestMerged?.onEvent).toBeTypeOf('function');
  });

  it('threads explicitly configured Factory rules without composing handler leaves', async () => {
    const onResult = vi.fn(() => undefined);
    const rules = defaultFactoryRules({
      version: 'customer-policy-3',
      overrides: { tools: { submit_plan: { onResult } } },
    });
    const prepared = await prepareFactory({ storage: fakeStorage(), rules });
    (prepared.buildApiRoutes as (deps: object) => unknown)({ controller: {}, authStorage: {} });
    expect(assembleFactoryApiRoutesSpy).toHaveBeenCalledOnce();
    const threaded = assembleFactoryApiRoutesSpy.mock.calls[0]![0].rules;
    expect(threaded).toBe(rules);
    expect(threaded.tools.submit_plan?.onResult).toBe(onResult);
  });

  it('registers and initializes factory domains through the storage lifecycle', async () => {
    const storage = fakeStorage();
    await prepareFactory({ storage });
    expect(storage.init).toHaveBeenCalledOnce();
    expect(storage.domainNames()).toEqual([
      'intake',
      'audit',
      'work-items',
      'model-credentials',
      'model-packs',
      'memory-settings',
      'custom-providers',
      'queue-health',
      'integrations',
      'projects',
      'source-control',
    ]);
    expect(storage.domainNames().every(name => storage.isDomainReady(name))).toBe(true);
  });

  it('disables the sandbox fleet when the slot is omitted', async () => {
    const ctx = await prepareIntegrationContext({ storage: fakeStorage() });
    expect(ctx.fleet.enabled).toBe(false);
    expect(ctx.fleet.provider).toBe('none');
  });

  it('rejects a sandbox that does not implement clone()', async () => {
    const uncloneable = {
      id: 'sb-1',
      name: 'Uncloneable',
      provider: 'custom',
    } as unknown as WorkspaceSandbox;
    const factory = new MastraFactory({ storage: fakeStorage(), sandbox: { machine: uncloneable } });
    await expect(factory.prepare()).rejects.toThrow(/does not implement clone\(\)/);
  });

  it("defaults the workdir base to the machine's workingDirectory, else /workspace", async () => {
    const local = await prepareIntegrationContext({
      storage: fakeStorage(),
      sandbox: { machine: new LocalSandbox({ workingDirectory: '/srv/checkouts/' }) },
    });
    expect(local.fleet.computeWorkdir('acme/api')).toBe('/srv/checkouts/acme/api');

    prepareMock.mockClear();

    const remote = {
      id: 'sb-2',
      name: 'Remote',
      provider: 'railway',
      clone: () => remote,
    } as unknown as WorkspaceSandbox;
    const ctx = await prepareIntegrationContext({ storage: fakeStorage(), sandbox: { machine: remote } });
    expect(ctx.fleet.computeWorkdir('acme/api')).toBe('/workspace/acme/api');
  });

  it("keeps LocalSandbox checkouts under its host root even when workdir is '/workspace'", async () => {
    const ctx = await prepareIntegrationContext({
      storage: fakeStorage(),
      sandbox: {
        machine: new LocalSandbox({ workingDirectory: '/tmp/mc-factory-test' }),
        workdir: '/workspace',
        maxSandboxes: 5,
      },
    });
    expect(ctx.fleet.computeWorkdir('acme/api')).toBe('/tmp/mc-factory-test/acme/api');
    expect(ctx.fleet.maxSandboxes).toBe(5);
  });

  it('honors an explicit workdir override for remote sandboxes', async () => {
    const remote = {
      id: 'sb-3',
      name: 'Remote',
      provider: 'railway',
      clone: () => remote,
    } as unknown as WorkspaceSandbox;
    const ctx = await prepareIntegrationContext({
      storage: fakeStorage(),
      sandbox: { machine: remote, workdir: '/custom/base/' },
    });
    expect(ctx.fleet.computeWorkdir('acme/api')).toBe('/custom/base/acme/api');
  });

  it("forwards the backend's Mastra store and the vector instance to the SDK mount", async () => {
    const storage = fakeStorage();
    const vector = new PgVector({ id: 'factory-test-vectors', connectionString: 'postgres://cfg/app' });
    const config = await prepareFactory({ storage, vector });
    expect(config.storage).toBe(storage.getMastraStorage());
    expect(config.vector).toBe(vector);
  });

  it('installs a Web Factory session workspace resolver instead of changing the SDK default', async () => {
    const config = await prepareFactory({ storage: fakeStorage() });
    expect(config.workspace).toEqual(expect.any(Function));
    expect(config.workspace).not.toBe(getFactoryWorkspace);
  });

  it('omits vector when no instance is configured', async () => {
    const config = await prepareFactory({ storage: fakeStorage() });
    expect(config).not.toHaveProperty('vector');
  });

  it('passes the pubsub instance through with cross-process leases enabled', async () => {
    const pubsub = { publish: vi.fn(), subscribe: vi.fn() } as never;
    const config = await prepareFactory({ storage: fakeStorage(), pubsub });
    expect(config.pubsub).toBe(pubsub);
    expect(config.crossProcessPubSub).toBe(true);
  });

  it('calls provider.init once with the factory context', async () => {
    const auth = fakeProvider();
    const storage = fakeStorage();
    await prepareFactory({
      auth,
      storage,
      publicUrl: 'https://factory.acme.com/',
      allowedOrigins: ['https://app.acme.com/'],
    });
    expect(auth.init).toHaveBeenCalledExactlyOnceWith({
      database: storage.authDatabase(),
      publicUrl: 'https://factory.acme.com',
      allowedOrigins: ['https://app.acme.com'],
    } satisfies AuthInitContext);
  });

  it('surfaces provider init failures at prepare()', async () => {
    const auth = fakeProvider({ init: vi.fn(async () => Promise.reject(new Error('provider misconfigured'))) });
    const factory = new MastraFactory({ storage: fakeStorage(), auth });
    await expect(factory.prepare()).rejects.toThrow('provider misconfigured');
  });

  it('folds the provider /auth/* routes into buildApiRoutes when auth is configured', async () => {
    const config = await prepareFactory({ storage: fakeStorage(), auth: fakeProvider() });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/auth/login');
    expect(paths).toContain('/auth/callback');
    expect(paths).toContain('/auth/logout');
    expect(paths).toContain('/auth/me');
  });

  it('registers the Factory transition tool only for exact active bindings', async () => {
    const storage = fakeStorage();
    const config = await prepareFactory({ storage });
    const workItems = storage.getDomain<WorkItemsStorage>('work-items');
    const binding = {
      id: 'binding-1',
      orgId: 'org-1',
      factoryProjectId: '11111111-2222-4333-8444-555555555555',
      workItemId: 'item-1',
      role: 'work',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
      branch: 'factory/item',
      status: 'active' as const,
      createdAt: new Date(),
      revokedAt: null,
    };
    const lookup = vi.spyOn(workItems, 'findActiveRunBinding').mockResolvedValue(binding);
    const extraTools = config.extraTools as (args: {
      requestContext: RequestContext;
    }) => Promise<Record<string, unknown>>;
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    requestContext.set('controller', {
      resourceId: 'resource-1',
      threadId: 'thread-1',
      scope: '/worktree',
      getState: () => ({ factoryProjectId: binding.factoryProjectId }),
    });

    await expect(extraTools({ requestContext })).resolves.toHaveProperty('factory_transition_work_item');
    lookup.mockResolvedValue(null);
    await expect(extraTools({ requestContext })).resolves.toEqual({});
  });

  it('omits auth routes when auth is explicitly disabled (auth: null)', async () => {
    const config = await prepareFactory({ storage: fakeStorage(), auth: null });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths.some(p => p.startsWith('/auth/'))).toBe(false);
  });

  it('installs the auth gate and tenant credential primer when auth is configured', async () => {
    // Both modes mount the custom-providers primer and the SPA static
    // middleware is environment-dependent (present when ui/dist exists), so
    // assert the delta from the two auth-specific middleware.
    const openConfig = await prepareFactory({ storage: fakeStorage(), auth: null });
    const openMiddleware = (openConfig.buildServerConfig as () => { middleware?: unknown[] })().middleware ?? [];

    prepareMock.mockClear();

    const gatedConfig = await prepareFactory({ storage: fakeStorage(), auth: fakeProvider() });
    const gatedMiddleware = (gatedConfig.buildServerConfig as () => { middleware?: unknown[] })().middleware ?? [];
    expect(gatedMiddleware).toHaveLength(openMiddleware.length + 2);
  });

  it('registers the per-tenant credential resolver when auth is configured', async () => {
    registerTenantCredentialResolverMock.mockClear();
    await prepareFactory({ storage: fakeStorage(), auth: fakeProvider() });
    expect(registerTenantCredentialResolverMock).toHaveBeenCalledTimes(1);
  });

  it('skips the per-tenant credential resolver when auth is disabled (auth: null)', async () => {
    // With no auth adapter there is no authenticated tenant. Registering the
    // resolver would route every model call through an empty tenant store
    // (fail-closed, no env fallback) and break local chat with "Not logged in".
    // Leaving it unregistered lets the SDK fall back to the file-backed
    // AuthStorage (auth.json) — the store the local /login + Settings use.
    registerTenantCredentialResolverMock.mockClear();
    await prepareFactory({ storage: fakeStorage(), auth: null });
    expect(registerTenantCredentialResolverMock).not.toHaveBeenCalled();
  });

  it('defaults to MastraAuthStudio when no auth is configured', async () => {
    // No `auth` slot in config → factory falls back to `MastraAuthStudio` and
    // the public `/auth/*` routes are folded into the API surface.
    const config = await prepareFactory({ storage: fakeStorage() });
    const provider = lastStudioProvider();
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('mastra-studio');
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/auth/login');
    expect(paths).toContain('/auth/callback');
    expect(paths).toContain('/auth/logout');
    expect(paths).toContain('/auth/me');
  });

  // Both `MASTRA_COOKIE_DOMAIN` and `MASTRA_SHARED_API_URL` feed Studio's
  // cookie-domain precedence (explicit > shared-API hostname > publicUrl
  // fallback), so a runner with either set would silently flip the derived
  // domain. Clear both around each derivation test and restore after.
  async function withCleanCookieEnv<T>(fn: () => Promise<T>): Promise<T> {
    const prevCookie = process.env.MASTRA_COOKIE_DOMAIN;
    const prevShared = process.env.MASTRA_SHARED_API_URL;
    delete process.env.MASTRA_COOKIE_DOMAIN;
    delete process.env.MASTRA_SHARED_API_URL;
    try {
      return await fn();
    } finally {
      if (prevCookie === undefined) delete process.env.MASTRA_COOKIE_DOMAIN;
      else process.env.MASTRA_COOKIE_DOMAIN = prevCookie;
      if (prevShared === undefined) delete process.env.MASTRA_SHARED_API_URL;
      else process.env.MASTRA_SHARED_API_URL = prevShared;
    }
  }

  function seededSetCookie(): string | undefined {
    return lastStudioProvider()?.getSessionHeaders?.({ id: 'test-token', userId: 'u_1' })?.['Set-Cookie'];
  }

  it('derives the default Studio cookie domain from publicUrl for subdomain deploys', async () => {
    // A `<sub>.mastra.cloud` deploy should mint cookies with
    // `Domain=.mastra.cloud` so the browser sends them back to sibling
    // subdomains — no `MASTRA_COOKIE_DOMAIN` env wiring required.
    await withCleanCookieEnv(async () => {
      await prepareFactory({ storage: fakeStorage(), publicUrl: 'https://studio-abc.mastra.cloud' });
      const setCookie = seededSetCookie();
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('Domain=.mastra.cloud');
    });
  });

  it('leaves the default Studio cookie host-only on localhost', async () => {
    // `publicUrl` on localhost has no parent to peel — the cookie must stay
    // host-only or the browser will silently reject it.
    await withCleanCookieEnv(async () => {
      await prepareFactory({ storage: fakeStorage(), publicUrl: 'http://localhost:4111' });
      const setCookie = seededSetCookie();
      expect(setCookie).toBeDefined();
      expect(setCookie).not.toContain('Domain=');
    });
  });

  it('leaves the default Studio cookie host-only for hosts outside the platform allowlist', async () => {
    // Public-suffix trap: a naive last-two-labels heuristic would emit
    // `Domain=.co.uk` for `foo.example.co.uk`, which every major browser
    // rejects. Custom-domain deploys must fall through to host-only cookies.
    await withCleanCookieEnv(async () => {
      await prepareFactory({ storage: fakeStorage(), publicUrl: 'https://studio.example.co.uk' });
      const setCookie = seededSetCookie();
      expect(setCookie).toBeDefined();
      expect(setCookie).not.toContain('Domain=');
    });
  });

  it('leaves the default Studio cookie host-only for numeric-labelled hostnames', async () => {
    // A leading-digit label (e.g. `3scale.example.com`) is still a valid DNS
    // host, not an IP. The derivation must not misclassify it as IPv4.
    await withCleanCookieEnv(async () => {
      await prepareFactory({ storage: fakeStorage(), publicUrl: 'https://3scale.example.com' });
      const setCookie = seededSetCookie();
      expect(setCookie).toBeDefined();
      // Not on the platform allowlist → host-only.
      expect(setCookie).not.toContain('Domain=');
    });
  });

  it('leaves the default Studio cookie host-only for literal IPv4 hosts', async () => {
    // IP-literal deploys can't share cookies across an arbitrary parent, and
    // browsers reject Domain= attributes on IP hosts entirely.
    await withCleanCookieEnv(async () => {
      await prepareFactory({ storage: fakeStorage(), publicUrl: 'http://10.0.0.1:4111' });
      const setCookie = seededSetCookie();
      expect(setCookie).toBeDefined();
      expect(setCookie).not.toContain('Domain=');
    });
  });

  it('boots with auth off when auth is explicitly disabled (auth: null)', async () => {
    // `auth: null` opts out of the default entirely — no default Studio
    // provider constructed, no `/auth/*` routes, no gate middleware.
    await prepareFactory({ storage: fakeStorage(), auth: null });
    expect(lastStudioProvider()).toBeUndefined();
  });
});

function fakeIntegration(overrides: Partial<FactoryIntegration> & { id: string }): FactoryIntegration {
  return {
    routes: vi.fn((_ctx: IntegrationContext) => []),
    diagnostics: () => ({}),
    ...overrides,
  };
}

function fakeAuditIntegration(overrides: Partial<FactoryIntegration> & { id: string }): FactoryIntegration {
  return fakeIntegration({ audit: vi.fn(async () => {}), ...overrides });
}

describe('MastraFactory.prepare audit-capable integrations', () => {
  it('rejects duplicate audit-capable integration ids', async () => {
    const factory = new MastraFactory({
      storage: fakeStorage(),
      integrations: [fakeAuditIntegration({ id: 'mirror' }), fakeAuditIntegration({ id: 'mirror' })],
    });
    await expect(factory.prepare()).rejects.toThrow(/duplicate integration id 'mirror'/);
  });

  it('mounts audit domain routes without an audit integration', async () => {
    const config = await prepareFactory({ storage: fakeStorage() });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/web/factory/projects/:id/audit');
    expect(paths).not.toContain('/web/audit/portal-link');
  });

  it("folds an audit integration's routes into buildApiRoutes", async () => {
    const config = await prepareFactory({
      storage: fakeStorage(),
      integrations: [
        fakeAuditIntegration({
          id: 'mirror',
          routes: () => [{ path: '/web/audit/portal-link', method: 'GET', handler: () => new Response() }],
        }),
      ],
    });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/web/factory/projects/:id/audit');
    expect(paths).toContain('/web/audit/portal-link');
  });

  it.each([
    { authKind: 'workos', auditConfigured: true, expectsPortal: true },
    { authKind: 'better-auth', auditConfigured: true, expectsPortal: true },
    { authKind: 'workos', auditConfigured: false, expectsPortal: false },
  ])(
    'keeps audit integration routes independent from $authKind auth when auditConfigured=$auditConfigured',
    async ({ authKind, auditConfigured, expectsPortal }) => {
      const config = await prepareFactory({
        storage: fakeStorage(),
        auth: fakeProvider({ name: authKind }),
        integrations: auditConfigured
          ? [
              fakeAuditIntegration({
                id: 'workos-audit',
                routes: () => [{ path: '/web/audit/portal-link', method: 'GET', handler: () => new Response() }],
              }),
            ]
          : [],
      });
      const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
      const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
      expect(paths.includes('/web/audit/portal-link')).toBe(expectsPortal);
    },
  );
});

describe('MastraFactory.prepare integrations', () => {
  it('rejects duplicate integration ids', async () => {
    const factory = new MastraFactory({
      storage: fakeStorage(),
      integrations: [fakeIntegration({ id: 'custom' }), fakeIntegration({ id: 'custom' })],
    });
    await expect(factory.prepare()).rejects.toThrow(/duplicate integration id 'custom'/);
  });

  it('initializes version-control capabilities with integration-scoped storage', async () => {
    const initialize = vi.fn();
    const custom = fakeIntegration({
      id: 'custom-version-control',
      versionControl: {
        initialize,
        registerInstallation: vi.fn(),
        registerRepositories: vi.fn(),
        getRepositoryAccess: vi.fn(),
      } as unknown as VersionControl,
    });

    await prepareFactory({ storage: fakeStorage(), integrations: [custom] });

    expect(initialize).toHaveBeenCalledOnce();
    expect(initialize.mock.calls[0]![0].storage.integrationId).toBe('custom-version-control');
  });

  it("folds a ready integration's routes into buildApiRoutes", async () => {
    const routes = vi.fn((_ctx: IntegrationContext) => [
      { path: '/web/custom/status', method: 'GET' as const, handler: () => new Response() },
    ]);
    const config = await prepareFactory({
      storage: fakeStorage(),
      integrations: [fakeIntegration({ id: 'custom', routes })],
    });
    const buildApiRoutes = config.buildApiRoutes as (deps: object) => Array<{ path: string }>;
    const paths = buildApiRoutes({ controller: {}, authStorage: {} }).map(r => r.path);
    expect(paths).toContain('/web/custom/status');
    const ctx = routes.mock.calls[0]![0];
    expect(ctx.stateSigner).toBeDefined();
    expect(ctx.stateSigner?.stable).toBe(false);
    expect(typeof ctx.hooks?.emitAudit).toBe('function');
  });

  it('mounts disabled status stubs when no integrations are registered', async () => {
    const config = await prepareFactory({ storage: fakeStorage() });
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
    const config = await prepareFactory({ storage: fakeStorage(), integrations: [custom] });
    const extraTools = config.extraTools as (args: { requestContext: object }) => Promise<Record<string, unknown>>;
    const tools = await extraTools({ requestContext: {} });
    expect(tools.customAgentTool).toBe(agentTool);
    expect(tools.customSessionTool).toBe(sessionTool);
  });

  it('rejects duplicate tool keys from integrations', async () => {
    const first = fakeIntegration({
      id: 'first',
      agentTools: vi.fn(async () => ({ sharedTool: { description: 'first' } }) as never),
    });
    const second = fakeIntegration({
      id: 'second',
      sessionTools: vi.fn(() => ({ sharedTool: { description: 'second' } }) as never),
    });
    const config = await prepareFactory({ storage: fakeStorage(), integrations: [first, second] });
    const extraTools = config.extraTools as (args: { requestContext: object }) => Promise<Record<string, unknown>>;
    await expect(extraTools({ requestContext: {} })).rejects.toThrow(
      "integration tool 'sharedTool' from 'second' conflicts with 'first'",
    );
  });

  it('keeps the bound Factory tool resolver when no integration contributes tools', async () => {
    const config = await prepareFactory({ storage: fakeStorage(), integrations: [fakeIntegration({ id: 'custom' })] });
    const extraTools = config.extraTools as (args: {
      requestContext: RequestContext;
    }) => Promise<Record<string, unknown>>;
    await expect(extraTools({ requestContext: new RequestContext() })).resolves.toEqual({});
  });

  it('fails loud when a ready integration requires a stable signer but none is configured', async () => {
    const factory = new MastraFactory({
      storage: fakeStorage(),
      integrations: [fakeIntegration({ id: 'custom', requiresStableStateSigner: true })],
    });
    await expect(factory.prepare()).rejects.toThrow(/replica-stable state secret/);
  });

  it('accepts a stability-requiring integration when stateSecret is configured', async () => {
    const ctx = await prepareIntegrationContext({
      storage: fakeStorage(),
      stateSecret: 'deployment-stable-secret',
      integrations: [fakeIntegration({ id: 'custom', requiresStableStateSigner: true })],
    });
    expect(ctx.stateSigner?.stable).toBe(true);
  });

  it('does not inspect provider-specific integration secrets for state signing', async () => {
    const integration = fakeIntegration({ id: 'custom' }) as FactoryIntegration & { webhookSecret?: string };
    integration.webhookSecret = 'provider-owned-secret';
    const ctx = await prepareIntegrationContext({ storage: fakeStorage(), integrations: [integration] });
    expect(ctx.stateSigner?.stable).toBe(false);
  });

  it("folds a ready integration's workers into the returned Mastra args", async () => {
    const worker = { name: 'custom-poller' } as unknown as MastraWorker;
    const workers = vi.fn((_ctx: IntegrationContext) => [worker]);
    const factory = new MastraFactory({
      storage: fakeStorage(),
      integrations: [fakeIntegration({ id: 'custom', workers })],
    });
    const args = await factory.prepare();
    expect(args.workers).toEqual([worker]);
    // The workers factory gets the same integration context shape as routes().
    const ctx = workers.mock.calls[0]![0];
    expect(ctx.stateSigner).toBeDefined();
    expect(ctx.storage.generic).toBeDefined();
    expect(ctx.storage.sourceControl).toBeDefined();
  });

  it('does not collect workers from integrations that are not ready', async () => {
    const storage = fakeStorage();
    vi.spyOn(storage, 'isDomainReady').mockReturnValue(false);
    const workers = vi.fn(() => [{ name: 'custom-poller' } as unknown as MastraWorker]);
    const factory = new MastraFactory({
      storage,
      integrations: [fakeIntegration({ id: 'custom', workers })],
    });
    const args = await factory.prepare();
    expect(workers).not.toHaveBeenCalled();
    expect(args).not.toHaveProperty('workers');
  });

  it('omits the workers option when no integration contributes workers', async () => {
    const factory = new MastraFactory({ storage: fakeStorage(), integrations: [fakeIntegration({ id: 'custom' })] });
    const args = await factory.prepare();
    expect(args).not.toHaveProperty('workers');
  });
});

describe('MastraFactory.finalize', () => {
  it('throws before prepare()', async () => {
    const factory = new MastraFactory({ storage: fakeStorage() });
    await expect(factory.finalize()).rejects.toThrow(/before prepare/);
  });

  it('runs the prepared finalize after prepare()', async () => {
    const factory = new MastraFactory({ storage: fakeStorage() });
    await factory.prepare();
    await factory.finalize();
    const prepared = await prepareMock.mock.results[0]!.value;
    expect(prepared.finalize).toHaveBeenCalledOnce();
  });
});
