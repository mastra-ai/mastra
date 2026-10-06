import { isSSOProvider, isSessionProvider, isUserProvider } from '@internal/auth/provider';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraAuthOidc } from './auth-provider';
import { mapOidcClaimsToUser } from './types';

const ISSUER = 'https://id.example.com/realms/acme';
const COOKIE_PASSWORD = 'oidc-cookie-password-must-be-at-least-32-chars';

/** Metadata that lets a provider be constructed without any network access. */
const SERVER_METADATA = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
  token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
  jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
};

function createSsoAuth(overrides: Record<string, unknown> = {}) {
  return new MastraAuthOidc({
    issuer: ISSUER,
    clientId: 'mastra',
    clientSecret: 'client-secret',
    serverMetadata: SERVER_METADATA,
    session: { cookiePassword: COOKIE_PASSWORD },
    ...overrides,
  }) as any;
}

describe('MastraAuthOidc', () => {
  afterEach(() => {
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
    delete process.env.OIDC_REDIRECT_URI;
    delete process.env.OIDC_AUDIENCE;
    delete process.env.OIDC_SCOPES;
    delete process.env.OIDC_COOKIE_PASSWORD;
  });

  describe('constructor', () => {
    it('reads configuration from environment variables', () => {
      process.env.OIDC_ISSUER = ISSUER;
      process.env.OIDC_CLIENT_ID = 'mastra';
      process.env.OIDC_SCOPES = 'openid, profile, groups';

      const auth = new MastraAuthOidc() as any;

      expect(auth.getIssuer()).toBe(ISSUER);
      expect(auth.getClientId()).toBe('mastra');
      expect(auth.scopes).toEqual(['openid', 'profile', 'groups']);
    });

    it('throws when the issuer is missing', () => {
      process.env.OIDC_CLIENT_ID = 'mastra';
      expect(() => new MastraAuthOidc()).toThrow('OIDC issuer is required');
    });

    it('throws when the client ID is missing', () => {
      process.env.OIDC_ISSUER = ISSUER;
      expect(() => new MastraAuthOidc()).toThrow('OIDC client ID is required');
    });

    it('attaches SSO methods only when a client secret is configured', () => {
      const tokenOnly = new MastraAuthOidc({ issuer: ISSUER, clientId: 'mastra' }) as any;
      expect(tokenOnly.isSSOEnabled()).toBe(false);
      expect(tokenOnly.getLoginUrl).toBeUndefined();
      expect(tokenOnly.handleCallback).toBeUndefined();
      expect(tokenOnly.createSession).toBeUndefined();

      const sso = createSsoAuth();
      expect(sso.isSSOEnabled()).toBe(true);
      expect(sso.getLoginUrl).toBeDefined();
      expect(sso.handleCallback).toBeDefined();
      expect(sso.createSession).toBeDefined();
    });

    it('is detected by the server capability guards only when SSO is enabled', () => {
      const tokenOnly = new MastraAuthOidc({ issuer: ISSUER, clientId: 'mastra' });
      expect(isUserProvider(tokenOnly)).toBe(true);
      expect(isSSOProvider(tokenOnly)).toBe(false);
      expect(isSessionProvider(tokenOnly)).toBe(false);

      const sso = createSsoAuth();
      expect(isUserProvider(sso)).toBe(true);
      expect(isSSOProvider(sso)).toBe(true);
      expect(isSessionProvider(sso)).toBe(true);
    });

    it('throws when the SSO cookie password is too short', () => {
      expect(() => createSsoAuth({ session: { cookiePassword: 'short' } })).toThrow(
        'Cookie password must be at least 32 characters',
      );
    });

    it('warns outside production when the SSO cookie password is missing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        createSsoAuth({ session: undefined });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('OIDC_COOKIE_PASSWORD is required'));
      } finally {
        warn.mockRestore();
      }
    });

    it('throws in production when the SSO cookie password is missing', () => {
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(() => createSsoAuth({ session: undefined })).toThrow('OIDC_COOKIE_PASSWORD is required');
      } finally {
        process.env.NODE_ENV = nodeEnv;
      }
    });
  });

  describe('session cookies', () => {
    it('clears the session cookie on logout', () => {
      expect(createSsoAuth().getClearSessionHeaders()['Set-Cookie']).toBe(
        'oidc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      );
    });

    it('marks cookies Secure when configured', () => {
      const auth = createSsoAuth({ session: { cookiePassword: COOKIE_PASSWORD, secureCookies: true } });
      expect(auth.getClearSessionHeaders()['Set-Cookie']).toContain('Secure');
    });

    it('reads the session id out of the cookie header', () => {
      const auth = createSsoAuth();
      const request = new Request('http://localhost', { headers: { Cookie: 'other=x; oidc_session=sealed-value' } });
      expect(auth.getSessionIdFromRequest(request)).toBe('sealed-value');
      expect(auth.getSessionIdFromRequest(new Request('http://localhost'))).toBeNull();
    });
  });

  describe('IUserProvider', () => {
    it('has no directory lookup, since OIDC defines none', async () => {
      const auth = new MastraAuthOidc({ issuer: ISSUER, clientId: 'mastra' });
      await expect(auth.getUser('user-1')).resolves.toBeNull();
    });

    it('builds a profile URL from the user id', () => {
      const auth = new MastraAuthOidc({ issuer: ISSUER, clientId: 'mastra' });
      expect(auth.getUserProfileUrl({ id: 'user-1', sub: 'user-1' })).toBe('/user/user-1');
    });
  });

  describe('ISessionProvider', () => {
    it('creates a session that expires after cookieMaxAge', async () => {
      const auth = createSsoAuth({ session: { cookiePassword: COOKIE_PASSWORD, cookieMaxAge: 120 } });
      const session = await auth.createSession('user-1', { tenant: 'acme' });

      expect(session).toMatchObject({ userId: 'user-1', metadata: { tenant: 'acme' } });
      expect(session.id).toEqual(expect.any(String));
      expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(120_000);
    });

    it('has no server-side session store to read, refresh, or write', async () => {
      const auth = createSsoAuth();

      // Sessions live entirely in the encrypted cookie, so these are no-ops.
      await expect(auth.validateSession('any-id')).resolves.toBeNull();
      await expect(auth.refreshSession('any-id')).resolves.toBeNull();
      await expect(auth.destroySession('any-id')).resolves.toBeUndefined();
      expect(auth.getSessionHeaders({})).toEqual({});
    });

    it('sets no extra cookies when starting a login', () => {
      expect(createSsoAuth().getLoginCookies()).toEqual([]);
    });
  });

  describe('getLoginButtonConfig', () => {
    it('uses the configured provider label', () => {
      expect(createSsoAuth({ label: 'Keycloak' }).getLoginButtonConfig()).toEqual({
        provider: 'oidc',
        text: 'Sign in with Keycloak',
        description: 'Sign in using your Keycloak account',
      });
    });

    it('falls back to a neutral label', () => {
      expect(createSsoAuth().getLoginButtonConfig().text).toBe('Sign in with SSO');
    });
  });

  describe('getLogoutUrl', () => {
    it('returns null when the provider has no end-session endpoint', async () => {
      await expect(createSsoAuth().getLogoutUrl('http://localhost:4111/')).resolves.toBeNull();
    });
  });

  describe('mapOidcClaimsToUser', () => {
    it('maps standard claims', () => {
      expect(
        mapOidcClaimsToUser({
          sub: 'user-1',
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          picture: 'https://example.com/ada.png',
          groups: ['engineering', 42],
        } as any),
      ).toMatchObject({
        id: 'user-1',
        sub: 'user-1',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        avatarUrl: 'https://example.com/ada.png',
        groups: ['engineering'],
      });
    });

    it('falls back through given/family name, preferred_username, then email', () => {
      expect(mapOidcClaimsToUser({ sub: 'u', given_name: 'Ada', family_name: 'Lovelace' }).name).toBe('Ada Lovelace');
      expect(mapOidcClaimsToUser({ sub: 'u', preferred_username: 'ada' }).name).toBe('ada');
      expect(mapOidcClaimsToUser({ sub: 'u', email: 'ada@example.com' }).name).toBe('ada@example.com');
      expect(mapOidcClaimsToUser({ sub: 'u' }).name).toBeUndefined();
    });
  });

  describe('authorizeUser', () => {
    it('rejects a user without an id', () => {
      const auth = new MastraAuthOidc({ issuer: ISSUER, clientId: 'mastra' });
      expect(auth.authorizeUser({ id: '', sub: '' })).toBe(false);
      expect(auth.authorizeUser({ id: 'user-1', sub: 'user-1' })).toBe(true);
    });

    it('honors a custom authorizeUser', async () => {
      const auth = new MastraAuthOidc({
        issuer: ISSUER,
        clientId: 'mastra',
        authorizeUser: user => user.groups?.includes('admins') ?? false,
      });

      expect(auth.authorizeUser({ id: 'u', sub: 'u', groups: ['admins'] })).toBe(true);
      expect(auth.authorizeUser({ id: 'u', sub: 'u' })).toBe(false);
    });
  });
});
