import type { JwtPayload } from '@mastra/auth';
import { verifyJwks } from '@mastra/auth';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthWorkos } from './index';

// Mock the WorkOS class
const mockListOrganizationMemberships = vi.fn();
const mockGetUser = vi.fn();
const mockWorkOSConstructor = vi.fn();

vi.mock('@workos-inc/node', () => {
  // Use a class for constructor (Vitest v4 requirement)
  class MockWorkOS {
    userManagement: any;

    constructor(apiKey?: string, options?: any) {
      mockWorkOSConstructor(apiKey, options);
      this.userManagement = {
        getJwksUrl: vi.fn().mockReturnValue('https://mock-jwks-url'),
        listOrganizationMemberships: mockListOrganizationMemberships,
        getUser: mockGetUser,
      };
    }
  }

  // Mock the GeneratePortalLinkIntent enum used by admin-portal.ts
  const GeneratePortalLinkIntent = {
    SSO: 'sso',
    DSync: 'dsync',
    AuditLogs: 'audit_logs',
    LogStreams: 'log_streams',
  };

  return {
    WorkOS: MockWorkOS,
    GeneratePortalLinkIntent,
  };
});

// Mock the verifyJwks function
vi.mock('@mastra/auth', () => ({
  verifyJwks: vi.fn().mockResolvedValue({
    sub: 'user123',
    email: 'test@example.com',
  } as JwtPayload),
}));

// Mock @workos/authkit-session
const mockWithAuth = vi.fn();
vi.mock('@workos/authkit-session', () => {
  class MockAuthService {
    withAuth = mockWithAuth;
    constructor() {}
  }
  class MockCookieSessionStorage {
    constructor() {}
  }
  return {
    AuthService: MockAuthService,
    CookieSessionStorage: MockCookieSessionStorage,
    sessionEncryption: vi.fn().mockReturnValue({
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    }),
  };
});

describe('MastraAuthWorkos', () => {
  const mockApiKey = 'test-api-key';
  const mockClientId = 'test-client-id';
  const mockRedirectUri = 'https://example.com/auth/callback';
  const mockCookiePassword = 'test-cookie-password-at-least-32-chars';

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockReset();
    mockListOrganizationMemberships.mockReset();
    mockGetUser.mockReset();
    vi.mocked(verifyJwks).mockReset();
    // Reset environment variables
    delete process.env.WORKOS_API_KEY;
    delete process.env.WORKOS_CLIENT_ID;
    delete process.env.WORKOS_REDIRECT_URI;
    delete process.env.WORKOS_COOKIE_PASSWORD;
    // Reset default mock behavior
    const memberships = [{ role: { slug: 'admin' } }, { role: { slug: 'member' } }];
    mockListOrganizationMemberships.mockResolvedValue({
      data: memberships,
      autoPagination: vi.fn().mockResolvedValue(memberships),
    });
    vi.mocked(verifyJwks).mockResolvedValue({
      sub: 'user123',
      email: 'test@example.com',
    } as JwtPayload);
    mockGetUser.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profilePictureUrl: null,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    });
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      expect(mockWorkOSConstructor).toHaveBeenCalledWith(mockApiKey, {
        clientId: mockClientId,
      });
    });

    it('should initialize with environment variables', () => {
      process.env.WORKOS_API_KEY = mockApiKey;
      process.env.WORKOS_CLIENT_ID = mockClientId;
      process.env.WORKOS_REDIRECT_URI = mockRedirectUri;
      process.env.WORKOS_COOKIE_PASSWORD = mockCookiePassword;

      new MastraAuthWorkos();

      expect(mockWorkOSConstructor).toHaveBeenCalledWith(mockApiKey, {
        clientId: mockClientId,
      });
    });

    it('should throw error when neither options nor environment variables are provided', () => {
      expect(() => new MastraAuthWorkos()).toThrow('WorkOS API key and client ID are required');
    });

    it('should throw error when redirect URI is not provided', () => {
      expect(
        () =>
          new MastraAuthWorkos({
            apiKey: mockApiKey,
            clientId: mockClientId,
            session: { cookiePassword: mockCookiePassword },
          }),
      ).toThrow('WorkOS redirect URI is required');
    });
  });

  describe('authenticateToken', () => {
    const mockRequest = {
      raw: new Request('https://example.com'),
    } as any;

    it('should authenticate via session when available', async () => {
      // Mock session-based auth returning a user
      mockWithAuth.mockResolvedValueOnce({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: 'org123',
        },
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const result = await auth.authenticateToken('', mockRequest);

      expect(mockWithAuth).toHaveBeenCalled();
      expect(result).toMatchObject({
        workosId: 'user123',
        email: 'test@example.com',
      });
    });

    it('should fall back to JWT verification when session is not available', async () => {
      // Mock session-based auth returning no user
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const mockToken = 'valid-token';
      const _result = await auth.authenticateToken(mockToken, mockRequest);

      expect(verifyJwks).toHaveBeenCalledWith(mockToken, 'https://mock-jwks-url');
    });

    it('should not merge configured JWT organization claims onto a fetched WorkOS user by default', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'user123',
        org_id: 'org_123',
        'urn:mastra:organization_membership_id': 'om_123',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        jwtClaims: {
          organizationMembershipId: 'urn:mastra:organization_membership_id',
        },
        mapJwtPayloadToUser: () => ({
          memberships: [{ id: 'om_123', organizationId: 'org_123' }],
        }),
      });

      const result = await auth.authenticateToken('valid-token', mockRequest);

      expect(mockGetUser).toHaveBeenCalledWith('user123');
      expect(result).toMatchObject({
        id: 'user123',
        workosId: 'user123',
      });
      expect(result?.organizationId).toBeUndefined();
      expect(result?.organizationMembershipId).toBeUndefined();
      expect(result?.memberships).toBeUndefined();
    });

    it('should trust configured JWT claims for service tokens when getUser lookup does not apply', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      mockGetUser.mockRejectedValueOnce(new Error('not a WorkOS user'));
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'svc_automation',
        email: 'automation@example.com',
        org_id: 'org_service',
        'urn:mastra:organization_membership_id': 'om_service',
        'urn:mastra:team_id': 'team_a',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        trustJwtClaims: true,
        jwtClaims: {
          organizationMembershipId: 'urn:mastra:organization_membership_id',
        },
      });

      const result = await auth.authenticateToken('service-token', mockRequest);

      expect(result).toMatchObject({
        id: 'svc_automation',
        workosId: 'svc_automation',
        email: 'automation@example.com',
        organizationId: 'org_service',
        organizationMembershipId: 'om_service',
      });
      expect((result as any)?.['urn:mastra:team_id']).toBe('team_a');
    });

    it('should keep bearer-token auth when optional membership enrichment fails', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      mockListOrganizationMemberships.mockRejectedValueOnce(new Error('membership API unavailable'));
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'user123',
        email: 'test@example.com',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const result = await auth.authenticateToken('valid-token', mockRequest);

      expect(result).toMatchObject({
        id: 'user123',
        workosId: 'user123',
      });
      expect(result?.memberships).toBeUndefined();
    });

    it('should not infer organizationId from multiple fetched memberships during bearer-token auth', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      const memberships = [
        { id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } },
        { id: 'om-2', organizationId: 'org-2', role: { slug: 'member' } },
      ];
      mockListOrganizationMemberships.mockResolvedValueOnce({
        data: memberships,
        autoPagination: vi.fn().mockResolvedValue(memberships),
      });
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'user123',
        email: 'test@example.com',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const result = await auth.authenticateToken('valid-token', mockRequest);

      expect(result?.organizationId).toBeUndefined();
      expect(result?.memberships).toEqual(memberships);
    });

    it('should return null for invalid token', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      vi.mocked(verifyJwks).mockResolvedValueOnce(null as unknown as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const result = await auth.authenticateToken('invalid-token', mockRequest);
      expect(result).toBeNull();
    });
  });

  describe('authorizeUser', () => {
    it('should return true for valid user with id and workosId', async () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const result = await auth.authorizeUser({
        id: 'user123',
        workosId: 'wos_user123',
        email: 'test@example.com',
      } as any);

      expect(result).toBe(true);
    });

    it('should return false for user without workosId', async () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const result = await auth.authorizeUser({
        id: 'user123',
        email: 'test@example.com',
      } as any);

      expect(result).toBe(false);
    });

    it('should return false for null user', async () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const result = await auth.authorizeUser(null as any);
      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should not fetch memberships when fetchMemberships is disabled', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: undefined,
        },
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const user = await auth.getCurrentUser(new Request('https://example.com'));

      expect(user).toMatchObject({
        id: 'user123',
        workosId: 'user123',
      });
      expect(mockListOrganizationMemberships).not.toHaveBeenCalled();
    });

    it('should cache memberships across repeated requests when fetchMemberships is enabled', async () => {
      mockWithAuth.mockResolvedValue({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: undefined,
        },
      });
      const memberships = [{ id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } }];
      const autoPagination = vi.fn().mockResolvedValue(memberships);
      mockListOrganizationMemberships.mockResolvedValue({
        data: memberships,
        autoPagination,
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const firstUser = await auth.getCurrentUser(new Request('https://example.com/one'));
      const secondUser = await auth.getCurrentUser(new Request('https://example.com/two'));

      expect(firstUser).toMatchObject({
        organizationId: 'org-1',
        memberships: [{ id: 'om-1', organizationId: 'org-1' }],
      });
      expect(secondUser).toMatchObject({
        organizationId: 'org-1',
        memberships: [{ id: 'om-1', organizationId: 'org-1' }],
      });
      expect(mockListOrganizationMemberships).toHaveBeenCalledTimes(1);
      expect(autoPagination).toHaveBeenCalledTimes(1);
    });

    it('should cache the full auto-paginated memberships when fetchMemberships is enabled', async () => {
      mockWithAuth.mockResolvedValue({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: undefined,
        },
      });
      const firstPageMemberships = [{ id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } }];
      const allMemberships = [
        ...firstPageMemberships,
        { id: 'om-2', organizationId: 'org-2', role: { slug: 'member' } },
      ];
      const autoPagination = vi.fn().mockResolvedValue(allMemberships);
      mockListOrganizationMemberships.mockResolvedValue({
        data: firstPageMemberships,
        autoPagination,
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const firstUser = await auth.getCurrentUser(new Request('https://example.com/one'));
      const secondUser = await auth.getCurrentUser(new Request('https://example.com/two'));

      expect(firstUser?.organizationId).toBeUndefined();
      expect(firstUser).toMatchObject({
        memberships: [
          { id: 'om-1', organizationId: 'org-1' },
          { id: 'om-2', organizationId: 'org-2' },
        ],
      });
      expect(secondUser?.organizationId).toBeUndefined();
      expect(secondUser).toMatchObject({
        memberships: [
          { id: 'om-1', organizationId: 'org-1' },
          { id: 'om-2', organizationId: 'org-2' },
        ],
      });
      expect(mockListOrganizationMemberships).toHaveBeenCalledTimes(1);
      expect(autoPagination).toHaveBeenCalledTimes(1);
    });
  });

  it('can be overridden with custom authorization logic', async () => {
    const workos = new MastraAuthWorkos({
      apiKey: mockApiKey,
      clientId: mockClientId,
      redirectUri: mockRedirectUri,
      session: { cookiePassword: mockCookiePassword },
      async authorizeUser(user: any): Promise<boolean> {
        // Custom authorization logic that checks for specific permissions
        return user?.permissions?.includes('admin') ?? false;
      },
    });

    // Test with admin user
    const adminUser = { id: 'user123', workosId: 'wos123', permissions: ['admin'] };
    expect(await workos.authorizeUser(adminUser)).toBe(true);

    // Test with non-admin user
    const regularUser = { id: 'user456', workosId: 'wos456', permissions: ['read'] };
    expect(await workos.authorizeUser(regularUser)).toBe(false);

    // Test with user without permissions
    const noPermissionsUser = { id: 'user789', workosId: 'wos789' };
    expect(await workos.authorizeUser(noPermissionsUser)).toBe(false);
  });
});
