import { Mastra } from '@mastra/core';
import { MASTRA_MESSAGE_AUTHOR_KEY } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthRoutes,
  createFactoryAfterAuth,
  createFactoryLoginRedirect,
  ensureFactoryAuthUser,
  factoryAuthTenant,
  factoryUserOrgId,
  getFactoryAuthOrgId,
  getFactoryAuthUser,
  getFactoryAuthUserId,
} from './auth.js';

// Mock @mastra/auth-workos so the tests exercise Factory's auth wiring without
// constructing a real WorkOS client. `authenticateToken`'s behavior is swapped
// per-test via `mockAuthenticate`.
const mockAuthenticate = vi.fn();
const mockGetLoginUrl = vi.fn((_redirectUri: string, _state: string) => 'https://workos.example/login');
const mockHandleCallback = vi.fn(async () => ({ user: { email: 'a@b.com' }, cookies: ['wos_session=sealed; Path=/'] }));
const mockGetLogoutUrl = vi.fn(async () => 'https://workos.example/logout');
const mockGetClearSessionHeaders = vi.fn(() => ({ 'Set-Cookie': 'wos_session=; Path=/; HttpOnly; Max-Age=0' }));
// Personal-org bootstrap (IOrganizationsProvider). The WorkOS-specific
// bootstrap mechanics live in @mastra/auth-workos and are covered there; here
// the mock models "no org → org_new".
const mockEnsureOrganization = vi.fn(async (_userId: string) => 'org_new');
const mockIsOrganizationAdmin = vi.fn(async () => false);
const mockConsumePendingResponseHeaders = vi.fn((_req: Request): Record<string, string> | undefined => undefined);

vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {
    name = 'workos';
    getLoginUrl = mockGetLoginUrl;
    handleCallback = mockHandleCallback;
    authenticateToken = mockAuthenticate;
    authorizeUser = async (user: { id?: string; workosId?: string } | null) => Boolean(user);
    getLogoutUrl = mockGetLogoutUrl;
    getClearSessionHeaders = mockGetClearSessionHeaders;
    ensureOrganization = mockEnsureOrganization;
    isOrganizationAdmin = mockIsOrganizationAdmin;
    consumePendingResponseHeaders = mockConsumePendingResponseHeaders;
  },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default mock behavior after clearAllMocks wipes it.
  mockGetLoginUrl.mockReturnValue('https://workos.example/login');
  mockHandleCallback.mockResolvedValue({ user: { email: 'a@b.com' }, cookies: ['wos_session=sealed; Path=/'] });
  mockGetLogoutUrl.mockResolvedValue('https://workos.example/logout');
  mockGetClearSessionHeaders.mockReturnValue({ 'Set-Cookie': 'wos_session=; Path=/; HttpOnly; Max-Age=0' });
  mockEnsureOrganization.mockResolvedValue('org_new');
  mockConsumePendingResponseHeaders.mockReturnValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function workosProvider(): Promise<IMastraAuthProvider> {
  const { MastraAuthWorkos } = await import('@mastra/auth-workos');
  return new (MastraAuthWorkos as unknown as new () => IMastraAuthProvider)();
}

/**
 * Build a real Mastra server wired the way `factory.ts` wires Factory: the
 * provider as `server.auth`, the `/auth/*` routes, the `/login` redirect, and
 * the `afterAuth` org/author step. `/web/whoami` is a private custom route;
 * `/web/open` is declared public.
 */
async function buildApp() {
  const provider = await workosProvider();
  const whoami = (c: Context) => {
    const user = getFactoryAuthUser(c);
    const requestContext = c.get('requestContext' as never) as { get(key: string): unknown };
    return c.json({
      tenant: factoryAuthTenant(c) ?? null,
      userId: getFactoryAuthUserId(user) ?? null,
      organizationId: getFactoryAuthOrgId(user) ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      author: requestContext.get(MASTRA_MESSAGE_AUTHOR_KEY) ?? null,
    });
  };
  const mastra = new Mastra({
    logger: false,
    server: {
      auth: provider,
      middleware: [
        createFactoryLoginRedirect(),
        { path: '*', phase: 'afterAuth', handler: createFactoryAfterAuth(provider) },
      ],
      apiRoutes: [
        ...buildAuthRoutes(provider),
        registerApiRoute('/web/whoami', { method: 'GET', handler: c => whoami(c as unknown as Context) }),
        registerApiRoute('/web/open', {
          method: 'GET',
          requiresAuth: false,
          handler: async c => {
            const user = await ensureFactoryAuthUser(provider, c as unknown as Context);
            return c.json({ userId: getFactoryAuthUserId(user) ?? null });
          },
        }),
      ],
    } as never,
  });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return { app };
}

const bearer = { Accept: 'application/json', Authorization: 'Bearer cli-token' };

describe('Factory auth on protected routes (core route auth + afterAuth)', () => {
  it('returns 401 for unauthenticated requests to private /web routes', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('authenticates once per request and exposes the user to the handler', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_123',
      email: 'user@example.com',
      organizationId: 'org_a',
      avatarUrl: 'https://avatars.example/user.png',
    });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: bearer });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      tenant: { orgId: 'org_a', userId: 'user_123' },
      avatarUrl: 'https://avatars.example/user.png',
    });
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('names the signed-in user as the author of messages sent on this request', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_123',
      email: 'user@example.com',
      organizationId: 'org_a',
      avatarUrl: 'https://avatars.example/user.png',
    });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: bearer });
    expect((await res.json()).author).toEqual({
      id: 'user_123',
      name: 'user@example.com',
      avatarUrl: 'https://avatars.example/user.png',
    });
  });

  it('forwards a renewed session cookie on private custom routes', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'user_1', email: 'a@b.com', organizationId: 'org_1' });
    mockConsumePendingResponseHeaders.mockReturnValue({ 'Set-Cookie': 'wos-session=v2; Path=/; Max-Age=1209600' });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: bearer });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual(['wos-session=v2; Path=/; Max-Age=1209600']);
  });

  it('selects a requested bearer organization proven by provider memberships', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_123',
      memberships: [
        { id: 'membership_1', organizationId: 'org_1' },
        { id: 'membership_2', organizationId: 'org_2' },
      ],
    });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: { ...bearer, 'X-Mastra-Organization-Id': 'org_2' } });
    expect(res.status).toBe(200);
    expect((await res.json()).tenant).toEqual({ orgId: 'org_2', userId: 'user_123' });
    expect(mockEnsureOrganization).not.toHaveBeenCalled();
  });

  it('selects a requested bearer organization proven by Studio membership ids', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'user_123', organizationId: 'org_1', memberOrgIds: ['org_1', 'org_2'] });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: { ...bearer, 'X-Mastra-Organization-Id': 'org_2' } });
    expect(res.status).toBe(200);
    expect((await res.json()).tenant).toEqual({ orgId: 'org_2', userId: 'user_123' });
  });

  it('rejects a requested bearer organization not present in provider memberships', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_123',
      memberships: [{ id: 'membership_1', organizationId: 'org_1' }],
    });
    const { app } = await buildApp();

    for (const path of ['/web/whoami', '/api/agents']) {
      const res = await app.request(path, { headers: { ...bearer, 'X-Mastra-Organization-Id': 'org_other' } });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'organization_forbidden' });
    }
    expect(mockEnsureOrganization).not.toHaveBeenCalled();
  });

  it('does not let an organization header change cookie-authenticated tenancy', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_123', organizationId: 'org_cookie' });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', {
      headers: { Accept: 'application/json', Cookie: 'wos-session=abc', 'X-Mastra-Organization-Id': 'org_other' },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).tenant).toEqual({ orgId: 'org_cookie', userId: 'user_123' });
  });

  it('bootstraps a no-org user so the tenant yields the new org', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_boot', email: 'boot@example.com' });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: bearer });
    expect((await res.json()).tenant).toEqual({ orgId: 'org_new', userId: 'user_boot' });
    expect(mockEnsureOrganization).toHaveBeenCalledWith('user_boot');
  });

  it('keeps a no-org user personal when the bootstrap fails', async () => {
    mockEnsureOrganization.mockRejectedValue(new Error('workos unavailable'));
    mockAuthenticate.mockResolvedValue({ workosId: 'user_err', email: 'err@e.com' });
    const { app } = await buildApp();

    const res = await app.request('/web/whoami', { headers: bearer });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ userId: 'user_err', organizationId: null });
  });

  it('forwards the platform deploy-auth /login landing to /signin with its query intact', async () => {
    const { app } = await buildApp();

    const res = await app.request('/login?error=access_denied&error_description=You%20do%20not%20have%20access');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      '/signin?error=access_denied&error_description=You%20do%20not%20have%20access',
    );
  });
});

describe('ensureFactoryAuthUser on public (requiresAuth: false) routes', () => {
  it('authenticates itself and forwards a renewed session cookie', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'user_1', email: 'a@b.com', organizationId: 'org_1' });
    mockConsumePendingResponseHeaders.mockReturnValue({ 'Set-Cookie': 'wos-session=v2; Path=/; Max-Age=1209600' });
    const { app } = await buildApp();

    const res = await app.request('/web/open', { headers: bearer });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_1' });
    expect(res.headers.get('set-cookie')).toBe('wos-session=v2; Path=/; Max-Age=1209600');
  });

  it('still authenticates when forwarding headers throws', async () => {
    mockAuthenticate.mockResolvedValue({ id: 'user_1', email: 'a@b.com', organizationId: 'org_1' });
    mockConsumePendingResponseHeaders.mockImplementation(() => {
      throw new Error('boom');
    });
    const { app } = await buildApp();

    const res = await app.request('/web/open', { headers: bearer });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_1' });
  });
});

describe('/auth routes', () => {
  it('redirects /auth/login to the WorkOS login URL', async () => {
    const { app } = await buildApp();
    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/login');
    expect(mockGetLoginUrl).toHaveBeenCalledOnce();
  });

  it('encodes returnTo into pipe-format state (MastraAuthStudio contract)', async () => {
    const { app } = await buildApp();
    await app.request('/auth/login?returnTo=/dashboard');
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    const pipeIndex = state.indexOf('|');
    expect(pipeIndex).toBeGreaterThan(0);
    expect(decodeURIComponent(state.slice(pipeIndex + 1))).toBe('/dashboard');
  });

  it('stashes returnTo in a short-lived cookie across the login round-trip', async () => {
    const { app } = await buildApp();
    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.headers.get('set-cookie')).toContain('mastra_factory_return_to=%2Fdashboard');
  });

  it('rejects external returnTo in login (open-redirect protection)', async () => {
    const { app } = await buildApp();
    await app.request('/auth/login?returnTo=https://evil.com');
    // The encoded state must carry the sanitized "/" path, not the external URL.
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    expect(decodeURIComponent(state.split('|')[1]!)).toBe('/');
  });

  it('rejects protocol-relative returnTo', async () => {
    const { app } = await buildApp();
    await app.request('/auth/login?returnTo=//evil.com');
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    expect(decodeURIComponent(state.split('|')[1]!)).toBe('/');
  });

  it('handles the callback, applies cookies, and redirects to decoded returnTo', async () => {
    const { app } = await buildApp();
    const state = `uuid-1|${encodeURIComponent('/dashboard')}`;
    const res = await app.request(`/auth/callback?code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/dashboard');
    expect(res.headers.get('set-cookie')).toContain('wos_session=sealed');
    // Hono percent-decodes query values, so the provider sees the raw pipe form.
    expect(mockHandleCallback).toHaveBeenCalledWith('abc', 'uuid-1|/dashboard');
  });

  it('falls back to the returnTo cookie when the callback has no state', async () => {
    const { app } = await buildApp();
    const res = await app.request('/auth/callback?code=abc', {
      headers: { Cookie: 'mastra_factory_return_to=%2Fconnect%2Fslack%3Fstate%3Dsigned' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/connect/slack?state=signed');
    // The stash cookie must be cleared once consumed.
    expect(res.headers.get('set-cookie')).toContain('mastra_factory_return_to=;');
  });

  it('rejects an external URL smuggled into the returnTo cookie', async () => {
    const { app } = await buildApp();
    const res = await app.request('/auth/callback?code=abc', {
      headers: { Cookie: `mastra_factory_return_to=${encodeURIComponent('https://evil.com')}` },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  it('redirects callback back to login when code is missing', async () => {
    const { app } = await buildApp();
    const res = await app.request('/auth/callback');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
    expect(mockHandleCallback).not.toHaveBeenCalled();
  });

  it('surfaces an IdP denial on /signin, keeping the intended destination for a retry', async () => {
    const { app } = await buildApp();
    const state = `uuid-1|${encodeURIComponent('/dashboard')}`;
    const res = await app.request(
      `/auth/callback?error=access_denied&error_description=You%20do%20not%20have%20access&state=${state}`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      '/signin?error=access_denied&error_description=You+do+not+have+access&returnTo=%2Fdashboard',
    );
    expect(mockHandleCallback).not.toHaveBeenCalled();
  });

  it('caps the denial values so a hostile IdP response cannot inflate the /signin URL', async () => {
    const { app } = await buildApp();
    const res = await app.request(`/auth/callback?error=${'e'.repeat(200)}&error_description=${'d'.repeat(1000)}`);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') ?? '', 'https://app.example');
    expect(location.searchParams.get('error')).toBe('e'.repeat(64));
    expect(location.searchParams.get('error_description')).toBe('d'.repeat(256));
  });

  it('redirects callback back to login when the code exchange fails', async () => {
    mockHandleCallback.mockRejectedValue(new Error('expired code'));
    const { app } = await buildApp();
    const state = `uuid-1|${encodeURIComponent('/dashboard')}`;
    const res = await app.request(`/auth/callback?code=bad&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
  });

  it('logout clears the session cookie and redirects to the WorkOS logout URL', async () => {
    const { app } = await buildApp();
    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/logout');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('logout still clears the session cookie when the provider has no logout URL', async () => {
    mockGetLogoutUrl.mockRejectedValue(new Error('no session'));
    const { app } = await buildApp();
    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('/auth/me reports authenticated:false when no session', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = await buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false, user: null, provider: 'workos' });
  });

  it('/auth/me reports the user when authenticated', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_me',
      email: 'user@example.com',
      name: 'User',
      avatarUrl: 'https://avatars.example/user.png',
    });
    const { app } = await buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      telemetryEnabled: false,
      // No-org accounts are bootstrapped into a personal org during /auth/me.
      user: {
        userId: 'user_me',
        email: 'user@example.com',
        name: 'User',
        avatarUrl: 'https://avatars.example/user.png',
        organizationId: 'org_new',
      },
      provider: 'workos',
    });
    expect(mockEnsureOrganization).toHaveBeenCalledWith('user_me');
  });

  it('/auth/me forwards a renewed session cookie', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_me', email: 'user@example.com' });
    mockConsumePendingResponseHeaders.mockReturnValue({ 'Set-Cookie': 'wos-session=v2; Path=/; Max-Age=1209600' });
    const { app } = await buildApp();
    const res = await app.request('/auth/me', { headers: { cookie: 'wos-session=v1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('wos-session=v2');
  });

  it('/auth/me surfaces the organization id and stable user id to the SPA', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_1',
      email: 'user@example.com',
      name: 'User',
      organizationId: 'org_a',
    });
    const { app } = await buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      telemetryEnabled: false,
      user: { email: 'user@example.com', name: 'User', organizationId: 'org_a', userId: 'user_1' },
      provider: 'workos',
    });
    expect(mockEnsureOrganization).not.toHaveBeenCalled();
  });
});

describe('org-tenant identity', () => {
  it('getFactoryAuthOrgId reads the organization id from the user shape', () => {
    expect(getFactoryAuthOrgId({ workosId: 'user_1', organizationId: 'org_a' })).toBe('org_a');
    expect(getFactoryAuthOrgId({ workosId: 'user_1' })).toBeUndefined();
    expect(getFactoryAuthOrgId(undefined)).toBeUndefined();
  });

  it('factoryUserOrgId keys personal users on their own rung, never the shared local scope', () => {
    expect(factoryUserOrgId({ workosId: 'user_1', organizationId: 'org_a' })).toBe('org_a');
    expect(factoryUserOrgId({ id: 'user_2' })).toBe('user:user_2');
    // No user at all means no per-user rung; callers fall back to `local`.
    expect(factoryUserOrgId(undefined)).toBeUndefined();
    expect(factoryUserOrgId({ email: 'no-id@example.com' })).toBeUndefined();
  });
});
