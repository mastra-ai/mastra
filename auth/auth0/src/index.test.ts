import { createRemoteJWKSet, jwtVerify } from 'jose';
import { beforeEach, afterEach, describe, expect, test, it, vi } from 'vitest';
import { MastraAuthAuth0 } from './index';

// Mock jose library
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

// Mock global fetch for SSO token exchange and userinfo
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MastraAuthAuth0', () => {
  const mockOptions = {
    domain: 'test-tenant.auth0.com',
    audience: 'https://test-api',
  };

  const mockSSOOptions = {
    ...mockOptions,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    session: {
      cookiePassword: 'a-very-long-cookie-password-that-is-at-least-32-chars',
    },
  };

  beforeEach(() => {
    process.env.AUTH0_DOMAIN = 'test-tenant.auth0.com';
    process.env.AUTH0_AUDIENCE = 'https://test-api';
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    delete process.env.AUTH0_COOKIE_PASSWORD;
  });

  describe('constructor', () => {
    test('initializes with environment variables', () => {
      const auth0 = new MastraAuthAuth0();
      expect(auth0['domain']).toBe('test-tenant.auth0.com');
      expect(auth0['audience']).toBe('https://test-api');
    });

    test('initializes with provided options', () => {
      const auth0 = new MastraAuthAuth0({
        domain: 'custom-domain.auth0.com',
        audience: 'custom-audience',
      });
      expect(auth0['domain']).toBe('custom-domain.auth0.com');
      expect(auth0['audience']).toBe('custom-audience');
    });

    test('throws error when domain is missing', () => {
      delete process.env.AUTH0_DOMAIN;
      expect(() => new MastraAuthAuth0()).toThrow();
    });

    test('throws error when audience is missing', () => {
      delete process.env.AUTH0_AUDIENCE;
      expect(() => new MastraAuthAuth0()).toThrow();
    });

    test('SSO is disabled without client credentials', () => {
      const auth0 = new MastraAuthAuth0(mockOptions);
      expect(auth0.isSSOEnabled()).toBe(false);
      // ISSOProvider methods should NOT be attached
      expect((auth0 as any).getLoginUrl).toBeUndefined();
      expect((auth0 as any).handleCallback).toBeUndefined();
    });

    test('SSO is enabled with client credentials', () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions);
      expect(auth0.isSSOEnabled()).toBe(true);
      // ISSOProvider methods should be attached
      expect((auth0 as any).getLoginUrl).toBeDefined();
      expect((auth0 as any).handleCallback).toBeDefined();
      expect((auth0 as any).getLoginButtonConfig).toBeDefined();
    });

    test('throws when cookie password too short for SSO', () => {
      expect(
        () =>
          new MastraAuthAuth0({
            ...mockOptions,
            clientId: 'id',
            clientSecret: 'secret',
            session: { cookiePassword: 'too-short' },
          }),
      ).toThrow('Cookie password must be at least 32 characters');
    });
  });

  describe('authenticateToken', () => {
    test('verifies JWT and returns payload', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'user123', permissions: ['read'] },
      });

      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authenticateToken('test-token');

      expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://test-tenant.auth0.com/.well-known/jwks.json'));
      expect(jwtVerify).toHaveBeenCalledWith('test-token', mockJWKS, {
        issuer: 'https://test-tenant.auth0.com/',
        audience: 'https://test-api',
      });
      expect(result).toEqual({ sub: 'user123', permissions: ['read'] });
    });

    test('handles JWT verification failure', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid token'));

      const auth0 = new MastraAuthAuth0();
      await expect(auth0.authenticateToken('invalid-token')).resolves.toBeNull();
    });

    test('returns null for empty token', async () => {
      const auth0 = new MastraAuthAuth0();
      await expect(auth0.authenticateToken('')).resolves.toBeNull();
    });
  });

  describe('authorizeUser', () => {
    test('returns true for valid user with sub', async () => {
      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authorizeUser({ sub: 'user123' });
      expect(result).toBe(true);
    });

    test('returns true for valid user with id (session user)', async () => {
      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authorizeUser({ id: 'user123' } as any);
      expect(result).toBe(true);
    });

    test('returns false for null/undefined user', async () => {
      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authorizeUser(null as any);
      expect(result).toBe(false);
    });

    test('returns false for expired token', async () => {
      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authorizeUser({
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });
      expect(result).toBe(false);
    });

    test('can be overridden with custom authorization logic', async () => {
      const auth0 = new MastraAuthAuth0({
        ...mockOptions,
        async authorizeUser(user: any): Promise<boolean> {
          return user?.permissions?.includes('admin') ?? false;
        },
      });

      const adminUser = { sub: 'user123', permissions: ['admin'] };
      expect(await auth0.authorizeUser(adminUser)).toBe(true);

      const regularUser = { sub: 'user456', permissions: ['read'] };
      expect(await auth0.authorizeUser(regularUser)).toBe(false);
    });
  });

  // =========================================================================
  // IUserProvider tests
  // =========================================================================

  describe('getCurrentUser', () => {
    test('returns user from Authorization header JWT', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: {
          sub: 'auth0|user123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://avatar.auth0.com/test.png',
        },
      });

      const auth0 = new MastraAuthAuth0(mockOptions);
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer valid-jwt-token' },
      });

      const user = await auth0.getCurrentUser(request);

      expect(user).toEqual({
        id: 'auth0|user123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://avatar.auth0.com/test.png',
      });
    });

    test('returns null with no token', async () => {
      const auth0 = new MastraAuthAuth0(mockOptions);
      const request = new Request('http://localhost');

      const user = await auth0.getCurrentUser(request);
      expect(user).toBeNull();
    });

    test('returns null on verification failure', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid token'));

      const auth0 = new MastraAuthAuth0(mockOptions);
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      const user = await auth0.getCurrentUser(request);
      expect(user).toBeNull();
    });
  });

  describe('getUser', () => {
    test('returns minimal user object', async () => {
      const auth0 = new MastraAuthAuth0(mockOptions);
      const user = await auth0.getUser('auth0|user123');

      expect(user).toEqual({ id: 'auth0|user123' });
    });
  });

  describe('getUserProfileUrl', () => {
    test('returns user profile URL', () => {
      const auth0 = new MastraAuthAuth0(mockOptions);
      const url = auth0.getUserProfileUrl({ id: 'auth0|user123' });
      expect(url).toBe('/user/auth0|user123');
    });
  });

  // =========================================================================
  // ISSOProvider tests
  // =========================================================================

  describe('SSO - getLoginUrl', () => {
    it('should build correct Auth0 OAuth URL with signed state token', () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const url = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'test-state');

      expect(url).toContain('https://test-tenant.auth0.com/authorize?');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A4111%2Fapi%2Fauth%2Fsso%2Fcallback');
      // State is now a signed JWT-like token (payload.signature format)
      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get('state');
      expect(state).toBeTruthy();
      expect(state!.split('.').length).toBe(2); // payload.signature format
    });

    it('should produce signed state that round-trips through handleCallback', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const redirectUri = 'http://localhost:4111/api/auth/sso/callback';
      const url = auth0.getLoginUrl(redirectUri, 'test-uuid|%2Fstudio');
      const signedState = new URL(url).searchParams.get('state')!;

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at',
          id_token: 'it',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'auth0|user', email: 'test@example.com' },
      });

      // handleCallback should not throw if state is valid
      const result = await auth0.handleCallback('code', signedState);
      expect(result.user.id).toBe('auth0|user');
    });
  });

  describe('SSO - getLoginButtonConfig', () => {
    it('should return Auth0 button config', () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const config = auth0.getLoginButtonConfig();

      expect(config.provider).toBe('auth0');
      expect(config.text).toBe('Sign in with Auth0');
      expect(config.description).toBe('Sign in using your Auth0 account');
    });
  });

  describe('SSO - handleCallback', () => {
    it('should throw on invalid state', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

      await expect(auth0.handleCallback('code123', 'invalid-state')).rejects.toThrow(
        'Invalid state token format',
      );
    });

    it('should throw on expired state', async () => {
      vi.useFakeTimers();
      try {
        const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

        // Generate login URL which returns signed state token
        const loginUrl = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'expired-state');
        const signedState = new URL(loginUrl).searchParams.get('state')!;

        // Advance time past state expiry (10 minutes + 1ms)
        vi.advanceTimersByTime(10 * 60 * 1000 + 1);

        await expect(auth0.handleCallback('code123', signedState)).rejects.toThrow('State token has expired');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should exchange code for tokens and return user with session cookie', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'valid-state');
      const signedState = new URL(loginUrl).searchParams.get('state')!;

      // Mock token exchange response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token-123',
          id_token: 'id-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });

      // Mock jwtVerify for ID token verification
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: {
          sub: 'auth0|user123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://avatar.auth0.com/test.png',
        },
      });

      const result = await auth0.handleCallback('auth-code-123', signedState);

      // Verify token exchange was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-tenant.auth0.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
            code: 'auth-code-123',
            redirect_uri: 'http://localhost:4111/api/auth/sso/callback',
          }),
        }),
      );

      // Verify user was returned
      expect(result.user).toEqual({
        id: 'auth0|user123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://avatar.auth0.com/test.png',
      });

      // Verify tokens
      expect(result.tokens.accessToken).toBe('access-token-123');
      expect(result.tokens.refreshToken).toBe('refresh-token-123');
      expect(result.tokens.idToken).toBe('id-token-123');

      // Verify cookie was set
      expect(result.cookies).toHaveLength(1);
      expect(result.cookies[0]).toContain('auth0_session=');
      expect(result.cookies[0]).toContain('HttpOnly');
      expect(result.cookies[0]).toContain('SameSite=Lax');
    });

    it('should fall back to userinfo endpoint when no id_token', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'state-no-idtoken');
      const signedState = new URL(loginUrl).searchParams.get('state')!;

      // Token exchange - no id_token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token-456',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });

      // Userinfo endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'auth0|user456',
          email: 'user@example.com',
          name: 'Another User',
          picture: 'https://avatar.auth0.com/test2.png',
        }),
      });

      const result = await auth0.handleCallback('code-456', signedState);

      expect(result.user.id).toBe('auth0|user456');
      expect(result.user.email).toBe('user@example.com');

      // Verify userinfo was called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://test-tenant.auth0.com/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer access-token-456' },
        }),
      );
    });

    it('should fall back to userinfo on id_token verification failure', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'state-idtoken-fail');
      const signedState = new URL(loginUrl).searchParams.get('state')!;

      // Token exchange - has id_token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token-789',
          id_token: 'bad-id-token',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });

      // ID token verification fails
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid ID token'));

      // Userinfo fallback
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'auth0|user789',
          email: 'fallback@example.com',
          name: 'Fallback User',
        }),
      });

      const result = await auth0.handleCallback('code-789', signedState);

      expect(result.user.id).toBe('auth0|user789');
      expect(result.user.email).toBe('fallback@example.com');
    });

    it('should throw on failed token exchange', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'state-fail');
      const signedState = new URL(loginUrl).searchParams.get('state')!;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(auth0.handleCallback('bad-code', signedState)).rejects.toThrow('Token exchange failed');
    });
  });

  // =========================================================================
  // ISessionProvider tests
  // =========================================================================

  describe('SSO - session management', () => {
    it('should create a session with correct expiry', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const session = await auth0.createSession('user123', { key: 'value' });

      expect(session.userId).toBe('user123');
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.metadata).toEqual({ key: 'value' });
    });

    it('should return null for validateSession', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const result = await auth0.validateSession('session-id');
      expect(result).toBeNull();
    });

    it('should return clear session headers', () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const headers = auth0.getClearSessionHeaders();

      expect(headers['Set-Cookie']).toContain('auth0_session=');
      expect(headers['Set-Cookie']).toContain('Max-Age=0');
    });

    it('should extract session ID from request cookie', () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const request = new Request('http://localhost', {
        headers: { Cookie: 'auth0_session=encrypted-data; other=val' },
      });

      const sessionId = auth0.getSessionIdFromRequest(request);
      expect(sessionId).toBe('encrypted-data');
    });

    it('should return null when no session cookie', () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const request = new Request('http://localhost');

      const sessionId = auth0.getSessionIdFromRequest(request);
      expect(sessionId).toBeNull();
    });
  });

  // =========================================================================
  // SSO - getLogoutUrl tests
  // =========================================================================

  describe('SSO - getLogoutUrl', () => {
    it('should return Auth0 logout URL with returnTo', async () => {
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;
      const url = await auth0.getLogoutUrl('http://localhost:4111');

      expect(url).toContain('https://test-tenant.auth0.com/v2/logout');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('returnTo=http%3A%2F%2Flocalhost%3A4111');
    });
  });

  // =========================================================================
  // SSO authenticateToken with session cookie
  // =========================================================================

  describe('authenticateToken with SSO session cookie', () => {
    it('should authenticate from session cookie when SSO enabled', async () => {
      // We need a real session cookie, so create one via handleCallback
      const auth0 = new MastraAuthAuth0(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth0.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'cookie-test-state');
      const signedState = new URL(loginUrl).searchParams.get('state')!;

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at',
          id_token: 'it',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });

      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: {
          sub: 'auth0|cookie-user',
          email: 'cookie@example.com',
          name: 'Cookie User',
        },
      });

      const callbackResult = await auth0.handleCallback('code', signedState);

      // Extract the cookie value from the set-cookie header
      const cookieHeader = callbackResult.cookies[0];
      const cookieValue = cookieHeader.split(';')[0]; // "auth0_session=..."

      // Now use that cookie in a request
      const request = new Request('http://localhost', {
        headers: { Cookie: cookieValue },
      });

      const user = await auth0.authenticateToken('', request);
      expect(user).toBeTruthy();
      expect((user as any).id).toBe('auth0|cookie-user');
    });

    it('should fall back to JWT when no session cookie', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'auth0|jwt-user' },
      });

      const auth0 = new MastraAuthAuth0(mockSSOOptions);
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer valid-jwt' },
      });

      const user = await auth0.authenticateToken('valid-jwt', request);
      expect(user).toEqual({ sub: 'auth0|jwt-user' });
    });
  });
});
