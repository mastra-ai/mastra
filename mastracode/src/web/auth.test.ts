import { MastraAuthWorkos } from '@mastra/auth-workos';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WebAuthUser } from './auth.js';
import {
  ensureUserHasOrganization,
  getWebAuthOrgId,
  getWebAuthUser,
  getWebAuthUserId,
  isWebAuthEnabled,
  mountWebAuth,
  webAuthTenant,
} from './auth.js';

// Mock @mastra/auth-workos so the tests exercise the gating/routing logic in
// this module without constructing a real WorkOS client. `authenticateToken`'s
// behavior is swapped per-test via `mockAuthenticate`.
const mockAuthenticate = vi.fn();
const mockGetLoginUrl = vi.fn((_redirectUri: string, _state: string) => 'https://workos.example/login');
const mockHandleCallback = vi.fn(async () => ({ user: { email: 'a@b.com' }, cookies: ['wos_session=sealed; Path=/'] }));
const mockGetLogoutUrl = vi.fn(async () => 'https://workos.example/logout');

// WorkOS SDK surface used by the personal-org bootstrap. Each test controls the
// list/create behavior; defaults model "no memberships, creates org_new".
const mockListMemberships = vi.fn(async () => ({
  autoPagination: async () => [] as Array<{ organizationId: string }>,
}));
const mockCreateOrganization = vi.fn(
  async (_payload: Record<string, unknown>, _requestOptions?: Record<string, unknown>) => ({ id: 'org_new' }),
);
const mockCreateMembership = vi.fn(async () => ({ id: 'om_new' }));
const mockGetOrgByExternalId = vi.fn(async (_externalId: string) => ({ id: 'org_recovered' }));
const mockGetWorkOS = vi.fn(() => ({
  organizations: {
    createOrganization: mockCreateOrganization,
    getOrganizationByExternalId: mockGetOrgByExternalId,
  },
  userManagement: {
    listOrganizationMemberships: mockListMemberships,
    createOrganizationMembership: mockCreateMembership,
  },
}));

vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {
    getLoginUrl = mockGetLoginUrl;
    handleCallback = mockHandleCallback;
    authenticateToken = mockAuthenticate;
    getLogoutUrl = mockGetLogoutUrl;
    getWorkOS = mockGetWorkOS;
  },
}));

const ORIGINAL_ENV = { ...process.env };

function enableEnv() {
  process.env.WORKOS_API_KEY = 'sk_test';
  process.env.WORKOS_CLIENT_ID = 'client_test';
}

function disableEnv() {
  delete process.env.WORKOS_API_KEY;
  delete process.env.WORKOS_CLIENT_ID;
  delete process.env.WORKOS_REDIRECT_URI;
}

beforeEach(() => {
  vi.clearAllMocks();
  disableEnv();
  // Restore default bootstrap mock behavior after clearAllMocks wipes it.
  mockListMemberships.mockResolvedValue({ autoPagination: async () => [] });
  mockCreateOrganization.mockResolvedValue({ id: 'org_new' });
  mockCreateMembership.mockResolvedValue({ id: 'om_new' });
  mockGetOrgByExternalId.mockResolvedValue({ id: 'org_recovered' });
  mockGetWorkOS.mockReturnValue({
    organizations: {
      createOrganization: mockCreateOrganization,
      getOrganizationByExternalId: mockGetOrgByExternalId,
    },
    userManagement: {
      listOrganizationMemberships: mockListMemberships,
      createOrganizationMembership: mockCreateMembership,
    },
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Build a gated app where the protected catch-all returns 200 "ok". */
function buildApp() {
  const app = new Hono();
  const enabled = mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
  app.get('*', c => c.text('ok'));
  return { app, enabled };
}

describe('isWebAuthEnabled', () => {
  it('is false when env vars are missing', () => {
    expect(isWebAuthEnabled()).toBe(false);
  });

  it('is false when only one env var is set', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    expect(isWebAuthEnabled()).toBe(false);
  });

  it('is true when both env vars are set', () => {
    enableEnv();
    expect(isWebAuthEnabled()).toBe(true);
  });
});

describe('mountWebAuth (disabled)', () => {
  it('is a no-op and leaves routes ungated', async () => {
    const { app, enabled } = buildApp();
    expect(enabled).toBe(false);

    const res = await app.request('/api/anything', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

describe('mountWebAuth gate (enabled)', () => {
  beforeEach(enableEnv);

  it('redirects unauthenticated HTML navigation to login with returnTo', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/some/page', { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('/auth/login?returnTo=')).toBe(true);
    expect(decodeURIComponent(location.split('returnTo=')[1]!)).toBe('/some/page');
  });

  it('returns 401 JSON for unauthenticated /api requests', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/api/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 for unauthenticated non-HTML navigation (XHR)', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/some/page', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('passes through when the provider authenticates', async () => {
    mockAuthenticate.mockResolvedValue({ email: 'user@example.com', name: 'User' });
    const { app } = buildApp();

    const res = await app.request('/api/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('treats a thrown provider error as unauthenticated', async () => {
    mockAuthenticate.mockRejectedValue(new Error('boom'));
    const { app } = buildApp();

    const res = await app.request('/api/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('stashes the authenticated user on the context for downstream routes', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_123', email: 'user@example.com', name: 'User' });
    const app = new Hono();
    mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/api/web/whoami', c => {
      const user = getWebAuthUser(c);
      return c.json({ userId: getWebAuthUserId(user) });
    });

    const res = await app.request('/api/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_123' });
  });
});

describe('mountWebAuth /auth routes (enabled)', () => {
  beforeEach(enableEnv);

  it('redirects /auth/login to the WorkOS login URL', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/login');
    expect(mockGetLoginUrl).toHaveBeenCalledOnce();
  });

  it('rejects external returnTo in login (open-redirect protection)', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=https://evil.com');
    // The encoded state must carry the sanitized "/" path, not the external URL.
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    expect(decoded.returnTo).toBe('/');
  });

  it('rejects protocol-relative returnTo', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=//evil.com');
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    expect(decoded.returnTo).toBe('/');
  });

  it('handles the callback, applies cookies, and redirects to decoded returnTo', async () => {
    const { app } = buildApp();
    const state = Buffer.from(JSON.stringify({ returnTo: '/dashboard' }), 'utf8').toString('base64url');
    const res = await app.request(`/auth/callback?code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/dashboard');
    expect(res.headers.get('set-cookie')).toContain('wos_session=sealed');
    expect(mockHandleCallback).toHaveBeenCalledWith('abc', state);
  });

  it('redirects callback back to login when code is missing', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/callback');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
    expect(mockHandleCallback).not.toHaveBeenCalled();
  });

  it('logout clears the session cookie and redirects to the WorkOS logout URL', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/logout');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('/auth/me reports authenticated:false when no session', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false, user: null });
  });

  it('/auth/me reports the user when authenticated', async () => {
    mockAuthenticate.mockResolvedValue({ email: 'user@example.com', name: 'User' });
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true, user: { email: 'user@example.com', name: 'User' } });
  });

  it('/auth/me surfaces the organization id to the SPA', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_1',
      email: 'user@example.com',
      name: 'User',
      organizationId: 'org_a',
    });
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      user: { email: 'user@example.com', name: 'User', organizationId: 'org_a' },
    });
  });
});

describe('org-tenant identity', () => {
  beforeEach(enableEnv);

  it('getWebAuthOrgId reads the organization id from the user shape', () => {
    expect(getWebAuthOrgId({ workosId: 'user_1', organizationId: 'org_a' })).toBe('org_a');
    expect(getWebAuthOrgId({ workosId: 'user_1' })).toBeUndefined();
    expect(getWebAuthOrgId(undefined)).toBeUndefined();
  });

  it('gate stashes organizationId and webAuthTenant returns { orgId, userId }', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_1', organizationId: 'org_a', email: 'u@e.com' });
    const app = new Hono();
    mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/api/web/whoami', c => c.json(webAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/api/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: 'org_a', userId: 'user_1' });
  });

  it('webAuthTenant omits orgId for personal (no-org) users but keeps userId', async () => {
    // Bootstrap is best-effort: when org creation fails, the user genuinely
    // stays no-org, so the tenant must still expose a userId without an orgId.
    mockCreateOrganization.mockRejectedValue(new Error('insufficient permissions'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockAuthenticate.mockResolvedValue({ workosId: 'user_solo', email: 'solo@e.com' });
    const app = new Hono();
    mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/api/web/whoami', c => {
      const tenant = webAuthTenant(c);
      return c.json({ orgId: tenant?.orgId ?? null, userId: tenant?.userId ?? null });
    });

    const res = await app.request('/api/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: null, userId: 'user_solo' });
  });
});

describe('ensureUserHasOrganization (personal-org bootstrap)', () => {
  beforeEach(enableEnv);

  function makeProvider() {
    // The mocked MastraAuthWorkos has no real constructor side effects; cast
    // through unknown so we can call the real ensureUserHasOrganization helper.
    return new MastraAuthWorkos() as unknown as Parameters<typeof ensureUserHasOrganization>[0];
  }

  it('creates an org + membership for a no-org user with zero memberships', async () => {
    const user: WebAuthUser = { workosId: 'user_1', email: 'solo@example.com' };
    const orgId = await ensureUserHasOrganization(makeProvider(), user);

    expect(orgId).toBe('org_new');
    expect(mockCreateOrganization).toHaveBeenCalledTimes(1);
    const [payload, requestOptions] = mockCreateOrganization.mock.calls[0]!;
    // Idempotency: externalId + stable idempotency key keyed on the user id.
    expect(payload).toMatchObject({ externalId: 'user_1' });
    expect(requestOptions).toEqual({ idempotencyKey: 'mastracode-personal-org:user_1' });
    expect(mockCreateMembership).toHaveBeenCalledWith({ organizationId: 'org_new', userId: 'user_1' });
  });

  it('returns an existing membership org without creating a new one', async () => {
    mockListMemberships.mockResolvedValue({ autoPagination: async () => [{ organizationId: 'org_existing' }] });
    const orgId = await ensureUserHasOrganization(makeProvider(), { workosId: 'user_2' });

    expect(orgId).toBe('org_existing');
    expect(mockCreateOrganization).not.toHaveBeenCalled();
    expect(mockCreateMembership).not.toHaveBeenCalled();
  });

  it('is a no-op (no SDK calls) when the user already has an organizationId', async () => {
    const orgId = await ensureUserHasOrganization(makeProvider(), { workosId: 'user_3', organizationId: 'org_a' });

    expect(orgId).toBe('org_a');
    expect(mockGetWorkOS).not.toHaveBeenCalled();
    expect(mockListMemberships).not.toHaveBeenCalled();
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('swallows WorkOS create errors and returns undefined (user stays no-org)', async () => {
    mockCreateOrganization.mockRejectedValue(new Error('insufficient permissions'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const orgId = await ensureUserHasOrganization(makeProvider(), { workosId: 'user_4' });

    expect(orgId).toBeUndefined();
    warn.mockRestore();
  });

  it('recovers the existing org by externalId when create hits external_id_already_used', async () => {
    // A prior partial bootstrap created the org but never attached membership,
    // so create now 400s. We must look the org up and (re)attach the user.
    mockCreateOrganization.mockRejectedValue({ code: 'external_id_already_used' });

    const orgId = await ensureUserHasOrganization(makeProvider(), { workosId: 'user_partial' });

    expect(orgId).toBe('org_recovered');
    expect(mockGetOrgByExternalId).toHaveBeenCalledWith('user_partial');
    expect(mockCreateMembership).toHaveBeenCalledWith({
      organizationId: 'org_recovered',
      userId: 'user_partial',
    });
  });

  it('reads the WorkOS error code from rawData when recovering', async () => {
    mockCreateOrganization.mockRejectedValue({ rawData: { code: 'external_id_already_used' } });

    const orgId = await ensureUserHasOrganization(makeProvider(), { workosId: 'user_raw' });

    expect(orgId).toBe('org_recovered');
  });

  it('tolerates an already-existing membership on the recovered org', async () => {
    mockCreateOrganization.mockRejectedValue({ code: 'external_id_already_used' });
    mockCreateMembership.mockRejectedValue({ code: 'organization_membership_already_exists' });

    const orgId = await ensureUserHasOrganization(makeProvider(), { workosId: 'user_member' });

    expect(orgId).toBe('org_recovered');
  });

  it('gate bootstraps a no-org user so webAuthTenant yields the new org', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_boot', email: 'boot@example.com' });
    const app = new Hono();
    mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/api/web/whoami', c => c.json(webAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/api/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: 'org_new', userId: 'user_boot' });
    expect(mockCreateOrganization).toHaveBeenCalledTimes(1);
  });
});
