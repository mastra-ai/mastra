import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WebAuthAdapter } from './auth-adapter.js';
import { WorkOSWebAuth } from './auth-workos-adapter.js';
import {
  buildAuthRoutes,
  getWorkOSProvider,
  isWebAuthEnabled,
  isWorkOSAuth,
  mountWebAuth,
  webAuthTenant,
} from './auth.js';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from './runtime-config.js';

/**
 * Adapter-seam behavior: the auth module resolves the ACTIVE adapter from the
 * factory-seeded registry (seeded config authoritative, including "seeded with
 * no adapter" = auth explicitly disabled) and falls back to a WorkOS adapter
 * implied by the `WORKOS_*` env vars only when the factory never ran.
 * Provider-specific WorkOS behavior itself is covered by `auth.test.ts`.
 */

// Mock @mastra/auth-workos so WorkOSWebAuth never constructs a real client.
const mockAuthenticate = vi.fn();
const mockGetLoginUrl = vi.fn(() => 'https://workos.example/login');
const mockListOrganizationMemberships = vi.fn();
vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {
    getLoginUrl = mockGetLoginUrl;
    authenticateToken = mockAuthenticate;
    getWorkOS = () => ({
      userManagement: { listOrganizationMemberships: mockListOrganizationMemberships },
    });
  },
}));

const ORIGINAL_ENV = { ...process.env };

/** Minimal custom adapter standing in for a non-WorkOS provider. */
function fakeAdapter(overrides: Partial<WebAuthAdapter> = {}): WebAuthAdapter {
  return {
    kind: 'fake',
    authenticate: vi.fn(async () => ({ id: 'user_fake', email: 'fake@example.com', organizationId: 'org_fake' })),
    ensureOrg: vi.fn(async () => 'org_fake'),
    publicRoutes: () => [
      { path: '/auth/fake-login', method: 'GET', handler: c => c.redirect('https://fake.example/login') },
    ],
    sessionClearCookie: () => 'fake_session=; Path=/; Max-Age=0',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRuntimeConfigForTests();
  delete process.env.WORKOS_API_KEY;
  delete process.env.WORKOS_CLIENT_ID;
  delete process.env.WORKOS_REDIRECT_URI;
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  process.env = { ...ORIGINAL_ENV };
});

describe('active adapter resolution', () => {
  it('a seeded adapter enables auth regardless of env', () => {
    seedRuntimeConfig({ authAdapter: fakeAdapter() });
    expect(isWebAuthEnabled()).toBe(true);
    expect(isWorkOSAuth()).toBe(false);
  });

  it('seeding without an adapter disables auth even when WORKOS env vars are set', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    seedRuntimeConfig({});
    expect(isWebAuthEnabled()).toBe(false);
    expect(isWorkOSAuth()).toBe(false);
  });

  it('falls back to env-implied WorkOS when the factory never seeded (back-compat)', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    expect(isWebAuthEnabled()).toBe(true);
    expect(isWorkOSAuth()).toBe(true);
  });

  it('a seeded WorkOS adapter reports isWorkOSAuth and exposes its provider', () => {
    const adapter = new WorkOSWebAuth({ redirectUri: 'http://localhost:4111/auth/callback' });
    seedRuntimeConfig({ authAdapter: adapter });
    expect(isWorkOSAuth()).toBe(true);
    expect(getWorkOSProvider()).toBe(adapter.provider);
  });

  it('getWorkOSProvider throws when the active adapter is not WorkOS', () => {
    seedRuntimeConfig({ authAdapter: fakeAdapter() });
    expect(() => getWorkOSProvider()).toThrow(/not WorkOS/);
  });
});

describe('WorkOSWebAuth organization admin authorization', () => {
  const user = { workosId: 'user_1', organizationId: 'org_1' };

  it('allows the admin membership in the active organization', async () => {
    mockListOrganizationMemberships.mockResolvedValue({
      autoPagination: async () => [
        { organizationId: 'org_other', role: { slug: 'admin' } },
        { organizationId: 'org_1', role: { slug: 'admin' } },
      ],
    });
    const adapter = new WorkOSWebAuth({ redirectUri: 'http://localhost:4111/auth/callback' });

    await expect(adapter.isOrganizationAdmin(user, 'org_1')).resolves.toBe(true);
    expect(mockListOrganizationMemberships).toHaveBeenCalledWith({ userId: 'user_1' });
  });

  it('denies members, cross-organization requests, and provider failures', async () => {
    mockListOrganizationMemberships.mockResolvedValue({
      autoPagination: async () => [{ organizationId: 'org_1', role: { slug: 'member' } }],
    });
    const adapter = new WorkOSWebAuth({ redirectUri: 'http://localhost:4111/auth/callback' });

    await expect(adapter.isOrganizationAdmin(user, 'org_1')).resolves.toBe(false);
    await expect(adapter.isOrganizationAdmin(user, 'org_2')).resolves.toBe(false);

    mockListOrganizationMemberships.mockRejectedValue(new Error('workos unavailable'));
    await expect(adapter.isOrganizationAdmin(user, 'org_1')).resolves.toBe(false);
  });
});

describe('WorkOSWebAuth.init callback-URL resolution', () => {
  it('derives the callback URL from the factory publicUrl', async () => {
    const adapter = new WorkOSWebAuth();
    await expect(adapter.init?.({ publicUrl: 'https://factory.acme.com' })).resolves.toBeUndefined();
  });

  it('keeps an explicit redirectUri without needing a publicUrl', async () => {
    const adapter = new WorkOSWebAuth({ redirectUri: 'http://localhost:4111/auth/callback' });
    await expect(adapter.init?.({})).resolves.toBeUndefined();
  });

  it('fails init when no callback URL can be resolved', async () => {
    const adapter = new WorkOSWebAuth();
    await expect(adapter.init?.({})).rejects.toThrow(/could not resolve a callback URL/);
  });
});

describe('mountWebAuth with a seeded custom adapter', () => {
  function buildApp(adapter: WebAuthAdapter) {
    seedRuntimeConfig({ authAdapter: adapter });
    const app = new Hono();
    const enabled = mountWebAuth(app);
    app.get('*', c => c.text('ok'));
    return { app, enabled };
  }

  it('returns false when the registry is seeded without an adapter', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    seedRuntimeConfig({});
    const enabled = mountWebAuth(new Hono());
    expect(enabled).toBe(false);
  });

  it('mounts the adapter-provided public routes', async () => {
    const { app, enabled } = buildApp(fakeAdapter());
    expect(enabled).toBe(true);

    const res = await app.request('/auth/fake-login');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://fake.example/login');
  });

  it('gates protected routes through adapter.authenticate and stashes the tenant', async () => {
    const adapter = fakeAdapter();
    seedRuntimeConfig({ authAdapter: adapter });
    const app = new Hono();
    mountWebAuth(app);
    app.get('/web/whoami', c => c.json(webAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: 'org_fake', userId: 'user_fake' });
    expect(adapter.authenticate).toHaveBeenCalledOnce();
  });

  it('bootstraps a no-org user through adapter.ensureOrg', async () => {
    const adapter = fakeAdapter({
      authenticate: vi.fn(async () => ({ id: 'user_solo', email: 'solo@example.com' })),
      ensureOrg: vi.fn(async () => 'org_boot'),
    });
    seedRuntimeConfig({ authAdapter: adapter });
    const app = new Hono();
    mountWebAuth(app);
    app.get('/web/whoami', c => c.json(webAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(await res.json()).toEqual({ orgId: 'org_boot', userId: 'user_solo' });
    expect(adapter.ensureOrg).toHaveBeenCalledOnce();
  });

  it('returns 401 for unauthenticated API calls (adapter returns null)', async () => {
    const { app } = buildApp(fakeAdapter({ authenticate: vi.fn(async () => null) }));
    const res = await app.request('/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('serves the provider-neutral /auth/me from the adapter session', async () => {
    const { app } = buildApp(fakeAdapter());
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      user: { userId: 'user_fake', email: 'fake@example.com', organizationId: 'org_fake' },
      provider: 'fake',
    });
  });
});

describe('buildAuthRoutes', () => {
  it('folds the adapter routes plus /auth/me into unauthenticated apiRoutes', () => {
    const routes = buildAuthRoutes(fakeAdapter());
    const paths = routes.map(r => r.path);
    expect(paths).toEqual(['/auth/fake-login', '/auth/me']);
    expect(routes.every(r => r.requiresAuth === false)).toBe(true);
  });
});
