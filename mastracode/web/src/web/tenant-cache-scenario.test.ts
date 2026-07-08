import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Phase 6 tenant-cache eviction scenario ───────────────────────────────
// The TenantDispatcher caches a full Mastra stack per tenant. Left unbounded
// it leaks memory as a team grows. These scenarios drive the idle-TTL sweep
// and the LRU max-size cap end to end using an injected fake builder + clock,
// so no real Mastra stack boots.

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
import type { TenantAppBuilder } from './tenant-server.js';

function tenantKeyOf(identity: TenantIdentity): string {
  return identity.orgId ? `${identity.orgId}:${identity.userId}` : identity.userId;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserStorage.mockImplementation((identity: TenantIdentity) => {
    const key = tenantKeyOf(identity);
    return { tenantKey: `key_${key}`, storageConfig: { tenant: key } };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * A fake tenant-app builder that records the storage configs it was asked to
 * build and the stop calls it received, with a per-app echo route proving the
 * request was routed to the matching stack.
 */
function makeFakeBuilder() {
  const builtTenants: string[] = [];
  const stopped: string[] = [];
  const builder: TenantAppBuilder = async storage => {
    const tenant = (storage as unknown as { tenant: string }).tenant;
    builtTenants.push(tenant);
    const app = new Hono();
    app.get('/api/echo', c => c.json({ tenant }));
    return {
      fetch: (request, ...rest) => app.fetch(request as Request, ...(rest as [])),
      stop: async () => {
        stopped.push(tenant);
      },
    };
  };
  return { builder, builtTenants, stopped };
}

function buildOuterApp(dispatcher: TenantDispatcher) {
  const app = new Hono();
  app.use('/api/*', dispatcher.middleware());
  return app;
}

describe('idle eviction round-trip', () => {
  it('evicts an idle tenant (stops it) then rebuilds it on the next request', async () => {
    const { builder, builtTenants, stopped } = makeFakeBuilder();
    let clock = 1_000;
    const dispatcher = new TenantDispatcher({
      baseConfig: {},
      controllerId: 'code',
      buildTenantApp: builder,
      idleMs: 10 * 60_000, // 10 minutes
      maxApps: 0, // disable LRU cap; isolate idle behavior
      now: () => clock,
    });
    const app = buildOuterApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    const first = await app.request('/api/echo');
    expect(await first.json()).toEqual({ tenant: 'org_a:user_a' });
    expect(dispatcher.size()).toBe(1);
    expect(builtTenants).toEqual(['org_a:user_a']);

    // Advance past the idle window, then a request from a DIFFERENT tenant
    // triggers the sweep that evicts the idle one.
    clock += 11 * 60_000;
    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_b' });
    await app.request('/api/echo');
    // Allow the fire-and-forget stop() to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(stopped).toContain('org_a:user_a');
    // user_a evicted, user_b cached.
    expect(dispatcher.size()).toBe(1);

    // user_a returns → rebuilt fresh.
    clock += 1_000;
    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    const back = await app.request('/api/echo');
    expect(await back.json()).toEqual({ tenant: 'org_a:user_a' });
    // Built twice in total for user_a (original + rebuild).
    expect(builtTenants.filter(t => t === 'org_a:user_a')).toHaveLength(2);
  });

  it('keeps a tenant alive while it is actively used', async () => {
    const { builder, builtTenants } = makeFakeBuilder();
    let clock = 0;
    const dispatcher = new TenantDispatcher({
      baseConfig: {},
      controllerId: 'code',
      buildTenantApp: builder,
      idleMs: 10 * 60_000,
      maxApps: 0,
      now: () => clock,
    });
    const app = buildOuterApp(dispatcher);
    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });

    await app.request('/api/echo');
    // Repeated use within the idle window refreshes lastUsed each time.
    for (let i = 0; i < 5; i++) {
      clock += 5 * 60_000;
      await app.request('/api/echo');
    }
    // Only one build despite 30 minutes elapsing, because each access refreshed.
    expect(builtTenants).toEqual(['user_a']);
    expect(dispatcher.size()).toBe(1);
  });
});

describe('max-size LRU eviction', () => {
  it('evicts the least-recently-used tenant when the cap is exceeded', async () => {
    const { builder, builtTenants, stopped } = makeFakeBuilder();
    let clock = 0;
    const dispatcher = new TenantDispatcher({
      baseConfig: {},
      controllerId: 'code',
      buildTenantApp: builder,
      idleMs: 0, // disable idle sweep; isolate LRU behavior
      maxApps: 2,
      now: () => clock,
    });
    const app = buildOuterApp(dispatcher);

    // Build user_a, then user_b.
    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });
    clock = 1;
    await app.request('/api/echo');
    mockWebAuthTenant.mockReturnValue({ userId: 'user_b' });
    clock = 2;
    await app.request('/api/echo');
    expect(dispatcher.size()).toBe(2);

    // Touch user_a so user_b becomes the LRU.
    mockWebAuthTenant.mockReturnValue({ userId: 'user_a' });
    clock = 3;
    await app.request('/api/echo');

    // Build user_c → exceeds cap → user_b (LRU) evicted.
    mockWebAuthTenant.mockReturnValue({ userId: 'user_c' });
    clock = 4;
    await app.request('/api/echo');
    await Promise.resolve();
    await Promise.resolve();

    expect(dispatcher.size()).toBe(2);
    expect(stopped).toEqual(['user_b']);
    expect(builtTenants).toEqual(['user_a', 'user_b', 'user_c']);
  });
});

describe('no cross-tenant bleed under eviction', () => {
  it('rebuilds an evicted tenant with its OWN storage config, never another tenant’s', async () => {
    const { builder } = makeFakeBuilder();
    const seenStorageForBuild: Array<{ identity: string; tenant: string }> = [];
    const wrapped: TenantAppBuilder = async (storage, ctx) => {
      seenStorageForBuild.push({
        identity: 'n/a',
        tenant: (storage as unknown as { tenant: string }).tenant,
      });
      return builder(storage, ctx);
    };
    let clock = 0;
    const dispatcher = new TenantDispatcher({
      baseConfig: {},
      controllerId: 'code',
      buildTenantApp: wrapped,
      idleMs: 1, // tiny idle window so eviction is easy to trigger
      maxApps: 0,
      now: () => clock,
    });
    const app = buildOuterApp(dispatcher);

    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    clock = 10;
    const a1 = await app.request('/api/echo');
    expect(await a1.json()).toEqual({ tenant: 'org_a:user_a' });

    // Advance to force eviction of user_a on the next (different) request.
    clock = 100;
    mockWebAuthTenant.mockReturnValue({ orgId: 'org_b', userId: 'user_a' });
    const b1 = await app.request('/api/echo');
    expect(await b1.json()).toEqual({ tenant: 'org_b:user_a' });

    // user_a (org_a) comes back → rebuilt against org_a's storage, not org_b's.
    clock = 200;
    mockWebAuthTenant.mockReturnValue({ orgId: 'org_a', userId: 'user_a' });
    const a2 = await app.request('/api/echo');
    expect(await a2.json()).toEqual({ tenant: 'org_a:user_a' });

    // Every build saw the storage config matching its own composite key.
    expect(seenStorageForBuild.map(s => s.tenant)).toEqual(['org_a:user_a', 'org_b:user_a', 'org_a:user_a']);
  });
});
