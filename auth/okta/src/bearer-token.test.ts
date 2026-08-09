/**
 * End-to-end bearer-token verification against a real JWKS endpoint.
 *
 * Unlike index.test.ts, this file does NOT mock `jose`. Tokens are really
 * signed and really verified, so the assertions describe what an Okta
 * deployment actually observes.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { MastraAuthOkta } from './auth-provider';

const CLIENT_ID = 'test-client-id';
const COOKIE_PASSWORD = 'test-cookie-password-must-be-32-chars-long';

let server: Server;
let orgUrl: string;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let jwksRequests = 0;

/**
 * Stand-in for an Okta org authorization server: issuer is the org root and
 * the JWKS lives under `/oauth2/v1/keys`.
 */
beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256', { extractable: true });
  privateKey = keyPair.privateKey;
  const publicJwk: JWK = { ...(await exportJWK(keyPair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

  server = createServer((req, res) => {
    if (req.url === '/oauth2/v1/keys' || req.url === '/oauth2/default/v1/keys') {
      jwksRequests++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  orgUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
});

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  jwksRequests = 0;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

/** The error text the provider logs when verification fails. */
function loggedVerificationError(): string {
  const call = consoleError.mock.calls.at(-1);
  return call ? String((call[1] as Error)?.message ?? call[1]) : '';
}

async function signToken(claims: { iss: string; aud: string; sub?: string }) {
  return new SignJWT({ email: 'user@example.com', name: 'Test User', groups: ['Engineering'] })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setSubject(claims.sub ?? '00u1234567890')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

function createProvider(issuer: string) {
  return new MastraAuthOkta({
    domain: '127.0.0.1',
    clientId: CLIENT_ID,
    clientSecret: 'test-client-secret',
    issuer,
    redirectUri: 'http://localhost:4111/api/auth/callback',
    session: { cookiePassword: COOKIE_PASSWORD },
  });
}

describe('bearer token on an Okta org authorization server', () => {
  test('rejects an access token, whose audience is the org URL', async () => {
    const auth = createProvider(orgUrl);

    // An org authorization server mints access tokens with `aud` set to the
    // org URL, not the client ID. There is no way to change that, so the
    // bearer path can never accept one.
    const accessToken = await signToken({ iss: orgUrl, aud: orgUrl });

    const user = await auth.authenticateToken(accessToken, new Request('http://localhost:4111/api/agents'));

    // The JWKS was fetched and the signature checked, so the audience is the
    // only reason this token is rejected.
    expect(jwksRequests).toBeGreaterThan(0);
    expect(user).toBeNull();
  });

  test('accepts an ID token, whose audience is the client ID', async () => {
    const auth = createProvider(orgUrl);
    const idToken = await signToken({ iss: orgUrl, aud: CLIENT_ID });

    const user = await auth.authenticateToken(idToken, new Request('http://localhost:4111/api/agents'));

    expect(user).not.toBeNull();
    expect(user?.oktaId).toBe('00u1234567890');
    expect(user?.email).toBe('user@example.com');
  });
});

describe('bearer token on a custom authorization server', () => {
  test('rejects an access token that still uses the default `api://default` audience', async () => {
    const issuer = `${orgUrl}/oauth2/default`;
    const auth = createProvider(issuer);

    const accessToken = await signToken({ iss: issuer, aud: 'api://default' });

    const user = await auth.authenticateToken(accessToken, new Request('http://localhost:4111/api/agents'));

    expect(user).toBeNull();
  });

  test('accepts an access token whose audience is reconfigured to the client ID', async () => {
    const issuer = `${orgUrl}/oauth2/default`;
    const auth = createProvider(issuer);
    const accessToken = await signToken({ iss: issuer, aud: CLIENT_ID });

    const user = await auth.authenticateToken(accessToken, new Request('http://localhost:4111/api/agents'));

    expect(user).not.toBeNull();
    expect(user?.oktaId).toBe('00u1234567890');
  });
});

describe('failure signature', () => {
  // The string asserted here is the one documented under Troubleshooting on
  // the Okta auth docs page. Keep the two in sync.
  test('an audience mismatch logs `unexpected "aud" claim value`', async () => {
    const auth = createProvider(orgUrl);
    const accessToken = await signToken({ iss: orgUrl, aud: orgUrl });

    await auth.authenticateToken(accessToken, new Request('http://localhost:4111/api/agents'));

    expect(loggedVerificationError()).toContain('unexpected "aud" claim value');
  });

  test('an issuer mismatch logs `unexpected "iss" claim value`', async () => {
    // Default issuer, pointed at an org authorization server that stamps the
    // org root into `iss`.
    const auth = createProvider(`${orgUrl}/oauth2/default`);
    const idToken = await signToken({ iss: orgUrl, aud: CLIENT_ID });

    await auth.authenticateToken(idToken, new Request('http://localhost:4111/api/agents'));

    expect(loggedVerificationError()).toContain('unexpected "iss" claim value');
  });
});
