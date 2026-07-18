import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '@mastra/pg';
import type { BetterAuthInstance } from './auth-better-adapter.js';
import { BetterAuthWebAuth } from './auth-better-adapter.js';

/**
 * BetterAuthWebAuth against a mocked better-auth instance: session resolution
 * (cookie + bearer synthesis), the WorkOS-mirroring personal-org bootstrap on
 * the organization tables, sign-up gating plumbing, and the public routes
 * (API passthrough, /auth/login → /signin, /auth/logout). Real better-auth
 * behavior (handlers, migrations) is exercised in manual smoke.
 */

const ORIGINAL_ENV = { ...process.env };

interface MockDbAdapter {
  findMany: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

function mockDbAdapter(overrides: Partial<MockDbAdapter> = {}): MockDbAdapter {
  return {
    findMany: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    create: vi.fn(async (input: { model: string }) => ({ id: `${input.model}_created` })),
    ...overrides,
  };
}

function mockInstance({
  session = null as unknown,
  dbAdapter = mockDbAdapter(),
  options = {} as Record<string, unknown>,
} = {}) {
  const instance = {
    api: {
      getSession: vi.fn(async (_input: { headers: Headers }) => session),
      signOut: vi.fn(async () => new Response(null, { status: 200 })),
    },
    handler: vi.fn(async () => new Response('better-auth handled', { status: 200 })),
    $context: Promise.resolve({ adapter: dbAdapter }),
    options,
  };
  return { instance: instance as unknown as BetterAuthInstance, mocks: instance, dbAdapter };
}

function buildRouteApp(adapter: BetterAuthWebAuth) {
  const app = new Hono();
  for (const route of adapter.publicRoutes()) {
    const methods = route.method === 'ALL' ? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] : [route.method];
    app.on(methods, route.path, c => route.handler(c));
  }
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MASTRACODE_ALLOWED_ORIGINS;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('construction and init', () => {
  it('requires secret or instance', () => {
    expect(() => new BetterAuthWebAuth()).toThrow(/secret|instance/);
  });

  it('accepts a bring-your-own instance and skips construction in init()', async () => {
    const { instance } = mockInstance();
    const adapter = new BetterAuthWebAuth({ instance });
    await adapter.init?.({});
    expect(adapter.instance).toBe(instance);
  });

  it('the default path fails fast in init() without a database', async () => {
    const adapter = new BetterAuthWebAuth({ secret: 's3cret' });
    await expect(adapter.init?.({ publicUrl: 'https://factory.acme.com' })).rejects.toThrow(/database/);
  });

  it('accessing the instance before init() throws', () => {
    const adapter = new BetterAuthWebAuth({ secret: 's3cret' });
    expect(() => adapter.instance).toThrow(/not initialized/);
  });

  it('trusts the factory allowedOrigins on the default instance', async () => {
    // SameSite=None only lets the browser send the cookie — better-auth still
    // rejects requests from origins outside trustedOrigins, so cross-origin
    // SPA deploys must have their origins forwarded.
    const adapter = new BetterAuthWebAuth({ secret: 's3cret' });
    await adapter.init?.({
      storage: new PostgresStore({ id: 'auth-test', connectionString: 'postgres://user:pw@localhost:5432/app' }),
      publicUrl: 'https://api.acme.com',
      allowedOrigins: ['https://app.acme.com'],
    });
    expect((adapter.instance as { options: { trustedOrigins?: unknown } }).options.trustedOrigins).toEqual([
      'https://app.acme.com',
    ]);
  });
});

describe('authenticate', () => {
  const sessionResult = {
    session: { id: 'sess_1' },
    user: { id: 'user_1', email: 'u@example.com', name: 'U Ser' },
  };

  it('resolves the user from the request session cookie', async () => {
    const { instance, mocks } = mockInstance({ session: sessionResult });
    const adapter = new BetterAuthWebAuth({ instance });

    const raw = new Request('http://localhost/web/x', {
      headers: { Cookie: 'better-auth.session_token=tok_abc' },
    });
    const user = await adapter.authenticate('', raw);

    expect(user).toEqual({ id: 'user_1', email: 'u@example.com', name: 'U Ser' });
    const headers = mocks.api.getSession.mock.calls[0]![0]!.headers;
    expect(headers.get('Cookie')).toBe('better-auth.session_token=tok_abc');
  });

  it('synthesizes a session cookie from a bearer token when none is present', async () => {
    const { instance, mocks } = mockInstance({ session: sessionResult });
    const adapter = new BetterAuthWebAuth({ instance });

    await adapter.authenticate('tok_bearer', new Request('http://localhost/web/x'));

    const headers = mocks.api.getSession.mock.calls[0]![0]!.headers;
    expect(headers.get('Cookie')).toBe('better-auth.session_token=tok_bearer');
  });

  it('leaves an existing session cookie alone even with a bearer token', async () => {
    const { instance, mocks } = mockInstance({ session: sessionResult });
    const adapter = new BetterAuthWebAuth({ instance });

    const raw = new Request('http://localhost/web/x', {
      headers: { Cookie: 'better-auth.session_token=tok_cookie' },
    });
    await adapter.authenticate('tok_bearer', raw);

    const headers = mocks.api.getSession.mock.calls[0]![0]!.headers;
    expect(headers.get('Cookie')).toBe('better-auth.session_token=tok_cookie');
  });

  it('returns null when there is no session', async () => {
    const { instance } = mockInstance({ session: null });
    const adapter = new BetterAuthWebAuth({ instance });
    expect(await adapter.authenticate('', new Request('http://localhost/web/x'))).toBeNull();
  });

  it('returns null instead of throwing when getSession fails', async () => {
    const { instance, mocks } = mockInstance();
    mocks.api.getSession.mockRejectedValue(new Error('db down'));
    const adapter = new BetterAuthWebAuth({ instance });
    expect(await adapter.authenticate('', new Request('http://localhost/web/x'))).toBeNull();
  });

  it('maps the active organization from the session when present', async () => {
    const { instance } = mockInstance({
      session: { session: { id: 'sess_1', activeOrganizationId: 'org_active' }, user: sessionResult.user },
    });
    const adapter = new BetterAuthWebAuth({ instance });
    const user = await adapter.authenticate('', new Request('http://localhost/web/x'));
    expect(user?.organizationId).toBe('org_active');
  });
});

describe('isOrganizationAdmin', () => {
  const user = { id: 'user_1', organizationId: 'org_1' };

  it.each(['owner', 'admin'])('allows the %s role', async role => {
    const dbAdapter = mockDbAdapter({
      findOne: vi.fn(async () => ({ organizationId: 'org_1', role })),
    });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    await expect(adapter.isOrganizationAdmin(user, 'org_1')).resolves.toBe(true);
    expect(dbAdapter.findOne).toHaveBeenCalledWith({
      model: 'member',
      where: [
        { field: 'organizationId', value: 'org_1' },
        { field: 'userId', value: 'user_1' },
      ],
    });
  });

  it('denies member roles and cross-organization requests', async () => {
    const dbAdapter = mockDbAdapter({
      findOne: vi.fn(async () => ({ organizationId: 'org_1', role: 'member' })),
    });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    await expect(adapter.isOrganizationAdmin(user, 'org_1')).resolves.toBe(false);
    await expect(adapter.isOrganizationAdmin(user, 'org_2')).resolves.toBe(false);
  });

  it('fails closed when membership lookup fails', async () => {
    const dbAdapter = mockDbAdapter({ findOne: vi.fn(async () => Promise.reject(new Error('db down'))) });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    await expect(adapter.isOrganizationAdmin(user, 'org_1')).resolves.toBe(false);
  });
});

describe('ensureOrg (personal-org bootstrap)', () => {
  const user = { id: 'user_1', email: 'u@example.com' };

  it('no-ops when the user already has an organization', async () => {
    const { instance, dbAdapter } = mockInstance();
    const adapter = new BetterAuthWebAuth({ instance });
    expect(await adapter.ensureOrg({ ...user, organizationId: 'org_x' })).toBe('org_x');
    expect(dbAdapter.findMany).not.toHaveBeenCalled();
  });

  it('returns the first existing membership org without creating', async () => {
    const dbAdapter = mockDbAdapter({ findMany: vi.fn(async () => [{ organizationId: 'org_existing' }]) });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    expect(await adapter.ensureOrg(user)).toBe('org_existing');
    expect(dbAdapter.create).not.toHaveBeenCalled();
  });

  it('creates a personal org + owner membership for a no-org user', async () => {
    const dbAdapter = mockDbAdapter({
      create: vi.fn(async (input: { model: string }) =>
        input.model === 'organization' ? { id: 'org_new' } : { id: 'member_new' },
      ),
    });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    expect(await adapter.ensureOrg(user)).toBe('org_new');

    const orgCall = dbAdapter.create.mock.calls.find(([input]) => input.model === 'organization')![0];
    expect(orgCall.data).toMatchObject({ name: "u@example.com's org", slug: 'personal-user_1' });
    const memberCall = dbAdapter.create.mock.calls.find(([input]) => input.model === 'member')![0];
    expect(memberCall.data).toMatchObject({ organizationId: 'org_new', userId: 'user_1', role: 'owner' });
  });

  it('recovers the existing org by slug when the create hits the unique constraint', async () => {
    const dbAdapter = mockDbAdapter({
      create: vi.fn(async (input: { model: string }) => {
        if (input.model === 'organization') throw new Error('duplicate key value violates unique constraint');
        return { id: 'member_new' };
      }),
      findOne: vi.fn(async (input: { model: string }) => (input.model === 'organization' ? { id: 'org_prior' } : null)),
    });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    expect(await adapter.ensureOrg(user)).toBe('org_prior');
    expect(dbAdapter.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'organization', where: [{ field: 'slug', value: 'personal-user_1' }] }),
    );
  });

  it('does not adopt a slug-squatted org owned by another user', async () => {
    // An attacker pre-created `personal-user_1` through the public org API and
    // is its owner. Recovery must NOT attach the victim there — it creates a
    // fresh personal org with an unguessable slug instead.
    const createdOrgs: Array<{ slug: string }> = [];
    const dbAdapter = mockDbAdapter({
      create: vi.fn(async (input: { model: string; data?: { slug?: string } }) => {
        if (input.model === 'organization') {
          if (input.data?.slug === 'personal-user_1') throw new Error('duplicate key value violates unique constraint');
          createdOrgs.push({ slug: input.data!.slug! });
          return { id: 'org_fallback' };
        }
        return { id: 'member_new' };
      }),
      findOne: vi.fn(async (input: { model: string }) =>
        input.model === 'organization' ? { id: 'org_squatted' } : null,
      ),
      findMany: vi.fn(async (input: { model: string; where?: Array<{ field: string }> }) => {
        // First call: the victim's memberships (none). Second: the squatted org's members.
        if (input.model === 'member' && input.where?.[0]?.field === 'organizationId') {
          return [{ organizationId: 'org_squatted', userId: 'attacker_1' }];
        }
        return [];
      }),
    });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    expect(await adapter.ensureOrg(user)).toBe('org_fallback');
    expect(createdOrgs[0]!.slug).toMatch(/^personal-user_1-[0-9a-f-]{36}$/);
    // The victim's owner membership lands on the fallback org, never the squatted one.
    const memberCall = dbAdapter.create.mock.calls.find(([input]) => input.model === 'member')![0];
    expect(memberCall.data).toMatchObject({ organizationId: 'org_fallback', userId: 'user_1', role: 'owner' });
  });

  it('tolerates a membership a concurrent bootstrap already created', async () => {
    const dbAdapter = mockDbAdapter({
      create: vi.fn(async (input: { model: string }) => {
        if (input.model === 'organization') return { id: 'org_new' };
        throw new Error('duplicate member');
      }),
      findOne: vi.fn(async (input: { model: string }) => (input.model === 'member' ? { id: 'member_prior' } : null)),
    });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    expect(await adapter.ensureOrg(user)).toBe('org_new');
  });

  it('is best-effort: swallows failures and returns undefined', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dbAdapter = mockDbAdapter({ findMany: vi.fn(async () => Promise.reject(new Error('db down'))) });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    expect(await adapter.ensureOrg(user)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('caches the resolved org so subsequent calls skip the DB', async () => {
    const dbAdapter = mockDbAdapter({ findMany: vi.fn(async () => [{ organizationId: 'org_cached' }]) });
    const { instance } = mockInstance({ dbAdapter });
    const adapter = new BetterAuthWebAuth({ instance });

    await adapter.ensureOrg(user);
    await adapter.ensureOrg(user);
    expect(dbAdapter.findMany).toHaveBeenCalledOnce();
  });
});

describe('session cookie', () => {
  it('clears the default cookie with SameSite=Lax same-origin', () => {
    const { instance } = mockInstance();
    const adapter = new BetterAuthWebAuth({ instance });
    expect(adapter.sessionClearCookie()).toBe('better-auth.session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  });

  it('uses SameSite=None; Secure for cross-site deploys', () => {
    process.env.MASTRACODE_ALLOWED_ORIGINS = 'https://app.acme.com';
    const { instance } = mockInstance();
    const adapter = new BetterAuthWebAuth({ instance });
    expect(adapter.sessionClearCookie()).toContain('SameSite=None; Secure');
  });

  it('honors the __Secure- prefix better-auth applies on https deploys', () => {
    const { instance } = mockInstance({ options: { baseURL: 'https://factory.acme.com' } });
    const adapter = new BetterAuthWebAuth({ instance });
    expect(adapter.sessionClearCookie()).toMatch(/^__Secure-better-auth\.session_token=/);
  });

  it('honors a renamed session cookie via advanced.cookies.session_token.name', () => {
    const { instance } = mockInstance({
      options: { advanced: { cookies: { session_token: { name: 'acme_session' } } } },
    });
    const adapter = new BetterAuthWebAuth({ instance });
    expect(adapter.sessionClearCookie()).toMatch(/^acme_session=/);
  });
});

describe('public routes', () => {
  it('forwards /auth/api/* requests to the better-auth handler', async () => {
    const { instance, mocks } = mockInstance();
    const adapter = new BetterAuthWebAuth({ instance });
    const app = buildRouteApp(adapter);

    const res = await app.request('/auth/api/sign-in/email', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('better-auth handled');
    expect(mocks.handler).toHaveBeenCalledOnce();
  });

  it('/auth/login redirects to the SPA sign-in form, preserving returnTo', async () => {
    const { instance } = mockInstance();
    const app = buildRouteApp(new BetterAuthWebAuth({ instance }));

    const res = await app.request('/auth/login?returnTo=%2Ffactory%2Fboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/signin?returnTo=%2Ffactory%2Fboard');
  });

  it('/auth/login sanitizes external returnTo values', async () => {
    const { instance } = mockInstance();
    const app = buildRouteApp(new BetterAuthWebAuth({ instance }));

    const res = await app.request('/auth/login?returnTo=https%3A%2F%2Fevil.com');
    expect(res.headers.get('location')).toBe('/signin?returnTo=%2F');
  });

  it('/auth/logout revokes the session, forwards its cookies, clears ours, and redirects', async () => {
    const { instance, mocks } = mockInstance();
    mocks.api.signOut.mockResolvedValue(
      new Response(null, { status: 200, headers: { 'Set-Cookie': 'better-auth.session_token=; Max-Age=0' } }),
    );
    const app = buildRouteApp(new BetterAuthWebAuth({ instance }));

    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    const cookies = res.headers.getSetCookie();
    expect(cookies.some(c => c.includes('Max-Age=0'))).toBe(true);
    expect(mocks.api.signOut).toHaveBeenCalledOnce();
  });

  it('/auth/logout still clears the cookie when sign-out fails', async () => {
    const { instance, mocks } = mockInstance();
    mocks.api.signOut.mockRejectedValue(new Error('no session'));
    const app = buildRouteApp(new BetterAuthWebAuth({ instance }));

    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.getSetCookie().some(c => c.startsWith('better-auth.session_token=;'))).toBe(true);
  });
});

describe('/auth/me under better-auth', () => {
  it('reports the better-auth provider so the SPA renders the credential form', async () => {
    const { registerAuthRoutes } = await import('./auth.js');
    const { instance } = mockInstance();
    const app = new Hono();
    registerAuthRoutes(app, new BetterAuthWebAuth({ instance }));

    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false, user: null, provider: 'better-auth' });
  });

  it('surfaces signUpDisabled so the SPA hides the sign-up affordance', async () => {
    const { registerAuthRoutes } = await import('./auth.js');
    const { instance } = mockInstance();
    const app = new Hono();
    registerAuthRoutes(app, new BetterAuthWebAuth({ instance, signUpDisabled: true }));

    const res = await app.request('/auth/me');
    expect(await res.json()).toEqual({
      authenticated: false,
      user: null,
      provider: 'better-auth',
      signUpDisabled: true,
    });
  });
});
