import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCapabilities } from './capabilities';
import type { AuthenticatedCapabilities } from './capabilities';
import { clearLicenseCache } from './license';

/**
 * Minimal mock auth provider that implements SSO, credentials, user, and session interfaces.
 * Simulates a custom Auth0-style provider with SSO login.
 */
function createMockAuthProvider(overrides?: {
  isMastraCloudAuth?: boolean;
  isSimpleAuth?: boolean;
  getCurrentUser?: (req: Request) => Promise<{ id: string; email?: string; name?: string; avatarUrl?: string } | null>;
}) {
  return {
    // ISSOProvider
    getLoginUrl: (redirectUri: string, _state: string) =>
      `https://auth0.example.com/authorize?redirect_uri=${redirectUri}`,
    handleCallback: async (_code: string, _state: string) => ({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
      tokens: { accessToken: 'token-123' },
    }),
    getLoginButtonConfig: () => ({ provider: 'auth0', text: 'Sign in with Auth0' }),

    // ICredentialsProvider
    signIn: async (_email: string, _password: string) => ({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
      tokens: { accessToken: 'token-123' },
    }),

    // IUserProvider
    getCurrentUser:
      overrides?.getCurrentUser ??
      (async (_req: Request) => ({ id: 'user-1', email: 'test@example.com', name: 'Test User' })),
    getUser: async (_userId: string) => ({ id: 'user-1', email: 'test@example.com', name: 'Test User' }),

    // ISessionProvider
    createSession: async (_user: unknown) => ({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
    }),
    getSession: async (_req: Request) => ({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
    }),
    deleteSession: async (_sessionId: string) => {},
    getSessionCookie: () => 'mastra-session=abc',

    // Cloud/Simple markers
    ...(overrides?.isMastraCloudAuth !== undefined && { isMastraCloudAuth: overrides.isMastraCloudAuth }),
    ...(overrides?.isSimpleAuth !== undefined && { isSimpleAuth: overrides.isSimpleAuth }),
  } as any;
}

/** Mock RBAC provider */
function createMockRBACProvider() {
  return {
    getRoles: async () => ['admin'],
    hasRole: async () => true,
    getPermissions: async () => ['*'],
    hasPermission: async () => true,
    hasAllPermissions: async () => true,
    hasAnyPermission: async () => true,
  };
}

/** Mock ACL provider */
function createMockACLProvider() {
  return {
    canAccess: async () => true,
    listAccessible: async () => ['resource-1'],
    filterAccessible: async <T extends { id: string }>(_user: unknown, resources: T[]) => resources,
  };
}

function createMockRequest(): Request {
  return new Request('http://localhost:3000/api/auth/capabilities');
}

describe('buildCapabilities', () => {
  let originalNodeEnv: string | undefined;
  let originalMastraDev: string | undefined;
  let originalLicense: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalMastraDev = process.env['MASTRA_DEV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    clearLicenseCache();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalMastraDev !== undefined) process.env['MASTRA_DEV'] = originalMastraDev;
    else delete process.env['MASTRA_DEV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
  });

  it('should return disabled when no auth provider is configured', async () => {
    const result = await buildCapabilities(null, createMockRequest());
    expect(result).toEqual({ enabled: false, login: null });
  });

  describe('production without EE license (OSS features)', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['MASTRA_DEV'];
      delete process.env['MASTRA_EE_LICENSE'];
      clearLicenseCache();
    });

    it('should enable SSO login without a license', async () => {
      const auth = createMockAuthProvider();
      const result = await buildCapabilities(auth, createMockRequest());

      expect(result.enabled).toBe(true);
      expect(result.login).not.toBeNull();
      expect(result.login!.type).toBe('both');
      expect(result.login!.sso).toBeDefined();
      expect(result.login!.sso!.provider).toBe('auth0');
    });

    it('should enable credentials login without a license', async () => {
      // Provider with only credentials (no SSO)
      const auth = {
        signIn: async () => ({
          user: { id: 'user-1' },
          tokens: { accessToken: 'token-123' },
        }),
        getCurrentUser: async () => ({ id: 'user-1', email: 'test@example.com', name: 'Test' }),
        getUser: async () => ({ id: 'user-1' }),
        createSession: async () => ({ id: 's-1', userId: 'user-1', expiresAt: new Date() }),
        getSession: async () => ({ id: 's-1', userId: 'user-1', expiresAt: new Date() }),
        deleteSession: async () => {},
        getSessionCookie: () => 'session=abc',
      } as any;

      const result = await buildCapabilities(auth, createMockRequest());

      expect(result.enabled).toBe(true);
      expect(result.login).not.toBeNull();
      expect(result.login!.type).toBe('credentials');
    });

    it('should resolve the current user without a license', async () => {
      const auth = createMockAuthProvider();
      const result = (await buildCapabilities(auth, createMockRequest())) as AuthenticatedCapabilities;

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should report user/session/sso capabilities as true without a license', async () => {
      const auth = createMockAuthProvider();
      const result = (await buildCapabilities(auth, createMockRequest())) as AuthenticatedCapabilities;

      expect(result.capabilities.user).toBe(true);
      expect(result.capabilities.session).toBe(true);
      expect(result.capabilities.sso).toBe(true);
    });

    it('should gate RBAC behind a license', async () => {
      const auth = createMockAuthProvider();
      const rbac = createMockRBACProvider();
      const result = (await buildCapabilities(auth, createMockRequest(), { rbac })) as AuthenticatedCapabilities;

      expect(result.capabilities.rbac).toBe(false);
      expect(result.access).toBeNull();
    });

    it('should gate ACL behind a license', async () => {
      const auth = {
        ...createMockAuthProvider(),
        canAccess: createMockACLProvider().canAccess,
        listAccessible: createMockACLProvider().listAccessible,
        filterAccessible: createMockACLProvider().filterAccessible,
      } as any;

      const result = (await buildCapabilities(auth, createMockRequest())) as AuthenticatedCapabilities;

      expect(result.capabilities.acl).toBe(false);
    });

    it('should return public response when user is not authenticated', async () => {
      const auth = createMockAuthProvider({
        getCurrentUser: async () => null,
      });

      const result = await buildCapabilities(auth, createMockRequest());

      expect(result.enabled).toBe(true);
      expect(result.login).not.toBeNull();
      // Should be a public response (no user property)
      expect('capabilities' in result).toBe(false);
    });
  });

  describe('production with EE license', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['MASTRA_DEV'];
      process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
      clearLicenseCache();
    });

    it('should enable all features including RBAC and ACL', async () => {
      const auth = {
        ...createMockAuthProvider(),
        canAccess: createMockACLProvider().canAccess,
        listAccessible: createMockACLProvider().listAccessible,
        filterAccessible: createMockACLProvider().filterAccessible,
      } as any;
      const rbac = createMockRBACProvider();

      const result = (await buildCapabilities(auth, createMockRequest(), { rbac })) as AuthenticatedCapabilities;

      expect(result.capabilities.user).toBe(true);
      expect(result.capabilities.session).toBe(true);
      expect(result.capabilities.sso).toBe(true);
      expect(result.capabilities.rbac).toBe(true);
      expect(result.capabilities.acl).toBe(true);
      expect(result.access).not.toBeNull();
      expect(result.access!.roles).toEqual(['admin']);
    });
  });

  describe('development environment', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
      delete process.env['MASTRA_DEV'];
      delete process.env['MASTRA_EE_LICENSE'];
      clearLicenseCache();
    });

    it('should enable all features without a license in dev', async () => {
      const auth = createMockAuthProvider();
      const rbac = createMockRBACProvider();

      const result = (await buildCapabilities(auth, createMockRequest(), { rbac })) as AuthenticatedCapabilities;

      expect(result.capabilities.user).toBe(true);
      expect(result.capabilities.session).toBe(true);
      expect(result.capabilities.sso).toBe(true);
      expect(result.capabilities.rbac).toBe(true);
    });
  });

  describe('SSO login URL', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['MASTRA_DEV'];
      delete process.env['MASTRA_EE_LICENSE'];
      clearLicenseCache();
    });

    it('should use default /api prefix for SSO login URL', async () => {
      const auth = createMockAuthProvider({ getCurrentUser: async () => null });
      const result = await buildCapabilities(auth, createMockRequest());

      expect(result.login!.sso!.url).toBe('/api/auth/sso/login');
    });

    it('should use custom apiPrefix for SSO login URL', async () => {
      const auth = createMockAuthProvider({ getCurrentUser: async () => null });
      const result = await buildCapabilities(auth, createMockRequest(), { apiPrefix: '/mastra' });

      expect(result.login!.sso!.url).toBe('/mastra/auth/sso/login');
    });
  });
});
