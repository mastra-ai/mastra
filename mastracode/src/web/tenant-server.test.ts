import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Track which tenant storage each built app was bound to so we can assert
// isolation (distinct users -> distinct mounts).
const builtStorages: unknown[] = [];

vi.mock('../index.js', () => ({
  mountAgentControllerOnMastra: vi.fn(async (config: { storage?: unknown }) => {
    builtStorages.push(config.storage);
    return {
      mastra: { __storage: config.storage },
      controller: {
        getMastra: () => ({ stopWorkers: vi.fn(async () => {}) }),
        stopIntervals: vi.fn(async () => {}),
      },
    };
  }),
}));

// A fake MastraServer adapter: registers a single /api/echo route on the passed
// Hono app that returns the tenant's storage marker, proving the request was
// routed to the right per-tenant app.
vi.mock('@mastra/hono', () => ({
  MastraServer: class {
    private app: Hono;
    private mastra: { __storage?: { tenant?: string } };
    constructor(opts: { app: Hono; mastra: { __storage?: { tenant?: string } } }) {
      this.app = opts.app;
      this.mastra = opts.mastra;
    }
    async init() {
      this.app.get('/api/echo', c => c.json({ tenant: this.mastra.__storage?.tenant ?? null }));
    }
  },
}));

const mockWebAuthTenant = vi.fn();
vi.mock('./auth.js', () => ({
  webAuthTenant: (c: unknown) => mockWebAuthTenant(c),
}));

interface TenantIdentity {
  orgId?: string;
  userId: string;
}

const mockGetUserStorage = vi.fn();
vi.mock('./tenant-storage.js', () => ({
  getUserStorage: (identity: TenantIdentity) => mockGetUserStorage(identity),
}));

import { TenantDispatcher } from './tenant-server.js';

function tenantStorageFor(identity: TenantIdentity) {
  const key = identity.orgId ? `${identity.orgId}:${identity.userId}` : identity.userId;
  return { tenantKey: `key_${key}`, storageConfig: { tenant: key } };
}

beforeEach(() => {
  vi.clearAllMocks();
  builtStorages.length = 0;
  mockGetUserStorage.mockImplementation((identity: TenantIdentity) => tenantStorageFor(identity));
});

afterEach(() => {
  vi.clearAllMocks();
});

function buildApp(dispatcher: TenantDispatcher) {
  const app = new Hono();
  app.use('/api/*', dispatcher.middleware());
  // Shared fallback route (the "auth disabled" / shared adapter path).
  app.get('/api/echo', c => c.json({ tenant: 'SHARED' }));
  // A custom web route that must NOT be forwarded to tenant apps.
  app.get('/api/web/status', c => c.json({ route: 'web' }));
  return app;
}

describe('TenantDispatcher', () => {
  it('forwards authenticated requests to the user-specific tenant app', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });
    const res = await app.request('/api/echo');
    expect(await res.json()).toEqual({ tenant: 'user_a' });
  });

  it('routes two different users to two isolated tenant apps', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });
    const resA = await app.request('/api/echo');
    mockWebAuthTenant.mockReturnValue({ userId: 'user_b' });
    const resB = await app.request('/api/echo');

    expect(await resA.json()).toEqual({ tenant: 'user_a' });
    expect(await resB.json()).toEqual({ tenant: 'user_b' });
    // Two distinct tenant stacks were built with distinct storage configs.
    expect(builtStorages).toEqual([{ tenant: 'user_a' }, { tenant: 'user_b' }]);
  });

  it('routes two users in the same org to two isolated tenant apps', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    const resA = await app.request('/api/echo');
    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_b' });
    const resB = await app.request('/api/echo');

    expect(await resA.json()).toEqual({ tenant: 'org_a:user_a' });
    expect(await resB.json()).toEqual({ tenant: 'org_a:user_b' });
    expect(builtStorages).toEqual([{ tenant: 'org_a:user_a' }, { tenant: 'org_a:user_b' }]);
  });

  it('routes the same user in two orgs to two isolated tenant apps', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    const resA = await app.request('/api/echo');
    mockWebAuthTenant.mockReturnValue({ orgId: 'org_b', userId: 'user_a' });
    const resB = await app.request('/api/echo');

    expect(await resA.json()).toEqual({ tenant: 'org_a:user_a' });
    expect(await resB.json()).toEqual({ tenant: 'org_b:user_a' });
    expect(builtStorages).toEqual([{ tenant: 'org_a:user_a' }, { tenant: 'org_b:user_a' }]);
  });

  it('reuses the cached tenant app for repeated requests by the same identity', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    await app.request('/api/echo');
    await app.request('/api/echo');
    expect(builtStorages).toHaveLength(1);
  });

  it('falls through to the shared app when there is no authenticated user', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue(undefined);
    const res = await app.request('/api/echo');
    expect(await res.json()).toEqual({ tenant: 'SHARED' });
    expect(builtStorages).toHaveLength(0);
  });

  it('does not forward /api/web/* custom routes to tenant apps', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });
    const res = await app.request('/api/web/status');
    expect(await res.json()).toEqual({ route: 'web' });
    expect(builtStorages).toHaveLength(0);
  });

  it('stops all tenant stacks on shutdown', async () => {
    const dispatcher = new TenantDispatcher({ baseConfig: {}, controllerId: 'code' });
    const app = buildApp(dispatcher);
    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });
    await app.request('/api/echo');
    await expect(dispatcher.stopAll()).resolves.toBeUndefined();
  });
});
