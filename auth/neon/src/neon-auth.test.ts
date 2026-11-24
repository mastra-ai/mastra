/**
 * End-to-end tests for @mastra/auth-neon.
 *
 * A running Mastra server (Hono adapter over an HTTP socket) is configured
 * with MastraAuthNeon and MastraRBACNeon and pointed at a Neon Auth instance.
 * The same scenarios run against:
 * - a local Neon Auth stand-in (always), modeled on recorded responses from a
 *   hosted Neon Auth project, and
 * - a live Neon Auth project when `NEON_AUTH_LIVE_BASE_URL` is set. Enable
 *   Neon Auth on a branch, keep email and password sign-in, sign-up, and
 *   "allow localhost" enabled, then run:
 *
 *     NEON_AUTH_LIVE_BASE_URL=https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth pnpm test
 *
 *   The live run signs up throwaway `@example.com` users in that project.
 */
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createAdaptorServer } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { SignJWT, generateKeyPair } from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { startNeonAuthTestServer } from './__tests__/neon-auth-server';
import type { NeonAuthTestServer } from './__tests__/neon-auth-server';
import { MastraAuthNeon, MastraRBACNeon } from './index';
import type { NeonAuthUser } from './index';

const SESSION_COOKIE = '__Secure-neon-auth.session_token';
const STUDIO_ORIGIN = 'http://localhost:4111';

interface Target {
  name: string;
  start(): Promise<{ baseUrl: string; close(): Promise<void> }>;
}

const targets: Target[] = [{ name: 'local Neon Auth server', start: startNeonAuthTestServer }];
if (process.env.NEON_AUTH_LIVE_BASE_URL) {
  targets.push({
    name: 'live Neon Auth project',
    start: async () => ({ baseUrl: process.env.NEON_AUTH_LIVE_BASE_URL!, close: async () => {} }),
  });
}

function newCredentials() {
  return {
    email: `mastra-auth-neon-${randomBytes(6).toString('hex')}@example.com`,
    password: `Pw-${randomBytes(12).toString('hex')}`,
  };
}

function sessionCookieFrom(response: Response): string | undefined {
  return response.headers
    .getSetCookie()
    .map(cookie => cookie.split(';')[0]!)
    .find(pair => pair.startsWith(`${SESSION_COOKIE}=`) && pair.length > SESSION_COOKIE.length + 1);
}

/** Direct calls to the Neon Auth HTTP API, the way an app frontend would make them. */
function neonAuthApi(baseUrl: string) {
  const json = { 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN };
  return {
    async signUp() {
      const credentials = newCredentials();
      const response = await fetch(`${baseUrl}/sign-up/email`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ ...credentials, name: 'Mastra Test' }),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { user: { id: string } };
      return { ...credentials, userId: body.user.id, cookie: sessionCookieFrom(response)! };
    },
    async createOrganization(cookie: string) {
      const response = await fetch(`${baseUrl}/organization/create`, {
        method: 'POST',
        headers: { ...json, Cookie: cookie },
        body: JSON.stringify({ name: 'Mastra Test Org', slug: `mastra-test-${randomBytes(6).toString('hex')}` }),
      });
      expect(response.status).toBe(200);
      return ((await response.json()) as { id: string }).id;
    },
    async jwt(cookie: string) {
      const response = await fetch(`${baseUrl}/token`, { headers: { Cookie: cookie } });
      expect(response.status).toBe(200);
      return ((await response.json()) as { token: string }).token;
    },
    async getSession(cookie: string) {
      const response = await fetch(`${baseUrl}/get-session`, { headers: { Cookie: cookie } });
      return response.json();
    },
  };
}

async function startMastra(options: { auth: MastraAuthNeon; rbac?: MastraRBACNeon }) {
  const whoami = registerApiRoute('/whoami', {
    method: 'GET',
    handler: async c => {
      const user = c.get('requestContext').get('mastra__user') as NeonAuthUser;
      return c.json({ id: user.user.id, email: user.user.email, viaJwt: !!user.jwt });
    },
  });
  const mastra = new Mastra({
    logger: false,
    server: { auth: options.auth, rbac: options.rbac, apiRoutes: [whoami] },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra, customApiRoutes: [whoami] }).init();

  const server = createAdaptorServer({ fetch: app.fetch });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
    signIn: (email: string, password: string) =>
      fetch(`${url}/api/auth/credentials/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN, 'User-Agent': 'mastra-auth-neon-test' },
        body: JSON.stringify({ email, password }),
      }),
  };
}

describe.each(targets)('Neon Auth with a Mastra server ($name)', target => {
  let neon: { baseUrl: string; close(): Promise<void> };
  let api: ReturnType<typeof neonAuthApi>;
  const servers: { close(): Promise<void> }[] = [];

  beforeAll(async () => {
    neon = await target.start();
    api = neonAuthApi(neon.baseUrl);
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(s => s.close()));
  });

  afterAll(async () => {
    await neon.close();
  });

  async function mastraServer(rbac?: MastraRBACNeon, authOptions: { signUpEnabled?: boolean } = {}) {
    const server = await startMastra({ auth: new MastraAuthNeon({ baseUrl: neon.baseUrl, ...authOptions }), rbac });
    servers.push(server);
    return server;
  }

  it('lets a Studio user sign in with email and password and use the API with the session cookie', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();

    const signIn = await mastra.signIn(user.email, user.password);
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as { user: { id: string; email: string } };
    expect(body.user).toMatchObject({ id: user.userId, email: user.email });

    // Studio sends only the cookie Mastra forwarded from Neon Auth.
    const cookie = sessionCookieFrom(signIn);
    expect(cookie).toBeDefined();

    const whoami = await fetch(`${mastra.url}/whoami`, { headers: { Cookie: `theme=dark; ${cookie}` } });
    expect(whoami.status).toBe(200);
    await expect(whoami.json()).resolves.toEqual({ id: user.userId, email: user.email, viaJwt: false });

    const me = await fetch(`${mastra.url}/api/auth/me`, { headers: { Cookie: cookie! } });
    await expect(me.json()).resolves.toMatchObject({ id: user.userId, email: user.email });
  });

  it('returns a bearer token from sign-in that API clients can use', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();

    const signIn = await mastra.signIn(user.email, user.password);
    const { token } = (await signIn.json()) as { token?: string };
    expect(token?.split('.')).toHaveLength(3);

    const whoami = await fetch(`${mastra.url}/whoami`, { headers: { Authorization: `Bearer ${token}` } });
    expect(whoami.status).toBe(200);
    await expect(whoami.json()).resolves.toEqual({ id: user.userId, email: user.email, viaJwt: true });
  });

  it('accepts a Neon Auth JWT from the frontend SDK as a bearer token', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();
    const jwt = await api.jwt(user.cookie);

    const agents = await fetch(`${mastra.url}/api/agents`, { headers: { Authorization: `Bearer ${jwt}` } });
    expect(agents.status).toBe(200);
  });

  it('accepts the session cookie value sent as a bearer token', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();
    const cookieValue = user.cookie.slice(SESSION_COOKIE.length + 1);

    const whoami = await fetch(`${mastra.url}/whoami`, { headers: { Authorization: `Bearer ${cookieValue}` } });
    expect(whoami.status).toBe(200);
    await expect(whoami.json()).resolves.toMatchObject({ id: user.userId, viaJwt: false });
  });

  it('rejects requests without credentials, with forged JWTs, and with unsigned session tokens', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();

    expect((await fetch(`${mastra.url}/api/agents`)).status).toBe(401);

    const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const issuer = new URL(neon.baseUrl).origin;
    const forged = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'forged' })
      .setSubject(user.userId)
      .setIssuer(issuer)
      .setAudience(issuer)
      .setExpirationTime('5m')
      .sign(privateKey);
    expect((await fetch(`${mastra.url}/api/agents`, { headers: { Authorization: `Bearer ${forged}` } })).status).toBe(
      401,
    );

    const cookieValue = user.cookie.slice(SESSION_COOKIE.length + 1);
    const unsigned = cookieValue.slice(0, cookieValue.lastIndexOf('.'));
    expect(
      (await fetch(`${mastra.url}/api/agents`, { headers: { Cookie: `${SESSION_COOKIE}=${unsigned}` } })).status,
    ).toBe(401);
  });

  it('rejects a wrong password without setting a session cookie', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();

    const signIn = await mastra.signIn(user.email, 'not-the-password');
    expect(signIn.status).toBe(401);
    expect(sessionCookieFrom(signIn)).toBeUndefined();
  });

  it('signs up a new user through Mastra and signs them in', async () => {
    const mastra = await mastraServer();
    const credentials = newCredentials();

    const signUp = await fetch(`${mastra.url}/api/auth/credentials/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN },
      body: JSON.stringify({ ...credentials, name: 'New Mastra User' }),
    });
    expect(signUp.status).toBe(200);
    const cookie = sessionCookieFrom(signUp);

    const whoami = await fetch(`${mastra.url}/whoami`, { headers: { Cookie: cookie! } });
    await expect(whoami.json()).resolves.toMatchObject({ email: credentials.email });
  });

  it('does not create accounts through the API when sign-up is disabled', async () => {
    const mastra = await mastraServer(undefined, { signUpEnabled: false });
    const credentials = newCredentials();

    const signUp = await fetch(`${mastra.url}/api/auth/credentials/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN },
      body: JSON.stringify({ ...credentials, name: 'Blocked User' }),
    });
    expect(signUp.ok).toBe(false);
    expect(sessionCookieFrom(signUp)).toBeUndefined();

    // No Neon Auth account was created.
    expect((await mastra.signIn(credentials.email, credentials.password)).status).toBe(401);
  });

  it('falls back to the session cookie when a stored JWT is no longer valid', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();
    const jwt = await api.jwt(user.cookie);
    const [header, payload] = jwt.split('.');
    const tampered = `${header}.${payload}.${'A'.repeat(86)}`;

    const whoami = await fetch(`${mastra.url}/whoami`, {
      headers: { Authorization: `Bearer ${tampered}`, Cookie: user.cookie },
    });
    expect(whoami.status).toBe(200);
    await expect(whoami.json()).resolves.toMatchObject({ id: user.userId, viaJwt: false });

    // Without a cookie, the invalid JWT is still rejected.
    expect((await fetch(`${mastra.url}/whoami`, { headers: { Authorization: `Bearer ${tampered}` } })).status).toBe(
      401,
    );
  });

  it('revokes the Neon Auth session when the user logs out', async () => {
    const user = await api.signUp();
    const mastra = await mastraServer();
    const cookie = sessionCookieFrom(await mastra.signIn(user.email, user.password))!;

    const logout = await fetch(`${mastra.url}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: STUDIO_ORIGIN },
    });
    expect(logout.status).toBe(200);
    // The browser can only drop a partitioned __Secure- cookie when the clearing cookie repeats those attributes.
    expect(logout.headers.getSetCookie()).toContain(
      `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`,
    );

    // A copied cookie no longer works anywhere.
    await expect(api.getSession(cookie)).resolves.toBeNull();
    expect((await fetch(`${mastra.url}/api/agents`, { headers: { Cookie: cookie } })).status).toBe(401);
  });

  describe('with MastraRBACNeon', () => {
    const roleMapping = { owner: ['*'], member: ['agents:read'], user: [], _default: [] };

    it('grants permissions from the role in the active organization', async () => {
      const owner = await api.signUp();
      await api.createOrganization(owner.cookie);
      const mastra = await mastraServer(new MastraRBACNeon({ baseUrl: neon.baseUrl, roleMapping }));

      const agents = await fetch(`${mastra.url}/api/agents`, { headers: { Cookie: owner.cookie } });
      expect(agents.status).toBe(200);

      // Studio reads roles and permissions from /auth/me.
      const me = await fetch(`${mastra.url}/api/auth/me`, { headers: { Cookie: owner.cookie } });
      await expect(me.json()).resolves.toMatchObject({ roles: ['owner'], permissions: ['*'] });
    });

    it('denies a user who is not a member of the configured organization', async () => {
      const owner = await api.signUp();
      const organizationId = await api.createOrganization(owner.cookie);
      const outsider = await api.signUp();
      const rbac = new MastraRBACNeon({ baseUrl: neon.baseUrl, roleMapping, organizationId });
      const mastra = await mastraServer(rbac);

      expect((await fetch(`${mastra.url}/api/agents`, { headers: { Cookie: owner.cookie } })).status).toBe(200);
      expect((await fetch(`${mastra.url}/api/agents`, { headers: { Cookie: outsider.cookie } })).status).toBe(403);
    });

    it('does not treat the JWT `authenticated` role claim as a Mastra role', async () => {
      const owner = await api.signUp();
      await api.createOrganization(owner.cookie);
      const jwt = await api.jwt(owner.cookie);
      const mastra = await mastraServer(
        new MastraRBACNeon({ baseUrl: neon.baseUrl, roleMapping: { ...roleMapping, authenticated: ['*'] } }),
      );

      expect((await fetch(`${mastra.url}/api/agents`, { headers: { Authorization: `Bearer ${jwt}` } })).status).toBe(
        403,
      );
    });

    it('uses getUserRoles for bearer JWT requests', async () => {
      const user = await api.signUp();
      const jwt = await api.jwt(user.cookie);
      const rbac = new MastraRBACNeon({
        baseUrl: neon.baseUrl,
        roleMapping,
        getUserRoles: u => (u.user.id === user.userId ? ['member'] : []),
      });
      const mastra = await mastraServer(rbac);

      expect((await fetch(`${mastra.url}/api/agents`, { headers: { Authorization: `Bearer ${jwt}` } })).status).toBe(
        200,
      );
    });
  });
});

describe('MastraAuthNeon configuration', () => {
  const base = 'https://ep-example.neonauth.us-east-2.aws.neon.tech/neondb/auth';

  afterEach(() => {
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_JWKS_URL;
  });

  it('derives the JWKS URL and JWT issuer from the Neon Auth URL', () => {
    const auth = new MastraAuthNeon({ baseUrl: `${base}/` });
    expect(auth.getBaseUrl()).toBe(base);
    expect(auth['jwksUrl']).toBe(`${base}/.well-known/jwks.json`);
    expect(auth['issuer']).toBe('https://ep-example.neonauth.us-east-2.aws.neon.tech');
    expect(auth.sessionCookieName).toBe(SESSION_COOKIE);
  });

  it('reads NEON_AUTH_BASE_URL and NEON_AUTH_JWKS_URL', () => {
    process.env.NEON_AUTH_BASE_URL = base;
    process.env.NEON_AUTH_JWKS_URL = 'https://keys.example.com/jwks.json';
    const auth = new MastraAuthNeon();
    expect(auth.getBaseUrl()).toBe(base);
    expect(auth['jwksUrl']).toBe('https://keys.example.com/jwks.json');
  });

  it('throws a clear error when no Neon Auth URL is configured', () => {
    expect(() => new MastraAuthNeon()).toThrow('Neon Auth base URL is required');
  });
});
