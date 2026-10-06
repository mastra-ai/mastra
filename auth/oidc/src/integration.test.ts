/**
 * End-to-end tests against a real OpenID Provider served over HTTP.
 *
 * Nothing is mocked: discovery, PKCE, JWKS retrieval, signature verification,
 * the token exchange, and the session cookie round-trip all run for real
 * against a local server signing tokens with a generated RSA key.
 */

import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT, base64url, exportJWK, generateKeyPair } from 'jose';
import type { JWK } from 'jose';
import { calculatePKCECodeChallenge } from 'openid-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraAuthOidc } from './auth-provider';

const COOKIE_PASSWORD = 'integration-cookie-password-at-least-32-chars';
const CLIENT_ID = 'mastra';
const CLIENT_SECRET = 'super-secret';
const REDIRECT_URI = 'http://localhost:4111/api/auth/sso/callback';
/** Mirrors the `uuid|encodedRedirect` state the Mastra server generates. */
const SERVER_STATE = 'state-uuid|%2Fagents';

let server: Server;
let issuer: string;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let publicJwk: JWK;

/** Last token request body the provider received, for assertions. */
let lastTokenRequest: URLSearchParams | undefined;
/** Claims the provider puts in the next ID token it issues. */
let idTokenClaims: Record<string, unknown> = {};
/** Lets a test drop `code_challenge_methods_supported` from discovery. */
let advertisePKCE = true;
/** Authorization codes already redeemed, so replays can be rejected. */
let usedCodes = new Set<string>();
/** Lets a test reshape the provider's token response. */
let tokenResponseOverride: ((body: Record<string, unknown>) => Record<string, unknown>) | undefined;

/**
 * Validate an HTTP Basic `Authorization` header the way a spec-compliant
 * provider does: the credentials are form-urlencoded before base64 encoding
 * (RFC 6749 section 2.3.1), so they must be decoded again before comparing.
 */
function checkBasicAuth(header: string | undefined): boolean {
  if (!header?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const formUrlDecode = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '));
  return (
    formUrlDecode(decoded.slice(0, separator)) === CLIENT_ID &&
    formUrlDecode(decoded.slice(separator + 1)) === CLIENT_SECRET
  );
}

async function signToken(claims: Record<string, unknown>, audience: string, expiresIn = '5m') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256', { extractable: true });
  privateKey = keyPair.privateKey;
  publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

  server = createServer((req, res) => {
    const url = new URL(req.url!, issuer);
    const json = (body: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/.well-known/openid-configuration') {
      return json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        end_session_endpoint: `${issuer}/logout`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
        ...(advertisePKCE ? { code_challenge_methods_supported: ['S256'] } : {}),
      });
    }

    if (url.pathname === '/jwks') {
      return json({ keys: [publicJwk] });
    }

    if (url.pathname === '/token') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        const params = new URLSearchParams(body);
        lastTokenRequest = params;

        // Accept the credentials from either the body (client_secret_post) or
        // the Authorization header (client_secret_basic).
        const authenticated =
          checkBasicAuth(req.headers.authorization) ||
          (params.get('client_id') === CLIENT_ID && params.get('client_secret') === CLIENT_SECRET);
        if (!authenticated) {
          return json({ error: 'invalid_client' }, 401);
        }
        // Authorization codes are single use, as a real provider enforces.
        if (params.get('code') !== 'auth-code' || usedCodes.has(params.get('code')!)) {
          return json({ error: 'invalid_grant' }, 400);
        }
        usedCodes.add(params.get('code')!);

        void signToken(idTokenClaims, CLIENT_ID).then(idToken => {
          const base = { access_token: 'access-token', id_token: idToken, token_type: 'Bearer', expires_in: 300 };
          json(tokenResponseOverride ? tokenResponseOverride({ ...base }) : base);
        });
      });
      return;
    }

    return json({ error: 'not_found' }, 404);
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

beforeEach(() => {
  advertisePKCE = true;
  lastTokenRequest = undefined;
  idTokenClaims = {};
  usedCodes = new Set();
  tokenResponseOverride = undefined;
});

function createAuth(overrides: Record<string, unknown> = {}) {
  return new MastraAuthOidc({
    issuer,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    allowInsecureRequests: true,
    session: { cookiePassword: COOKIE_PASSWORD },
    ...overrides,
  }) as any;
}

/**
 * Run the login redirect and set up the ID token the provider will return.
 * Returns the `stateId` the Mastra server would hand to `handleCallback`.
 */
async function startLogin(auth: any, claims: Record<string, unknown> = {}, state = SERVER_STATE) {
  const loginUrl = new URL(await auth.getLoginUrl(REDIRECT_URI, state));
  const nonce = loginUrl.searchParams.get('nonce')!;
  idTokenClaims = { sub: 'user-42', nonce, ...claims };
  // The Mastra server splits the state on `|` and forwards only the first part.
  return { loginUrl, nonce, stateId: loginUrl.searchParams.get('state')!.split('|')[0]! };
}

describe('MastraAuthOidc against a live OpenID Provider', () => {
  it('completes the login flow and authenticates the resulting session cookie', async () => {
    const auth = createAuth();
    const { loginUrl, stateId } = await startLogin(auth, {
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada Lovelace',
      picture: 'https://example.com/ada.png',
      groups: ['engineering'],
    });

    expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(`${issuer}/authorize`);
    expect(loginUrl.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(loginUrl.searchParams.get('response_type')).toBe('code');
    expect(loginUrl.searchParams.get('scope')).toBe('openid profile email');
    expect(loginUrl.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    // The server's post-login redirect suffix survives the round trip.
    expect(loginUrl.searchParams.get('state')!.endsWith('|%2Fagents')).toBe(true);

    const result = await auth.handleCallback('auth-code', stateId);

    expect(lastTokenRequest?.get('grant_type')).toBe('authorization_code');
    expect(lastTokenRequest?.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(result.user).toMatchObject({
      id: 'user-42',
      sub: 'user-42',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
      groups: ['engineering'],
    });
    expect(result.tokens.accessToken).toBe('access-token');

    // The session cookie authenticates later requests on its own.
    const cookie = result.cookies[0].split(';')[0];
    expect(result.cookies[0]).toContain('HttpOnly');
    const request = new Request('http://localhost:4111/api/agents', { headers: { Cookie: cookie } });

    await expect(auth.authenticateToken('', request)).resolves.toMatchObject({ id: 'user-42' });
    await expect(auth.getCurrentUser(request)).resolves.toMatchObject({ email: 'ada@example.com' });
    expect(auth.authorizeUser(await auth.getCurrentUser(request))).toBe(true);

    // Logout points at the provider with the ID token hint from the session.
    const logoutUrl = new URL(await auth.getLogoutUrl('http://localhost:4111/', request));
    expect(`${logoutUrl.origin}${logoutUrl.pathname}`).toBe(`${issuer}/logout`);
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:4111/');
    expect(logoutUrl.searchParams.get('id_token_hint')).toBeTruthy();
  });

  it('builds a logout URL with no hint when there is no session', async () => {
    const auth = createAuth();
    const logoutUrl = new URL(await auth.getLogoutUrl('http://localhost:4111/'));

    expect(`${logoutUrl.origin}${logoutUrl.pathname}`).toBe(`${issuer}/logout`);
    expect(logoutUrl.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(logoutUrl.searchParams.get('id_token_hint')).toBeNull();
  });

  it('sends PKCE when the provider advertises S256', async () => {
    const auth = createAuth();
    const { loginUrl, stateId } = await startLogin(auth);

    const challenge = loginUrl.searchParams.get('code_challenge');
    expect(challenge).toBeTruthy();
    expect(loginUrl.searchParams.get('code_challenge_method')).toBe('S256');

    await auth.handleCallback('auth-code', stateId);

    const verifier = lastTokenRequest?.get('code_verifier');
    expect(verifier).toBeTruthy();
    await expect(calculatePKCECodeChallenge(verifier!)).resolves.toBe(challenge);
  });

  it('omits PKCE when the provider does not advertise it', async () => {
    advertisePKCE = false;
    const auth = createAuth();
    const { loginUrl, stateId } = await startLogin(auth);

    expect(loginUrl.searchParams.get('code_challenge')).toBeNull();

    await auth.handleCallback('auth-code', stateId);
    expect(lastTokenRequest?.get('code_verifier')).toBeNull();
  });

  it('authenticates with client_secret_basic when configured', async () => {
    const auth = createAuth({ tokenEndpointAuthMethod: 'client_secret_basic' });
    const { stateId } = await startLogin(auth);

    await auth.handleCallback('auth-code', stateId);

    // Basic auth moves the credentials out of the body and into the header.
    expect(lastTokenRequest?.get('client_secret')).toBeNull();
  });

  it('skips discovery when server metadata is supplied', async () => {
    const auth = createAuth({
      issuer: 'https://unreachable.invalid',
      serverMetadata: {
        issuer: 'https://unreachable.invalid',
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
      },
    });

    const loginUrl = new URL(await auth.getLoginUrl(REDIRECT_URI, SERVER_STATE));
    expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(`${issuer}/authorize`);
  });

  it('rejects a malformed state', async () => {
    const auth = createAuth();
    await expect(auth.handleCallback('auth-code', 'not-a-state')).rejects.toThrow();
  });

  it('rejects a state sealed with a different cookie password', async () => {
    const { stateId } = await startLogin(createAuth());
    const other = createAuth({ session: { cookiePassword: `other-${COOKIE_PASSWORD}` } });

    await expect(other.handleCallback('auth-code', stateId)).rejects.toThrow();
  });

  it('rejects a swapped post-login redirect suffix', async () => {
    const auth = createAuth();
    const { stateId } = await startLogin(auth);

    await expect(auth.handleCallback('auth-code', `${stateId}|%2F%2Fevil.example.com`)).rejects.toThrow(
      'Invalid state redirect suffix',
    );
  });

  it('rejects an ID token whose nonce does not match', async () => {
    const auth = createAuth();
    const { stateId } = await startLogin(auth, { nonce: 'wrong-nonce' });

    await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow();
  });

  it('surfaces token endpoint errors', async () => {
    const auth = createAuth();
    const { stateId } = await startLogin(auth);

    await expect(auth.handleCallback('wrong-code', stateId)).rejects.toThrow();
  });

  it('verifies a real Bearer token signed by the provider', async () => {
    const auth = new MastraAuthOidc({ issuer, clientId: CLIENT_ID, allowInsecureRequests: true });
    const token = await signToken({ sub: 'user-7', email: 'grace@example.com' }, CLIENT_ID);

    await expect(auth.authenticateToken(token, new Request('http://localhost'))).resolves.toMatchObject({
      id: 'user-7',
      email: 'grace@example.com',
    });
  });

  it('verifies Bearer tokens against the issuer from supplied server metadata', async () => {
    const auth = new MastraAuthOidc({
      // Deliberately different from the metadata: the resolved metadata wins.
      issuer: 'https://configured-elsewhere.invalid',
      clientId: CLIENT_ID,
      allowInsecureRequests: true,
      serverMetadata: {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
      },
    });
    const token = await signToken({ sub: 'user-9' }, CLIENT_ID);

    await expect(auth.authenticateToken(token, new Request('http://localhost'))).resolves.toMatchObject({
      id: 'user-9',
    });
  });

  it('rejects a token signed for a different audience', async () => {
    const auth = new MastraAuthOidc({ issuer, clientId: CLIENT_ID, allowInsecureRequests: true });
    const token = await signToken({ sub: 'user-7' }, 'some-other-api');

    await expect(auth.authenticateToken(token, new Request('http://localhost'))).resolves.toBeNull();
  });

  it('accepts an access token once its audience is configured', async () => {
    const auth = new MastraAuthOidc({
      issuer,
      clientId: CLIENT_ID,
      audience: ['mastra', 'api://mastra'],
      allowInsecureRequests: true,
    });
    const token = await signToken({ sub: 'user-7' }, 'api://mastra');

    await expect(auth.authenticateToken(token, new Request('http://localhost'))).resolves.toMatchObject({
      id: 'user-7',
    });
  });

  it('rejects an expired token', async () => {
    const auth = new MastraAuthOidc({ issuer, clientId: CLIENT_ID, allowInsecureRequests: true });
    const token = await signToken({ sub: 'user-7' }, CLIENT_ID, '-1s');

    await expect(auth.authenticateToken(token, new Request('http://localhost'))).resolves.toBeNull();
  });

  it('ignores a tampered session cookie', async () => {
    const auth = createAuth();
    const request = new Request('http://localhost', { headers: { Cookie: 'oidc_session=not-a-real-token' } });

    await expect(auth.authenticateToken('', request)).resolves.toBeNull();
  });

  describe('token signature attacks', () => {
    /** A token the provider never signed must never authenticate a request. */
    async function expectRejected(token: string) {
      const auth = new MastraAuthOidc({ issuer, clientId: CLIENT_ID, allowInsecureRequests: true });
      await expect(auth.authenticateToken(token, new Request('http://localhost'))).resolves.toBeNull();
    }

    it('rejects an unsigned token (alg: none)', async () => {
      const part = (value: unknown) => base64url.encode(new TextEncoder().encode(JSON.stringify(value)));
      const claims = { iss: issuer, aud: CLIENT_ID, sub: 'attacker', exp: Math.floor(Date.now() / 1000) + 300 };

      await expectRejected(`${part({ alg: 'none', kid: 'test-key' })}.${part(claims)}.`);
    });

    it('rejects an HMAC token signed with the public key (algorithm confusion)', async () => {
      const token = await new SignJWT({ sub: 'attacker' })
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(CLIENT_ID)
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode(publicJwk.n));

      await expectRejected(token);
    });

    it('rejects a token signed by a key that is not in the JWKS', async () => {
      const attacker = await generateKeyPair('RS256', { extractable: true });
      const token = await new SignJWT({ sub: 'attacker' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(CLIENT_ID)
        .setExpirationTime('5m')
        .sign(attacker.privateKey);

      await expectRejected(token);
    });

    it('rejects a token from a different issuer', async () => {
      const token = await new SignJWT({ sub: 'attacker' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer('https://evil.example.com')
        .setAudience(CLIENT_ID)
        .setExpirationTime('5m')
        .sign(privateKey);

      await expectRejected(token);
    });

    it('rejects a token with no subject', async () => {
      await expectRejected(await signToken({ email: 'nobody@example.com' }, CLIENT_ID));
    });

    it('refuses to verify Bearer tokens when the provider publishes no JWKS', async () => {
      const auth = new MastraAuthOidc({
        issuer,
        clientId: CLIENT_ID,
        allowInsecureRequests: true,
        serverMetadata: {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
        },
      });

      // Without a JWKS there is no way to check a signature, so nothing passes.
      await expect(
        auth.authenticateToken(await signToken({ sub: 'user-1' }, CLIENT_ID), new Request('http://localhost')),
      ).resolves.toBeNull();
    });
  });

  describe('session cookie handling', () => {
    /** Log in and return the `Cookie` header value for the new session. */
    async function login(auth: any) {
      const { stateId } = await startLogin(auth);
      const { cookies } = await auth.handleCallback('auth-code', stateId);
      return { cookie: cookies[0].split(';')[0] as string, setCookie: cookies[0] as string };
    }

    it('sets the expected cookie attributes', async () => {
      const auth = createAuth({ session: { cookiePassword: COOKIE_PASSWORD, secureCookies: true } });
      const { setCookie } = await login(auth);

      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain(`Max-Age=${86400}`);
    });

    it('rejects a session cookie sealed with another password', async () => {
      const { cookie } = await login(createAuth());
      const other = createAuth({ session: { cookiePassword: `other-${COOKIE_PASSWORD}` } });
      const request = new Request('http://localhost', { headers: { Cookie: cookie } });

      await expect(other.authenticateToken('', request)).resolves.toBeNull();
    });

    it('rejects a session cookie replayed as OAuth state', async () => {
      const auth = createAuth();
      const { cookie } = await login(auth);
      const sealedSession = cookie.slice('oidc_session='.length);

      // Must fail the purpose check while unsealing, not later on a malformed
      // field, so the two token types can never be swapped for one another.
      await expect(auth.handleCallback('auth-code', sealedSession)).rejects.toThrow('aud');
    });

    it('rejects an expired session cookie', async () => {
      const auth = createAuth({ session: { cookiePassword: COOKIE_PASSWORD, cookieMaxAge: 60 } });
      const { cookie } = await login(auth);
      const request = new Request('http://localhost', { headers: { Cookie: cookie } });

      await expect(auth.authenticateToken('', request)).resolves.toMatchObject({ id: 'user-42' });

      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(Date.now() + 61_000);
        await expect(auth.authenticateToken('', request)).resolves.toBeNull();
        await expect(auth.getCurrentUser(request)).resolves.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('prefers a valid session cookie over a Bearer token from elsewhere', async () => {
      const auth = createAuth();
      const { cookie } = await login(auth);
      const attacker = await generateKeyPair('RS256', { extractable: true });
      const forged = await new SignJWT({ sub: 'attacker' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(CLIENT_ID)
        .setExpirationTime('5m')
        .sign(attacker.privateKey);

      const request = new Request('http://localhost', {
        headers: { Cookie: cookie, Authorization: `Bearer ${forged}` },
      });

      await expect(auth.authenticateToken(forged, request)).resolves.toMatchObject({ id: 'user-42' });
    });

    it('picks the right cookie when similarly named ones are present', async () => {
      const auth = createAuth();
      const { cookie } = await login(auth);
      const request = new Request('http://localhost', {
        headers: { Cookie: `not_oidc_session=evil; oidc_session_backup=evil; ${cookie}; other=x` },
      });

      await expect(auth.authenticateToken('', request)).resolves.toMatchObject({ id: 'user-42' });
    });

    it('ignores a request with no cookie at all', async () => {
      const auth = createAuth();
      await expect(auth.authenticateToken('', new Request('http://localhost'))).resolves.toBeNull();
      await expect(auth.getCurrentUser(new Request('http://localhost'))).resolves.toBeNull();
    });
  });

  describe('getCurrentUser without SSO', () => {
    const bearerOnly = () => new MastraAuthOidc({ issuer, clientId: CLIENT_ID, allowInsecureRequests: true });

    it('resolves the user from a Bearer token', async () => {
      const token = await signToken({ sub: 'user-7', email: 'grace@example.com' }, CLIENT_ID);
      const request = new Request('http://localhost', { headers: { Authorization: `Bearer ${token}` } });

      await expect(bearerOnly().getCurrentUser(request)).resolves.toMatchObject({ id: 'user-7' });
    });

    it('returns null for a missing or empty Authorization header', async () => {
      const auth = bearerOnly();

      await expect(auth.getCurrentUser(new Request('http://localhost'))).resolves.toBeNull();
      await expect(
        auth.getCurrentUser(new Request('http://localhost', { headers: { Authorization: 'Bearer    ' } })),
      ).resolves.toBeNull();
    });

    it('reuses the JWKS across requests', async () => {
      const auth = bearerOnly();
      const token = await signToken({ sub: 'user-7' }, CLIENT_ID);
      const request = () => new Request('http://localhost', { headers: { Authorization: `Bearer ${token}` } });

      await expect(auth.getCurrentUser(request())).resolves.toMatchObject({ id: 'user-7' });
      await expect(auth.getCurrentUser(request())).resolves.toMatchObject({ id: 'user-7' });
    });
  });

  describe('OAuth state handling', () => {
    it('rejects an expired state token', async () => {
      const auth = createAuth();
      const { stateId } = await startLogin(auth);

      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        // The state is good for 10 minutes.
        vi.setSystemTime(Date.now() + 11 * 60 * 1000);
        await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow();
      } finally {
        vi.useRealTimers();
      }
    });

    it('rejects a replayed authorization code', async () => {
      const auth = createAuth();
      const { stateId } = await startLogin(auth);

      await expect(auth.handleCallback('auth-code', stateId)).resolves.toBeDefined();
      // The provider burns the code, so replaying the same state and code fails.
      await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow();
    });

    it('rejects a state token issued by a different provider instance', async () => {
      const { stateId } = await startLogin(createAuth());
      const other = createAuth({ session: { cookiePassword: `other-${COOKIE_PASSWORD}` } });

      await expect(other.handleCallback('auth-code', stateId)).rejects.toThrow();
    });

    it('rejects an ID token with no nonce', async () => {
      const auth = createAuth();
      const { stateId } = await startLogin(auth);
      idTokenClaims = { sub: 'user-42' };

      await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow();
    });

    it('rejects a login when a custom mapClaims yields no subject', async () => {
      const auth = createAuth({ mapClaims: () => ({ id: '', sub: '' }) });
      const { stateId } = await startLogin(auth);

      await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow('missing a subject');
    });

    it('rejects a token response with no ID token', async () => {
      const auth = createAuth();
      const { stateId } = await startLogin(auth);
      tokenResponseOverride = body => {
        delete body.id_token;
        return body;
      };

      await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow();
    });

    it('omits the token expiry when the provider sends no expires_in', async () => {
      const auth = createAuth();
      const { stateId } = await startLogin(auth);
      tokenResponseOverride = body => {
        delete body.expires_in;
        return body;
      };

      const result = await auth.handleCallback('auth-code', stateId);
      expect(result.tokens.expiresAt).toBeUndefined();
      // The cookie lifetime is independent of the access token lifetime.
      expect(result.cookies[0]).toContain('Max-Age=86400');
    });

    it('sends no client credentials when the auth method is none', async () => {
      const auth = createAuth({ tokenEndpointAuthMethod: 'none' });
      const { stateId } = await startLogin(auth);

      // The provider is a confidential client, so it rejects the public-client call.
      await expect(auth.handleCallback('auth-code', stateId)).rejects.toThrow();
      expect(lastTokenRequest?.get('client_id')).toBe(CLIENT_ID);
      expect(lastTokenRequest?.get('client_secret')).toBeNull();
    });

    it('throws when no redirect URI is available', async () => {
      const auth = createAuth({ redirectUri: undefined });
      delete process.env.OIDC_REDIRECT_URI;

      await expect(auth.getLoginUrl(undefined as unknown as string, SERVER_STATE)).rejects.toThrow(
        'Redirect URI is required',
      );
    });
  });

  it('retries discovery after a failure', async () => {
    const auth = createAuth({ issuer: 'http://127.0.0.1:1/unreachable' });
    await expect(auth.getConfig()).rejects.toThrow();

    // The failed attempt is not cached, so a working provider still resolves.
    const working = createAuth();
    await expect(working.getConfig()).resolves.toBeDefined();
  });
});
