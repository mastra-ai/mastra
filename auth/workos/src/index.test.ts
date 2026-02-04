import type { JwtPayload } from '@mastra/auth';
import { verifyJwks } from '@mastra/auth';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthWorkos } from './index';

// Mock the WorkOS class
const mockListOrganizationMemberships = vi.fn();
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
    // Reset environment variables
    delete process.env.WORKOS_API_KEY;
    delete process.env.WORKOS_CLIENT_ID;
    delete process.env.WORKOS_REDIRECT_URI;
    delete process.env.WORKOS_COOKIE_PASSWORD;
    // Reset default mock behavior
    mockListOrganizationMemberships.mockResolvedValue({
      data: [{ role: { slug: 'admin' } }, { role: { slug: 'member' } }],
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
