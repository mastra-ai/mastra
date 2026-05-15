import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastraAuthSupabase } from './index';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('MastraAuthSupabase', () => {
  const mockSupabaseUrl = 'https://test.supabase.co';
  const mockSupabaseAnonKey = 'test-anon-key';
  const mockServiceRoleKey = 'test-service-role-key';
  const mockCookiePassword = 'this-is-a-test-password-with-32-chars!!';
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: '',
    aud: '',
    role: '',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' },
  };

  let authProvider: MastraAuthSupabase;
  let mockSupabaseClient: any;
  let mockAdminClient: any;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules();
    savedEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_COOKIE_PASSWORD: process.env.SUPABASE_COOKIE_PASSWORD,
    };
    process.env.SUPABASE_URL = mockSupabaseUrl;
    process.env.SUPABASE_ANON_KEY = mockSupabaseAnonKey;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_COOKIE_PASSWORD;

    // Setup mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        admin: {
          getUserById: vi.fn(),
        },
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockAdminClient = {
      auth: {
        admin: {
          getUserById: vi.fn(),
        },
      },
    };

    (createClient as any).mockImplementation((url: string, key: string) => {
      if (key === mockServiceRoleKey) return mockAdminClient;
      return mockSupabaseClient;
    });

    authProvider = new MastraAuthSupabase();
  });

  afterEach(() => {
    Object.entries(savedEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  describe('constructor', () => {
    it('should create instance with environment variables', () => {
      expect(createClient).toHaveBeenCalledWith(mockSupabaseUrl, mockSupabaseAnonKey);
    });

    it('should create instance with provided options', () => {
      const customUrl = 'https://custom.supabase.co';
      const customKey = 'custom-key';
      new MastraAuthSupabase({ url: customUrl, anonKey: customKey });
      expect(createClient).toHaveBeenCalledWith(customUrl, customKey);
    });

    it('should throw error when required credentials are missing', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      expect(() => new MastraAuthSupabase()).toThrow('Supabase URL and anon key are required');
    });

    it('should throw error when cookie password is too short', () => {
      expect(
        () =>
          new MastraAuthSupabase({
            session: { cookiePassword: 'short' },
          }),
      ).toThrow('SUPABASE_COOKIE_PASSWORD must be at least 32 characters');
    });

    it('should create admin client when service role key is provided', () => {
      new MastraAuthSupabase({ serviceRoleKey: mockServiceRoleKey });
      expect(createClient).toHaveBeenCalledWith(mockSupabaseUrl, mockServiceRoleKey);
    });
  });

  describe('authenticateToken', () => {
    it('should return user when token is valid', async () => {
      const mockToken = 'valid-token';
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await authProvider.authenticateToken(mockToken, {} as any);
      expect(result).toEqual(mockUser);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(mockToken);
    });

    it('should return null when token is invalid', async () => {
      const mockToken = 'invalid-token';
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      const result = await authProvider.authenticateToken(mockToken, {} as any);
      expect(result).toBeNull();
    });

    it('should return null for empty token', async () => {
      const result = await authProvider.authenticateToken('', {} as any);
      expect(result).toBeNull();
    });
  });

  describe('authorizeUser', () => {
    it('should return true for admin users', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { isAdmin: true },
        error: null,
      });

      const result = await authProvider.authorizeUser(mockUser);
      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('isAdmin');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockUser.id);
    });

    it('should return true when users table does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: new Error('relation "users" does not exist'),
      });

      const result = await authProvider.authorizeUser(mockUser);
      expect(result).toBe(true);
    });

    it('should return false for non-admin users', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { isAdmin: false },
        error: null,
      });

      const result = await authProvider.authorizeUser(mockUser);
      expect(result).toBe(false);
    });
  });

  describe('IUserProvider', () => {
    describe('getCurrentUser', () => {
      it('should extract token from Authorization header and return EEUser', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const request = new Request('http://localhost:4111/api/auth/me', {
          headers: { Authorization: 'Bearer valid-token' },
        });

        const getCurrentUser = (authProvider as any).getCurrentUser.bind(authProvider);
        const result = await getCurrentUser(request);

        expect(result).toEqual({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
          metadata: {
            full_name: 'Test User',
            avatar_url: 'https://example.com/avatar.png',
            provider: 'email',
          },
        });
      });

      it('should return null when no token is present', async () => {
        const request = new Request('http://localhost:4111/api/auth/me');

        const getCurrentUser = (authProvider as any).getCurrentUser.bind(authProvider);
        const result = await getCurrentUser(request);

        expect(result).toBeNull();
      });

      it('should return null on verification failure', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid token'),
        });

        const request = new Request('http://localhost:4111/api/auth/me', {
          headers: { Authorization: 'Bearer bad-token' },
        });

        const getCurrentUser = (authProvider as any).getCurrentUser.bind(authProvider);
        const result = await getCurrentUser(request);

        expect(result).toBeNull();
      });
    });

    describe('getUser', () => {
      it('should return user from users table when no admin client', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.png',
          },
          error: null,
        });

        const getUser = (authProvider as any).getUser.bind(authProvider);
        const result = await getUser('test-user-id');

        expect(result).toEqual({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
        });
      });

      it('should use admin client when service role key is available', async () => {
        const adminProvider = new MastraAuthSupabase({ serviceRoleKey: mockServiceRoleKey });

        mockAdminClient.auth.admin.getUserById.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const getUser = (adminProvider as any).getUser.bind(adminProvider);
        const result = await getUser('test-user-id');

        expect(result).toEqual({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
          metadata: {
            full_name: 'Test User',
            avatar_url: 'https://example.com/avatar.png',
            provider: 'email',
          },
        });
        expect(mockAdminClient.auth.admin.getUserById).toHaveBeenCalledWith('test-user-id');
      });

      it('should return null when user not found', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        });

        const getUser = (authProvider as any).getUser.bind(authProvider);
        const result = await getUser('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getUserProfileUrl', () => {
      it('should return profile URL', () => {
        const getUserProfileUrl = (authProvider as any).getUserProfileUrl.bind(authProvider);
        const result = getUserProfileUrl({ id: 'user-123' });
        expect(result).toBe('/user/user-123');
      });
    });
  });

  describe('ICredentialsProvider', () => {
    let credProvider: MastraAuthSupabase;

    beforeEach(() => {
      credProvider = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
      });
    });

    describe('signIn', () => {
      it('should sign in with email and password', async () => {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: {
            user: mockUser,
            session: {
              access_token: 'access-token-123',
              refresh_token: 'refresh-token-123',
            },
          },
          error: null,
        });

        const signIn = (credProvider as any).signIn.bind(credProvider);
        const request = new Request('http://localhost:4111/api/auth/credentials/sign-in');
        const result = await signIn('test@example.com', 'password123', request);

        expect(result.user).toEqual({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
          metadata: {
            full_name: 'Test User',
            avatar_url: 'https://example.com/avatar.png',
            provider: 'email',
          },
        });
        expect(result.token).toBe('access-token-123');
        expect(result.cookies).toHaveLength(1);
        expect(result.cookies![0]).toContain('supabase_session=');
        expect(result.cookies![0]).toContain('HttpOnly');
        expect(result.cookies![0]).toContain('SameSite=Lax');
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      it('should throw on invalid credentials', async () => {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        });

        const signIn = (credProvider as any).signIn.bind(credProvider);
        const request = new Request('http://localhost:4111/api/auth/credentials/sign-in');

        await expect(signIn('test@example.com', 'wrong-password', request)).rejects.toThrow(
          'Invalid login credentials',
        );
      });
    });

    describe('signUp', () => {
      it('should sign up with email, password, and name', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: {
            user: mockUser,
            session: {
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
            },
          },
          error: null,
        });

        const signUp = (credProvider as any).signUp.bind(credProvider);
        const request = new Request('http://localhost:4111/api/auth/credentials/sign-up');
        const result = await signUp('test@example.com', 'password123', 'Test User', request);

        expect(result.user.email).toBe('test@example.com');
        expect(result.token).toBe('new-access-token');
        expect(result.cookies).toHaveLength(1);
        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: { data: { full_name: 'Test User', name: 'Test User' } },
        });
      });

      it('should handle sign up without name', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: {
            user: mockUser,
            session: {
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
            },
          },
          error: null,
        });

        const signUp = (credProvider as any).signUp.bind(credProvider);
        const request = new Request('http://localhost:4111/api/auth/credentials/sign-up');
        await signUp('test@example.com', 'password123', undefined, request);

        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: undefined,
        });
      });

      it('should handle sign up requiring email confirmation (no session)', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: {
            user: mockUser,
            session: null,
          },
          error: null,
        });

        const signUp = (credProvider as any).signUp.bind(credProvider);
        const request = new Request('http://localhost:4111/api/auth/credentials/sign-up');
        const result = await signUp('test@example.com', 'password123', undefined, request);

        expect(result.user).toBeDefined();
        expect(result.token).toBeUndefined();
        expect(result.cookies).toBeUndefined();
      });

      it('should throw on sign up failure', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'User already exists' },
        });

        const signUp = (credProvider as any).signUp.bind(credProvider);
        const request = new Request('http://localhost:4111/api/auth/credentials/sign-up');

        await expect(signUp('test@example.com', 'password123', undefined, request)).rejects.toThrow(
          'User already exists',
        );
      });
    });

    describe('isSignUpEnabled', () => {
      it('should return true by default', () => {
        const isSignUpEnabled = (credProvider as any).isSignUpEnabled.bind(credProvider);
        expect(isSignUpEnabled()).toBe(true);
      });

      it('should return false when disabled', () => {
        const noSignUp = new MastraAuthSupabase({
          enableSignUp: false,
          session: { cookiePassword: mockCookiePassword },
        });
        const isSignUpEnabled = (noSignUp as any).isSignUpEnabled.bind(noSignUp);
        expect(isSignUpEnabled()).toBe(false);
      });
    });
  });

  describe('ISessionProvider', () => {
    let sessionProvider: MastraAuthSupabase;

    beforeEach(() => {
      sessionProvider = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
      });
    });

    describe('createSession', () => {
      it('should create a session with userId', async () => {
        const createSession = (sessionProvider as any).createSession.bind(sessionProvider);
        const session = await createSession('user-123');

        expect(session.id).toBeDefined();
        expect(session.userId).toBe('user-123');
        expect(session.createdAt).toBeInstanceOf(Date);
        expect(session.expiresAt).toBeInstanceOf(Date);
        expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
      });

      it('should include metadata when provided', async () => {
        const createSession = (sessionProvider as any).createSession.bind(sessionProvider);
        const session = await createSession('user-123', { role: 'admin' });

        expect(session.metadata).toEqual({ role: 'admin' });
      });
    });

    describe('getSessionIdFromRequest', () => {
      it('should extract session cookie from request', () => {
        const request = new Request('http://localhost:4111/api/agents', {
          headers: { Cookie: 'supabase_session=encrypted-value; other=foo' },
        });

        const getSessionIdFromRequest = (sessionProvider as any).getSessionIdFromRequest.bind(sessionProvider);
        const result = getSessionIdFromRequest(request);

        expect(result).toBe('encrypted-value');
      });

      it('should return null when no session cookie exists', () => {
        const request = new Request('http://localhost:4111/api/agents', {
          headers: { Cookie: 'other=foo' },
        });

        const getSessionIdFromRequest = (sessionProvider as any).getSessionIdFromRequest.bind(sessionProvider);
        const result = getSessionIdFromRequest(request);

        expect(result).toBeNull();
      });

      it('should return null when no cookies exist', () => {
        const request = new Request('http://localhost:4111/api/agents');

        const getSessionIdFromRequest = (sessionProvider as any).getSessionIdFromRequest.bind(sessionProvider);
        const result = getSessionIdFromRequest(request);

        expect(result).toBeNull();
      });
    });

    describe('getClearSessionHeaders', () => {
      it('should return header that clears the session cookie', () => {
        const getClearSessionHeaders = (sessionProvider as any).getClearSessionHeaders.bind(sessionProvider);
        const headers = getClearSessionHeaders();

        expect(headers['Set-Cookie']).toContain('supabase_session=');
        expect(headers['Set-Cookie']).toContain('Max-Age=0');
        expect(headers['Set-Cookie']).toContain('HttpOnly');
        expect(headers['Set-Cookie']).toContain('SameSite=Lax');
      });
    });

    describe('validateSession', () => {
      it('should return null (cookie-based validation)', async () => {
        const validateSession = (sessionProvider as any).validateSession.bind(sessionProvider);
        const result = await validateSession('session-id');
        expect(result).toBeNull();
      });
    });

    describe('destroySession', () => {
      it('should resolve without error', async () => {
        const destroySession = (sessionProvider as any).destroySession.bind(sessionProvider);
        await expect(destroySession('session-id')).resolves.toBeUndefined();
      });
    });

    describe('refreshSession', () => {
      it('should return null (cookie-based refresh)', async () => {
        const refreshSession = (sessionProvider as any).refreshSession.bind(sessionProvider);
        const result = await refreshSession('session-id');
        expect(result).toBeNull();
      });
    });
  });

  describe('session cookie integration', () => {
    let cookieProvider: MastraAuthSupabase;

    beforeEach(() => {
      cookieProvider = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
      });
    });

    it('should authenticate from session cookie after sign-in', async () => {
      // Step 1: Sign in to get a session cookie
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
          },
        },
        error: null,
      });

      const signIn = (cookieProvider as any).signIn.bind(cookieProvider);
      const signInRequest = new Request('http://localhost:4111/api/auth/credentials/sign-in');
      const signInResult = await signIn('test@example.com', 'password123', signInRequest);

      // Step 2: Extract the cookie value
      const cookie = signInResult.cookies![0];
      const cookieNameValue = cookie.split(';')[0]; // "supabase_session=..."

      // Step 3: Use the cookie in a subsequent request
      const apiRequest = new Request('http://localhost:4111/api/agents', {
        headers: { Cookie: cookieNameValue },
      });

      const getCurrentUser = (cookieProvider as any).getCurrentUser.bind(cookieProvider);
      const user = await getCurrentUser(apiRequest);

      expect(user).not.toBeNull();
      expect(user.id).toBe('test-user-id');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should return null for expired session cookie', async () => {
      // Create a provider with very short max age
      const shortLivedProvider = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword, cookieMaxAge: -1 },
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
          },
        },
        error: null,
      });

      const signIn = (shortLivedProvider as any).signIn.bind(shortLivedProvider);
      const signInRequest = new Request('http://localhost:4111/api/auth/credentials/sign-in');
      const signInResult = await signIn('test@example.com', 'password123', signInRequest);

      const cookie = signInResult.cookies![0];
      const cookieNameValue = cookie.split(';')[0];

      const apiRequest = new Request('http://localhost:4111/api/agents', {
        headers: { Cookie: cookieNameValue },
      });

      const getCurrentUser = (shortLivedProvider as any).getCurrentUser.bind(shortLivedProvider);
      const user = await getCurrentUser(apiRequest);

      expect(user).toBeNull();
    });

    it('should return null for invalid session cookie', async () => {
      const apiRequest = new Request('http://localhost:4111/api/agents', {
        headers: { Cookie: 'supabase_session=invalid-encrypted-data' },
      });

      const getCurrentUser = (cookieProvider as any).getCurrentUser.bind(cookieProvider);
      const user = await getCurrentUser(apiRequest);

      expect(user).toBeNull();
    });
  });

  describe('duck-typing safety', () => {
    it('should not have credentials methods without cookie password', () => {
      const basic = new MastraAuthSupabase();
      expect((basic as any).signIn).toBeUndefined();
      expect((basic as any).signUp).toBeUndefined();
      expect((basic as any).isSignUpEnabled).toBeUndefined();
    });

    it('should have credentials methods with cookie password', () => {
      const withCreds = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
      });
      expect((withCreds as any).signIn).toBeDefined();
      expect((withCreds as any).signUp).toBeDefined();
      expect((withCreds as any).isSignUpEnabled).toBeDefined();
    });

    it('should always have user provider methods', () => {
      const basic = new MastraAuthSupabase();
      expect((basic as any).getCurrentUser).toBeDefined();
      expect((basic as any).getUser).toBeDefined();
      expect((basic as any).getUserProfileUrl).toBeDefined();
    });

    it('should not have session methods without cookie password', () => {
      const basic = new MastraAuthSupabase();
      expect((basic as any).createSession).toBeUndefined();
      expect((basic as any).getClearSessionHeaders).toBeUndefined();
    });

    it('should have session methods with cookie password', () => {
      const withSession = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
      });
      expect((withSession as any).createSession).toBeDefined();
      expect((withSession as any).getClearSessionHeaders).toBeDefined();
      expect((withSession as any).getSessionIdFromRequest).toBeDefined();
    });
  });

  describe('ISSOProvider (OAuth 2.1 Server)', () => {
    const mockOauthClientId = 'test-oauth-client-id';
    const mockOauthClientSecret = 'test-oauth-client-secret';
    let ssoProvider: MastraAuthSupabase;

    beforeEach(() => {
      ssoProvider = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
        sso: {
          oauthClientId: mockOauthClientId,
          oauthClientSecret: mockOauthClientSecret,
        },
      });
    });

    it('should attach SSO methods when OAuth credentials are provided', () => {
      expect((ssoProvider as any).getLoginUrl).toBeDefined();
      expect((ssoProvider as any).handleCallback).toBeDefined();
      expect((ssoProvider as any).getLoginButtonConfig).toBeDefined();
      expect((ssoProvider as any).getLogoutUrl).toBeDefined();
    });

    it('should not attach SSO methods when OAuth credentials are missing', () => {
      const noSso = new MastraAuthSupabase({
        session: { cookiePassword: mockCookiePassword },
      });
      expect((noSso as any).getLoginUrl).toBeUndefined();
      expect((noSso as any).handleCallback).toBeUndefined();
    });

    it('should not attach SSO methods without cookie password', () => {
      const noCookie = new MastraAuthSupabase({
        sso: {
          oauthClientId: mockOauthClientId,
          oauthClientSecret: mockOauthClientSecret,
        },
      });
      expect((noCookie as any).getLoginUrl).toBeUndefined();
    });

    describe('getLoginUrl', () => {
      it('should build OAuth authorize URL with correct params', () => {
        const url = (ssoProvider as any).getLoginUrl(
          'http://localhost:4111/api/auth/sso/callback',
          'test-state-id|/studio',
        );
        const parsed = new URL(url);
        expect(parsed.origin).toBe(mockSupabaseUrl);
        expect(parsed.pathname).toBe('/auth/v1/oauth/authorize');
        expect(parsed.searchParams.get('client_id')).toBe(mockOauthClientId);
        expect(parsed.searchParams.get('response_type')).toBe('code');
        expect(parsed.searchParams.get('scope')).toBe('openid email profile');
        expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:4111/api/auth/sso/callback');
        expect(parsed.searchParams.get('state')).toBe('test-state-id|/studio');
      });

      it('should use custom scopes when configured', () => {
        const customScopes = new MastraAuthSupabase({
          session: { cookiePassword: mockCookiePassword },
          sso: {
            oauthClientId: mockOauthClientId,
            oauthClientSecret: mockOauthClientSecret,
            oauthScopes: 'openid email',
          },
        });
        const url = (customScopes as any).getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'state-123');
        const parsed = new URL(url);
        expect(parsed.searchParams.get('scope')).toBe('openid email');
      });

      it('should throw when redirectUri is missing', () => {
        expect(() => (ssoProvider as any).getLoginUrl('', 'state-123')).toThrow('Redirect URI is required for SSO');
      });
    });

    describe('handleCallback', () => {
      it('should exchange code for tokens and return user', async () => {
        // First call getLoginUrl to set up state
        (ssoProvider as any).getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'callback-state');

        // Mock fetch for token exchange + userinfo
        const originalFetch = global.fetch;
        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              access_token: 'test-access-token',
              id_token:
                'header.' +
                btoa(
                  JSON.stringify({
                    sub: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                  }),
                ) +
                '.sig',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
              token_type: 'bearer',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              sub: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              picture: 'https://example.com/avatar.png',
            }),
          });

        try {
          const result = await (ssoProvider as any).handleCallback('auth-code-123', 'callback-state');

          expect(result.user.id).toBe('user-123');
          expect(result.user.email).toBe('test@example.com');
          expect(result.user.name).toBe('Test User');
          expect(result.tokens.accessToken).toBe('test-access-token');
          expect(result.tokens.refreshToken).toBe('test-refresh-token');
          expect(result.cookies).toHaveLength(1);
          expect(result.cookies[0]).toContain('supabase_session=');

          // Verify token exchange was called correctly
          const tokenCall = (global.fetch as any).mock.calls[0];
          expect(tokenCall[0]).toBe(`${mockSupabaseUrl}/auth/v1/oauth/token`);
          expect(tokenCall[1].method).toBe('POST');
          expect(tokenCall[1].headers.Authorization).toContain('Basic ');
        } finally {
          global.fetch = originalFetch;
        }
      });

      it('should throw on invalid state', async () => {
        await expect((ssoProvider as any).handleCallback('code', 'invalid-state')).rejects.toThrow(
          'Invalid or expired state parameter',
        );
      });

      it('should throw when token exchange fails', async () => {
        (ssoProvider as any).getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'fail-state');

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          text: async () => 'invalid_grant',
        });

        try {
          await expect((ssoProvider as any).handleCallback('bad-code', 'fail-state')).rejects.toThrow(
            'Token exchange failed',
          );
        } finally {
          global.fetch = originalFetch;
        }
      });

      it('should fall back to id_token when userinfo fails', async () => {
        (ssoProvider as any).getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'fallback-state');

        const originalFetch = global.fetch;
        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              access_token: 'test-access-token',
              id_token:
                'header.' +
                btoa(
                  JSON.stringify({
                    sub: 'user-456',
                    email: 'fallback@example.com',
                    name: 'Fallback User',
                  }),
                ) +
                '.sig',
              expires_in: 3600,
              token_type: 'bearer',
            }),
          })
          .mockResolvedValueOnce({
            ok: false,
            text: async () => 'unauthorized',
          });

        try {
          const result = await (ssoProvider as any).handleCallback('code-456', 'fallback-state');
          expect(result.user.id).toBe('user-456');
          expect(result.user.email).toBe('fallback@example.com');
        } finally {
          global.fetch = originalFetch;
        }
      });
    });

    describe('getLoginButtonConfig', () => {
      it('should return default Supabase button config', () => {
        const config = (ssoProvider as any).getLoginButtonConfig();
        expect(config.provider).toBe('supabase');
        expect(config.text).toBe('Sign in with Supabase');
        expect(config.description).toBe('Sign in using your Supabase account');
      });

      it('should use custom button text when configured', () => {
        const custom = new MastraAuthSupabase({
          session: { cookiePassword: mockCookiePassword },
          sso: {
            oauthClientId: mockOauthClientId,
            oauthClientSecret: mockOauthClientSecret,
            buttonText: 'Login with MyApp',
            icon: 'https://example.com/icon.svg',
            description: 'Use your MyApp credentials',
          },
        });
        const config = (custom as any).getLoginButtonConfig();
        expect(config.text).toBe('Login with MyApp');
        expect(config.icon).toBe('https://example.com/icon.svg');
        expect(config.description).toBe('Use your MyApp credentials');
      });
    });

    describe('getLogoutUrl', () => {
      it('should return null', () => {
        expect((ssoProvider as any).getLogoutUrl('http://localhost:4111')).toBeNull();
      });
    });
  });

  it('can be overridden with custom authorization logic', async () => {
    const supabase = new MastraAuthSupabase({
      async authorizeUser(user: any): Promise<boolean> {
        return user?.permissions?.includes('admin') ?? false;
      },
    });

    const adminUser = { sub: 'user123', permissions: ['admin'] } as unknown as User;
    expect(await supabase.authorizeUser(adminUser)).toBe(true);

    const regularUser = { sub: 'user456', permissions: ['read'] } as unknown as User;
    expect(await supabase.authorizeUser(regularUser)).toBe(false);

    const noPermissionsUser = { sub: 'user789' } as unknown as User;
    expect(await supabase.authorizeUser(noPermissionsUser)).toBe(false);
  });
});
