import { MastraAuthWorkos } from '@mastra/auth-workos';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthRoutes,
  getWorkOSProvider,
  isFactoryAuthEnabled,
  isWorkOSAuth,
  mountFactoryAuth,
  factoryAuthTenant,
} from './auth.js';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from './runtime-config.js';

/**
 * Provider-seam behavior: the auth module resolves the ACTIVE provider from
 * the factory-seeded registry (seeded config authoritative, including "seeded
 * with no provider" = auth explicitly disabled) and falls back to a WorkOS
 * provider implied by the `WORKOS_*` env vars only when the factory never ran.
 * Public `/auth/*` routes are derived from the provider's capabilities
 * (SSO-shaped vs HTTP-handler-shaped). Provider-specific behavior lives in the
 * provider packages' own tests.
 */

// Mock @mastra/auth-workos so no real WorkOS client is constructed.
vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {
    name = 'workos';
    authenticateToken = vi.fn(async () => null);
    authorizeUser = async () => true;
    getLoginUrl = vi.fn(() => 'https://workos.example/login');
    handleCallback = vi.fn();
  },
}));

const ORIGINAL_ENV = { ...process.env };

/** Minimal custom provider standing in for a non-WorkOS `IMastraAuthProvider`. */
function fakeProvider(overrides: Record<string, unknown> = {}): IMastraAuthProvider {
  return {
    name: 'fake',
    authenticateToken: vi.fn(async () => ({ id: 'user_fake', email: 'fake@example.com', organizationId: 'org_fake' })),
    authorizeUser: async () => true,
    ...overrides,
  } as unknown as IMastraAuthProvider;
}

/** SSO capability mixin (makes `isSSOProvider` true). */
function ssoCapability(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    getLoginUrl: vi.fn(async () => 'https://fake.example/login'),
    handleCallback: vi.fn(async () => ({ user: {}, tokens: { accessToken: 't' }, cookies: ['fake_session=abc'] })),
    getLogoutUrl: vi.fn(async () => 'https://fake.example/logout'),
    getClearSessionHeaders: vi.fn(() => ({ 'Set-Cookie': 'fake_session=; Path=/; Max-Age=0' })),
    ...overrides,
  };
}

/** HTTP-handler capability mixin (makes `isAuthHttpHandler` true). */
function httpHandlerCapability(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    handleAuthRequest: vi.fn(async () => new Response('handled', { status: 200 })),
    getClearSessionHeaders: vi.fn(() => ({ 'Set-Cookie': 'fake_session=; Path=/; Max-Age=0' })),
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

describe('active provider resolution', () => {
  it('a seeded provider enables auth regardless of env', () => {
    seedRuntimeConfig({ authProvider: fakeProvider() });
    expect(isFactoryAuthEnabled()).toBe(true);
  });

  it('seeding without a provider disables auth even when WORKOS env vars are set', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    seedRuntimeConfig({});
    expect(isFactoryAuthEnabled()).toBe(false);
  });

  it('falls back to env-implied WorkOS when the factory never seeded (back-compat)', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    expect(isFactoryAuthEnabled()).toBe(true);
    expect(isWorkOSAuth()).toBe(true);
  });

  it('a seeded MastraAuthWorkos reports isWorkOSAuth and is exposed directly', () => {
    const provider = new MastraAuthWorkos({ redirectUri: 'http://localhost:4111/auth/callback' });
    seedRuntimeConfig({ authProvider: provider as unknown as IMastraAuthProvider });
    expect(isWorkOSAuth()).toBe(true);
    expect(getWorkOSProvider()).toBe(provider);
  });

  it('getWorkOSProvider throws when the active provider is not WorkOS', () => {
    seedRuntimeConfig({ authProvider: fakeProvider() });
    expect(() => getWorkOSProvider()).toThrow(/not WorkOS/);
  });
});

describe('mountFactoryAuth with a seeded custom provider', () => {
  function buildApp(provider: IMastraAuthProvider) {
    seedRuntimeConfig({ authProvider: provider });
    const app = new Hono();
    const enabled = mountFactoryAuth(app);
    app.get('*', c => c.text('ok'));
    return { app, enabled };
  }

  it('returns false when the registry is seeded without a provider', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    seedRuntimeConfig({});
    const enabled = mountFactoryAuth(new Hono());
    expect(enabled).toBe(false);
  });

  it('derives hosted-login routes for an SSO-shaped provider', async () => {
    const { app, enabled } = buildApp(fakeProvider(ssoCapability()));
    expect(enabled).toBe(true);

    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://fake.example/login');
  });

  it('proxies /auth/api/* to an HTTP-handler-shaped provider', async () => {
    const provider = fakeProvider(httpHandlerCapability());
    const { app } = buildApp(provider);

    const res = await app.request('/auth/api/sign-in/email', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('handled');
  });

  it('redirects /auth/login to the SPA form for a handler-shaped (non-SSO) provider', async () => {
    const { app } = buildApp(fakeProvider(httpHandlerCapability()));

    const res = await app.request('/auth/login?returnTo=/chat');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/signin?returnTo=%2Fchat');
  });

  it('gates protected routes through provider.authenticateToken and stashes the tenant', async () => {
    const provider = fakeProvider();
    seedRuntimeConfig({ authProvider: provider });
    const app = new Hono();
    mountFactoryAuth(app);
    app.get('/web/whoami', c => c.json(factoryAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: 'org_fake', userId: 'user_fake' });
    expect(provider.authenticateToken).toHaveBeenCalledOnce();
  });

  it('bootstraps a no-org user through IOrganizationsProvider.ensureOrganization', async () => {
    const ensureOrganization = vi.fn(async () => 'org_boot');
    const provider = fakeProvider({
      authenticateToken: vi.fn(async () => ({ id: 'user_solo', email: 'solo@example.com' })),
      ensureOrganization,
      isOrganizationAdmin: vi.fn(async () => false),
    });
    seedRuntimeConfig({ authProvider: provider });
    const app = new Hono();
    mountFactoryAuth(app);
    app.get('/web/whoami', c => c.json(factoryAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(await res.json()).toEqual({ orgId: 'org_boot', userId: 'user_solo' });
    expect(ensureOrganization).toHaveBeenCalledWith('user_solo');
  });

  it('returns 401 for unauthenticated API calls (provider returns null)', async () => {
    const { app } = buildApp(fakeProvider({ authenticateToken: vi.fn(async () => null) }));
    const res = await app.request('/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('serves the provider-neutral /auth/me from the provider session', async () => {
    const { app } = buildApp(fakeProvider());
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      user: { userId: 'user_fake', email: 'fake@example.com', organizationId: 'org_fake' },
      provider: 'fake',
    });
  });

  it('/auth/me surfaces signUpDisabled when a credentials provider disables sign-up', async () => {
    const { app } = buildApp(
      fakeProvider({
        authenticateToken: vi.fn(async () => null),
        signIn: vi.fn(),
        isSignUpEnabled: () => false,
      }),
    );
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: false,
      user: null,
      provider: 'fake',
      signUpDisabled: true,
    });
  });

  it('logout for a handler-shaped provider revokes the session and clears the cookie', async () => {
    const handleAuthRequest = vi.fn(
      async () => new Response(null, { status: 200, headers: { 'Set-Cookie': 'fake_session=revoked; Max-Age=0' } }),
    );
    const { app } = buildApp(fakeProvider(httpHandlerCapability({ handleAuthRequest })));

    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    const revoked = handleAuthRequest.mock.calls[0]![0] as Request;
    expect(revoked.method).toBe('POST');
    expect(new URL(revoked.url).pathname).toBe('/auth/api/sign-out');
  });
});

describe('buildAuthRoutes', () => {
  it('derives SSO routes plus /auth/me as unauthenticated apiRoutes', () => {
    const routes = buildAuthRoutes(fakeProvider(ssoCapability()));
    const paths = routes.map(r => r.path);
    expect(paths).toEqual(['/auth/login', '/auth/callback', '/auth/logout', '/auth/me']);
    expect(routes.every(r => r.requiresAuth === false)).toBe(true);
  });

  it('derives handler routes plus /auth/me for an HTTP-handler-shaped provider', () => {
    const routes = buildAuthRoutes(fakeProvider(httpHandlerCapability()));
    const paths = routes.map(r => r.path);
    expect(paths).toEqual(['/auth/api/*', '/auth/login', '/auth/logout', '/auth/me']);
    expect(routes.every(r => r.requiresAuth === false)).toBe(true);
  });

  it('a bare provider still gets /auth/me', () => {
    const routes = buildAuthRoutes(fakeProvider());
    expect(routes.map(r => r.path)).toEqual(['/auth/me']);
  });
});
