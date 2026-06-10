import { createClerkClient } from '@clerk/backend';
import { verifyJwks } from '@mastra/auth';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthClerk } from './index';

// Mock the external dependencies
vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(),
}));

vi.mock('@mastra/auth', () => ({
  verifyJwks: vi.fn(),
}));

// Mock global fetch for SSO token exchange and userinfo
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MastraAuthClerk', () => {
  const mockOptions = {
    jwksUri: 'https://clerk.jwks.uri',
    secretKey: 'test-secret-key',
    // pk_test_ + base64("brief-amoeba-71.clerk.accounts.dev$")
    publishableKey: 'pk_test_YnJpZWYtYW1vZWJhLTcxLmNsZXJrLmFjY291bnRzLmRldiQ=',
  };

  const mockSSOOptions = {
    ...mockOptions,
    oauthClientId: 'test-oauth-client-id',
    oauthClientSecret: 'test-oauth-client-secret',
    session: {
      cookiePassword: 'a-very-long-cookie-password-that-is-at-least-32-chars',
    },
  };

  const mockClerkClient = {
    users: {
      getOrganizationMembershipList: vi.fn(),
      getUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClerkClient as any).mockReturnValue(mockClerkClient);
    mockFetch.mockReset();
  });

  describe('initialization', () => {
    it('should initialize with provided options', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect(auth).toBeInstanceOf(MastraAuthClerk);
      expect(createClerkClient).toHaveBeenCalledWith({
        secretKey: mockOptions.secretKey,
        publishableKey: mockOptions.publishableKey,
      });
    });

    it('should throw error when required options are missing', () => {
      expect(() => new MastraAuthClerk({})).toThrow('Clerk JWKS URI, secret key and publishable key are required');
    });

    it('should derive the correct FAPI URL from publishable key', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect(auth.getFapiUrl()).toBe('https://brief-amoeba-71.clerk.accounts.dev');
    });

    it('should not have SSO enabled without OAuth credentials', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect(auth.isSSOEnabled()).toBe(false);
    });

    it('should have SSO enabled with OAuth credentials', () => {
      const auth = new MastraAuthClerk(mockSSOOptions);
      expect(auth.isSSOEnabled()).toBe(true);
    });

    it('should throw when cookie password is too short for SSO', () => {
      expect(
        () =>
          new MastraAuthClerk({
            ...mockOptions,
            oauthClientId: 'test-id',
            oauthClientSecret: 'test-secret',
            session: { cookiePassword: 'short' },
          }),
      ).toThrow('Cookie password must be at least 32 characters');
    });
  });

  describe('authenticateToken', () => {
    it('should verify token and return user', async () => {
      const mockUser = { sub: 'user123', email: 'test@example.com' };
      (verifyJwks as any).mockResolvedValue(mockUser);

      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authenticateToken('test-token');

      expect(verifyJwks).toHaveBeenCalledWith('test-token', mockOptions.jwksUri);
      expect(result).toEqual(mockUser);
    });

    it('should return null when token verification fails', async () => {
      (verifyJwks as any).mockResolvedValue(null);

      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authenticateToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('authorizeUser', () => {
    it('should return false when user has no sub', async () => {
      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authorizeUser({ email: 'test@example.com' });

      expect(result).toBe(false);
    });

    it('should return true when user has valid sub', async () => {
      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authorizeUser({ sub: 'user123' });

      expect(result).toBe(true);
    });

    it('should return false when user sub is empty string', async () => {
      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authorizeUser({ sub: '' });

      expect(result).toBe(false);
    });

    it('should return false when user sub is undefined', async () => {
      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authorizeUser({ sub: undefined });

      expect(result).toBe(false);
    });
  });

  describe('custom authorization', () => {
    it('can be overridden with custom authorization logic', async () => {
      const clerk = new MastraAuthClerk({
        ...mockOptions,
        async authorizeUser(user: any): Promise<boolean> {
          return user?.permissions?.includes('admin') ?? false;
        },
      });

      const adminUser = { sub: 'user123', permissions: ['admin'] };
      expect(await clerk.authorizeUser(adminUser)).toBe(true);

      const regularUser = { sub: 'user456', permissions: ['read'] };
      expect(await clerk.authorizeUser(regularUser)).toBe(false);

      const noPermissionsUser = { sub: 'user789' };
      expect(await clerk.authorizeUser(noPermissionsUser)).toBe(false);
    });

    it('can use organization-based authorization when organizations are enabled', async () => {
      const mockOrgClerkClient = {
        users: {
          getOrganizationMembershipList: vi.fn(),
        },
      };
      (createClerkClient as any).mockReturnValue(mockOrgClerkClient);

      const clerk = new MastraAuthClerk({
        ...mockOptions,
        async authorizeUser(user: any): Promise<boolean> {
          if (!user.sub) return false;

          try {
            const orgs = await mockOrgClerkClient.users.getOrganizationMembershipList({
              userId: user.sub,
            });
            return orgs.data.length > 0;
          } catch {
            return true;
          }
        },
      });

      mockOrgClerkClient.users.getOrganizationMembershipList.mockResolvedValue({
        data: [{ id: 'org1' }],
      });
      const userWithOrg = { sub: 'user123' };
      expect(await clerk.authorizeUser(userWithOrg)).toBe(true);

      mockOrgClerkClient.users.getOrganizationMembershipList.mockResolvedValue({
        data: [],
      });
      const userWithoutOrg = { sub: 'user456' };
      expect(await clerk.authorizeUser(userWithoutOrg)).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user from Authorization header token', async () => {
      const mockPayload = { sub: 'user_123', email: 'test@example.com', name: 'Test User' };
      (verifyJwks as any).mockResolvedValue(mockPayload);

      const mockUserRecord = {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://img.clerk.com/avatar.png',
        publicMetadata: {},
      };
      mockClerkClient.users.getUser.mockResolvedValue(mockUserRecord);

      const auth = new MastraAuthClerk(mockOptions);
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer test-token' },
      });

      const user = await auth.getCurrentUser(request);

      expect(user).toEqual({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://img.clerk.com/avatar.png',
        metadata: {},
      });
    });

    it('should return null when no token is present', async () => {
      const auth = new MastraAuthClerk(mockOptions);
      const request = new Request('http://localhost');

      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });

    it('should return null when token verification fails', async () => {
      (verifyJwks as any).mockRejectedValue(new Error('Invalid token'));

      const auth = new MastraAuthClerk(mockOptions);
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer bad-token' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });

    it('should fall back to JWT claims when Clerk API fails', async () => {
      const mockPayload = { sub: 'user_123', email: 'test@example.com', name: 'Test User' };
      (verifyJwks as any).mockResolvedValue(mockPayload);
      mockClerkClient.users.getUser.mockRejectedValue(new Error('API error'));

      const auth = new MastraAuthClerk(mockOptions);
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer test-token' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toEqual({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should extract token from __session cookie', async () => {
      const mockPayload = { sub: 'user_123' };
      (verifyJwks as any).mockResolvedValue(mockPayload);
      mockClerkClient.users.getUser.mockRejectedValue(new Error('API error'));

      const auth = new MastraAuthClerk(mockOptions);
      const request = new Request('http://localhost', {
        headers: { Cookie: '__session=cookie-token; other=value' },
      });

      const user = await auth.getCurrentUser(request);
      expect(verifyJwks).toHaveBeenCalledWith('cookie-token', mockOptions.jwksUri);
      expect(user).toEqual({
        id: 'user_123',
        email: undefined,
        name: undefined,
      });
    });
  });

  describe('getUser', () => {
    it('should return user from Clerk API', async () => {
      const mockUserRecord = {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://img.clerk.com/avatar.png',
        publicMetadata: { role: 'admin' },
      };
      mockClerkClient.users.getUser.mockResolvedValue(mockUserRecord);

      const auth = new MastraAuthClerk(mockOptions);
      const user = await auth.getUser('user_123');

      expect(mockClerkClient.users.getUser).toHaveBeenCalledWith('user_123');
      expect(user).toEqual({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://img.clerk.com/avatar.png',
        metadata: { role: 'admin' },
      });
    });

    it('should return null when user is not found', async () => {
      mockClerkClient.users.getUser.mockRejectedValue(new Error('Not found'));

      const auth = new MastraAuthClerk(mockOptions);
      const user = await auth.getUser('nonexistent');

      expect(user).toBeNull();
    });
  });

  describe('route configuration options', () => {
    it('should store public routes configuration when provided', () => {
      const publicRoutes = ['/health', '/api/status'];
      const clerk = new MastraAuthClerk({
        ...mockOptions,
        public: publicRoutes,
      });

      expect(clerk.public).toEqual(publicRoutes);
    });

    it('should store protected routes configuration when provided', () => {
      const protectedRoutes = ['/api/*', '/admin/*'];
      const clerk = new MastraAuthClerk({
        ...mockOptions,
        protected: protectedRoutes,
      });

      expect(clerk.protected).toEqual(protectedRoutes);
    });

    it('should handle both public and protected routes together', () => {
      const publicRoutes = ['/health', '/api/status'];
      const protectedRoutes = ['/api/*', '/admin/*'];

      const clerk = new MastraAuthClerk({
        ...mockOptions,
        public: publicRoutes,
        protected: protectedRoutes,
      });

      expect(clerk.public).toEqual(publicRoutes);
      expect(clerk.protected).toEqual(protectedRoutes);
    });
  });

  // ============================================================================
  // SSO Tests (ISSOProvider + ISessionProvider)
  // ============================================================================

  describe('SSO - duck-typing detection', () => {
    it('should NOT have getLoginUrl when SSO is not configured', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect('getLoginUrl' in auth).toBe(false);
    });

    it('should have getLoginUrl when SSO is configured', () => {
      const auth = new MastraAuthClerk(mockSSOOptions);
      expect('getLoginUrl' in auth).toBe(true);
    });

    it('should NOT have handleCallback when SSO is not configured', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect('handleCallback' in auth).toBe(false);
    });

    it('should have handleCallback when SSO is configured', () => {
      const auth = new MastraAuthClerk(mockSSOOptions);
      expect('handleCallback' in auth).toBe(true);
    });

    it('should NOT have createSession when SSO is not configured', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect('createSession' in auth).toBe(false);
    });

    it('should have createSession when SSO is configured', () => {
      const auth = new MastraAuthClerk(mockSSOOptions);
      expect('createSession' in auth).toBe(true);
    });

    it('should NOT have getClearSessionHeaders when SSO is not configured', () => {
      const auth = new MastraAuthClerk(mockOptions);
      expect('getClearSessionHeaders' in auth).toBe(false);
    });

    it('should have getClearSessionHeaders when SSO is configured', () => {
      const auth = new MastraAuthClerk(mockSSOOptions);
      expect('getClearSessionHeaders' in auth).toBe(true);
    });
  });

  describe('SSO - getLoginUrl', () => {
    it('should generate correct Clerk OAuth authorize URL with signed state token', () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const url = auth.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'test-state-id');

      expect(url).toContain('https://brief-amoeba-71.clerk.accounts.dev/oauth/authorize');
      expect(url).toContain('client_id=test-oauth-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A4111%2Fapi%2Fauth%2Fsso%2Fcallback');
      // State is now a signed token (payload.signature format)
      const parsedUrl = new URL(url);
      const state = parsedUrl.searchParams.get('state');
      expect(state).toBeTruthy();
      expect(state!.split('.').length).toBe(2); // payload.signature format
    });

    it('should produce signed state that round-trips through handleCallback', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const redirectUri = 'http://localhost:4111/api/auth/sso/callback';
      const url = auth.getLoginUrl(redirectUri, 'test-uuid|%2Fstudio');
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
      // Mock verifyJwks for ID token verification
      (verifyJwks as any).mockResolvedValue({
        sub: 'clerk|user',
        email: 'test@example.com',
      });

      // handleCallback should not throw if state is valid
      const result = await auth.handleCallback('code', signedState);
      expect(result.user.id).toBe('clerk|user');
    });
  });

  describe('SSO - getLoginButtonConfig', () => {
    it('should return Clerk SSO config', () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const config = auth.getLoginButtonConfig();

      expect(config).toEqual({
        provider: 'clerk',
        text: 'Sign in with Clerk',
        description: 'Sign in using your Clerk account',
      });
    });
  });

  describe('SSO - handleCallback', () => {
    it('should throw on invalid state', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;

      await expect(auth.handleCallback('code123', 'invalid-state')).rejects.toThrow(
        'Invalid state token format',
      );
    });

    it('should throw on expired state', async () => {
      vi.useFakeTimers();
      try {
        const auth = new MastraAuthClerk(mockSSOOptions) as any;

        // Generate login URL which returns signed state token
        const loginUrl = auth.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'expired-state');
        const signedState = new URL(loginUrl).searchParams.get('state')!;

        // Advance time past state expiry (10 minutes + 1ms)
        vi.advanceTimersByTime(10 * 60 * 1000 + 1);

        await expect(auth.handleCallback('code123', signedState)).rejects.toThrow('State token has expired');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should exchange code for tokens and return user with session cookie', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'valid-state');
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

      // Mock verifyJwks for ID token verification
      (verifyJwks as any).mockResolvedValue({
        sub: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://img.clerk.com/avatar.png',
      });

      // Mock getUser for enrichment
      mockClerkClient.users.getUser.mockResolvedValue({
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://img.clerk.com/avatar.png',
        publicMetadata: { role: 'admin' },
      });

      const result = await auth.handleCallback('auth-code-123', signedState);

      // Verify token exchange was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://brief-amoeba-71.clerk.accounts.dev/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );

      // Verify user was returned
      expect(result.user).toEqual({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://img.clerk.com/avatar.png',
        metadata: { role: 'admin' },
      });

      // Verify tokens
      expect(result.tokens.accessToken).toBe('access-token-123');
      expect(result.tokens.refreshToken).toBe('refresh-token-123');
      expect(result.tokens.idToken).toBe('id-token-123');

      // Verify cookie was set
      expect(result.cookies).toHaveLength(1);
      expect(result.cookies[0]).toContain('clerk_session=');
      expect(result.cookies[0]).toContain('HttpOnly');
      expect(result.cookies[0]).toContain('SameSite=Lax');
    });

    it('should fall back to userinfo endpoint when no id_token', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'state-no-idtoken');
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
          sub: 'user_456',
          email: 'user@example.com',
          name: 'Another User',
          picture: 'https://img.clerk.com/avatar2.png',
        }),
      });

      // getUser enrichment fails
      mockClerkClient.users.getUser.mockRejectedValue(new Error('not found'));

      const result = await auth.handleCallback('code-456', signedState);

      expect(result.user.id).toBe('user_456');
      expect(result.user.email).toBe('user@example.com');

      // Verify userinfo was called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://brief-amoeba-71.clerk.accounts.dev/oauth/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer access-token-456' },
        }),
      );
    });

    it('should throw on failed token exchange', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;

      // Generate login URL which returns signed state token
      const loginUrl = auth.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'state-fail');
      const signedState = new URL(loginUrl).searchParams.get('state')!;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(auth.handleCallback('bad-code', signedState)).rejects.toThrow('Token exchange failed');
    });
  });

  describe('SSO - session management', () => {
    it('should create a session with correct expiry', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const session = await auth.createSession('user_123', { key: 'value' });

      expect(session.userId).toBe('user_123');
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.metadata).toEqual({ key: 'value' });
    });

    it('should return null for validateSession', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const result = await auth.validateSession('session-id');
      expect(result).toBeNull();
    });

    it('should return clear session headers', () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const headers = auth.getClearSessionHeaders();

      expect(headers['Set-Cookie']).toContain('clerk_session=');
      expect(headers['Set-Cookie']).toContain('Max-Age=0');
    });

    it('should extract session ID from request cookie', () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const request = new Request('http://localhost', {
        headers: { Cookie: 'clerk_session=encrypted-data; other=val' },
      });

      const sessionId = auth.getSessionIdFromRequest(request);
      expect(sessionId).toBe('encrypted-data');
    });

    it('should return null when no session cookie', () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const request = new Request('http://localhost');

      const sessionId = auth.getSessionIdFromRequest(request);
      expect(sessionId).toBeNull();
    });
  });

  describe('SSO - getLogoutUrl', () => {
    it('should return null (Clerk does not have OAuth logout URL)', async () => {
      const auth = new MastraAuthClerk(mockSSOOptions) as any;
      const result = await auth.getLogoutUrl('http://localhost');
      expect(result).toBeNull();
    });
  });

  describe('FAPI URL derivation', () => {
    it('should derive correct URL for test key', () => {
      const auth = new MastraAuthClerk({
        ...mockOptions,
        publishableKey: 'pk_test_YnJpZWYtYW1vZWJhLTcxLmNsZXJrLmFjY291bnRzLmRldiQ=',
      });
      expect(auth.getFapiUrl()).toBe('https://brief-amoeba-71.clerk.accounts.dev');
    });

    it('should derive correct URL for live key', () => {
      // Base64 of "clerk.example.com$" is "Y2xlcmsuZXhhbXBsZS5jb20k"
      const auth = new MastraAuthClerk({
        ...mockOptions,
        publishableKey: 'pk_live_Y2xlcmsuZXhhbXBsZS5jb20k',
      });
      expect(auth.getFapiUrl()).toBe('https://clerk.example.com');
    });
  });
});
