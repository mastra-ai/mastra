import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { MastraAuthGitHub } from './index';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockGitHubUser = {
  id: 12345,
  login: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
};

const expectedUser = {
  id: '12345',
  login: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
};

describe('MastraAuthGitHub', () => {
  const defaultOptions = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    allowedUsers: ['testuser'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_CLIENT_ID = 'env-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'env-client-secret';
  });

  afterEach(() => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

  describe('constructor', () => {
    test('initializes with provided options', () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      expect(auth).toBeInstanceOf(MastraAuthGitHub);
    });

    test('initializes with environment variables', () => {
      const auth = new MastraAuthGitHub({ allowedUsers: ['testuser'] });
      expect(auth['clientId']).toBe('env-client-id');
      expect(auth['clientSecret']).toBe('env-client-secret');
    });

    test('options take precedence over environment variables', () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      expect(auth['clientId']).toBe('test-client-id');
      expect(auth['clientSecret']).toBe('test-client-secret');
    });

    test('throws error when client ID and secret are missing', () => {
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
      expect(() => new MastraAuthGitHub({ allowedUsers: ['testuser'] })).toThrow(
        'GitHub client ID and client secret are required',
      );
    });

    test('throws error when no access restriction is provided', () => {
      expect(
        () =>
          new MastraAuthGitHub({
            clientId: 'id',
            clientSecret: 'secret',
          }),
      ).toThrow('At least one access restriction is required');
    });

    test('accepts allowedUsers as restriction', () => {
      expect(() => new MastraAuthGitHub({ ...defaultOptions, allowedUsers: ['user1'] })).not.toThrow();
    });

    test('accepts allowedOrgs as restriction', () => {
      expect(
        () => new MastraAuthGitHub({ clientId: 'id', clientSecret: 'secret', allowedOrgs: ['org1'] }),
      ).not.toThrow();
    });

    test('accepts allowedTeams as restriction', () => {
      expect(
        () => new MastraAuthGitHub({ clientId: 'id', clientSecret: 'secret', allowedTeams: ['org/team'] }),
      ).not.toThrow();
    });

    test('accepts custom authorizeUser as restriction', () => {
      expect(
        () =>
          new MastraAuthGitHub({
            clientId: 'id',
            clientSecret: 'secret',
            authorizeUser: async () => true,
          }),
      ).not.toThrow();
    });

    test('uses custom name when provided', () => {
      const auth = new MastraAuthGitHub({ ...defaultOptions, name: 'custom-github' });
      expect(auth.name).toBe('custom-github');
    });
  });

  describe('authenticateToken', () => {
    test('returns user when token is valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authenticateToken('valid-token');

      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'Bearer valid-token',
          Accept: 'application/vnd.github+json',
        },
      });
      expect(result).toEqual(expectedUser);
    });

    test('returns null when token is empty', async () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authenticateToken('');
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns null when GitHub API returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authenticateToken('invalid-token');
      expect(result).toBeNull();
    });

    test('returns null when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authenticateToken('some-token');
      expect(result).toBeNull();
    });

    test('falls back to cookie when no token provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      const request = new Request('http://localhost:4111/api/test', {
        headers: { cookie: 'mastra-token=cookie-token' },
      });

      const result = await auth.authenticateToken('', request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'Bearer cookie-token',
          Accept: 'application/vnd.github+json',
        },
      });
      expect(result).toEqual(expectedUser);
    });

    test('converts null email to undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockGitHubUser, email: null, name: null, avatar_url: null }),
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authenticateToken('valid-token');

      expect(result).toEqual({
        id: '12345',
        login: 'testuser',
        email: undefined,
        name: undefined,
        avatarUrl: undefined,
      });
    });
  });

  describe('authorizeUser', () => {
    test('returns false when user has no id', async () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authorizeUser({ id: '', login: 'test' });
      expect(result).toBe(false);
    });

    test('returns true when user login is in allowedUsers', async () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authorizeUser({ id: '1', login: 'testuser' });
      expect(result).toBe(true);
    });

    test('returns false when user login is not in allowedUsers', async () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.authorizeUser({ id: '1', login: 'otheruser' });
      expect(result).toBe(false);
    });

    test('checks org membership when allowedOrgs is set', async () => {
      // First call: authenticateToken to cache token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });
      // Second call: GET /user/orgs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ login: 'mastra-ai' }],
      });

      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedOrgs: ['mastra-ai'],
      });

      // Authenticate first to cache the token
      await auth.authenticateToken('valid-token');
      const result = await auth.authorizeUser({ id: '12345', login: 'testuser' });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user/orgs', {
        headers: {
          Authorization: 'Bearer valid-token',
          Accept: 'application/vnd.github+json',
        },
      });
    });

    test('org matching is case-insensitive', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ login: 'Mastra-AI' }],
      });

      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedOrgs: ['mastra-ai'],
      });

      await auth.authenticateToken('valid-token');
      const result = await auth.authorizeUser({ id: '12345', login: 'testuser' });
      expect(result).toBe(true);
    });

    test('checks team membership when allowedTeams is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ slug: 'engineering', organization: { login: 'mastra-ai' } }],
      });

      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedTeams: ['mastra-ai/engineering'],
      });

      await auth.authenticateToken('valid-token');
      const result = await auth.authorizeUser({ id: '12345', login: 'testuser' });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user/teams', {
        headers: {
          Authorization: 'Bearer valid-token',
          Accept: 'application/vnd.github+json',
        },
      });
    });

    test('team matching is case-insensitive', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ slug: 'Engineering', organization: { login: 'Mastra-AI' } }],
      });

      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedTeams: ['mastra-ai/engineering'],
      });

      await auth.authenticateToken('valid-token');
      const result = await auth.authorizeUser({ id: '12345', login: 'testuser' });
      expect(result).toBe(true);
    });

    test('returns false when no cached token for org/team checks', async () => {
      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedOrgs: ['mastra-ai'],
      });

      const result = await auth.authorizeUser({ id: '12345', login: 'testuser' });
      expect(result).toBe(false);
    });

    test('uses OR logic across restriction types', async () => {
      // User is in allowedUsers but not in the org
      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedUsers: ['testuser'],
        allowedOrgs: ['some-other-org'],
      });

      const result = await auth.authorizeUser({ id: '1', login: 'testuser' });
      expect(result).toBe(true);
    });

    test('can be overridden with custom authorizeUser', async () => {
      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        authorizeUser: async user => user.login === 'special-user',
      });

      expect(await auth.authorizeUser({ id: '1', login: 'special-user' })).toBe(true);
      expect(await auth.authorizeUser({ id: '2', login: 'other-user' })).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    test('reads token from Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      const request = new Request('http://localhost:4111/api/test', {
        headers: { authorization: 'Bearer header-token' },
      });

      const result = await auth.getCurrentUser(request);
      expect(result).toEqual(expectedUser);
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'Bearer header-token',
          Accept: 'application/vnd.github+json',
        },
      });
    });

    test('falls back to cookie when no Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      const request = new Request('http://localhost:4111/api/test', {
        headers: { cookie: 'mastra-token=cookie-token' },
      });

      const result = await auth.getCurrentUser(request);
      expect(result).toEqual(expectedUser);
    });

    test('returns null when no token available', async () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const request = new Request('http://localhost:4111/api/test');

      const result = await auth.getCurrentUser(request);
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    test('fetches user by ID when cached token exists', async () => {
      // First authenticate to cache token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });
      // Then getUser call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockGitHubUser, id: 99999, login: 'otheruser' }),
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      await auth.authenticateToken('valid-token');
      const result = await auth.getUser('99999');

      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user/99999', {
        headers: {
          Authorization: 'Bearer valid-token',
          Accept: 'application/vnd.github+json',
        },
      });
      expect(result?.id).toBe('99999');
    });

    test('returns null when no cached token', async () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.getUser('12345');
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getLoginUrl', () => {
    test('generates login URL with basic scopes for allowedUsers only', () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const url = auth.getLoginUrl('http://localhost:4111/callback', 'test-state');

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=test-state');
      expect(url).toContain('scope=read%3Auser+user%3Aemail');
      expect(url).not.toContain('read%3Aorg');
    });

    test('includes read:org scope when allowedOrgs is set', () => {
      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedOrgs: ['mastra-ai'],
      });
      const url = auth.getLoginUrl('http://localhost:4111/callback', 'test-state');

      expect(url).toContain('read%3Aorg');
    });

    test('includes read:org scope when allowedTeams is set', () => {
      const auth = new MastraAuthGitHub({
        clientId: 'id',
        clientSecret: 'secret',
        allowedTeams: ['mastra-ai/engineering'],
      });
      const url = auth.getLoginUrl('http://localhost:4111/callback', 'test-state');

      expect(url).toContain('read%3Aorg');
    });
  });

  describe('handleCallback', () => {
    test('exchanges code for token, fetches user, and returns cookie', async () => {
      // Token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-access-token' }),
      });
      // User fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      const result = await auth.handleCallback('auth-code', 'test-state');

      expect(mockFetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          code: 'auth-code',
        }),
      });

      expect(result.user).toEqual(expectedUser);
      expect(result.tokens.accessToken).toBe('new-access-token');
      expect(result.cookies).toHaveLength(1);
      expect(result.cookies![0]).toBe('mastra-token=new-access-token; HttpOnly; SameSite=Lax; Path=/');
    });

    test('caches the access token after callback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'callback-token' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGitHubUser,
      });

      const auth = new MastraAuthGitHub(defaultOptions);
      await auth.handleCallback('auth-code', 'state');

      expect(auth['_cachedToken']).toBe('callback-token');
    });
  });

  describe('getLoginButtonConfig', () => {
    test('returns GitHub login button config', () => {
      const auth = new MastraAuthGitHub(defaultOptions);
      const config = auth.getLoginButtonConfig();

      expect(config).toEqual({
        provider: 'github',
        text: 'Sign in with GitHub',
      });
    });
  });

  describe('route configuration', () => {
    test('stores public routes when provided', () => {
      const auth = new MastraAuthGitHub({
        ...defaultOptions,
        public: ['/health', '/api/status'],
      });
      expect(auth.public).toEqual(['/health', '/api/status']);
    });

    test('stores protected routes when provided', () => {
      const auth = new MastraAuthGitHub({
        ...defaultOptions,
        protected: ['/api/*'],
      });
      expect(auth.protected).toEqual(['/api/*']);
    });
  });
});
