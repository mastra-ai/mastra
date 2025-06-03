import type { JwtPayload } from '@mastra/auth';
import { verifyJwks } from '@mastra/auth';
import { WorkOS } from '@workos-inc/node';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthWorkos } from './index';

// Mock the WorkOS class
vi.mock('@workos-inc/node', () => ({
  WorkOS: vi.fn().mockImplementation(() => ({
    userManagement: {
      getJwksUrl: vi.fn().mockReturnValue('https://mock-jwks-url'),
      listOrganizationMemberships: vi.fn().mockResolvedValue({
        data: [{ role: { slug: 'admin' } }, { role: { slug: 'member' } }],
      }),
    },
  })),
}));

// Mock the verifyJwks function
vi.mock('@mastra/auth', () => ({
  verifyJwks: vi.fn().mockResolvedValue({
    sub: 'user123',
    email: 'test@example.com',
  } as JwtPayload),
}));

describe('MastraAuthWorkos', () => {
  const mockApiKey = 'test-api-key';
  const mockClientId = 'test-client-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.WORKOS_API_KEY;
    delete process.env.WORKOS_CLIENT_ID;
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
      });

      expect(WorkOS).toHaveBeenCalledWith(mockApiKey, {
        clientId: mockClientId,
      });
    });

    it('should initialize with environment variables', () => {
      process.env.WORKOS_API_KEY = mockApiKey;
      process.env.WORKOS_CLIENT_ID = mockClientId;

      new MastraAuthWorkos();

      expect(WorkOS).toHaveBeenCalledWith(mockApiKey, {
        clientId: mockClientId,
      });
    });

    it('should throw error when neither options nor environment variables are provided', () => {
      expect(() => new MastraAuthWorkos()).toThrow('WorkOS API key and client ID are required');
    });
  });

  describe('authenticateToken', () => {
    it('should authenticate a valid token', async () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
      });

      const mockToken = 'valid-token';
      const result = await auth.authenticateToken(mockToken);

      expect(verifyJwks).toHaveBeenCalledWith(mockToken, 'https://mock-jwks-url');
      expect(result).toEqual({
        sub: 'user123',
        email: 'test@example.com',
      });
    });

    it('should return null for invalid token', async () => {
      vi.mocked(verifyJwks).mockResolvedValueOnce(null as unknown as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
      });

      const result = await auth.authenticateToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('authorizeUser', () => {
    it('should return true for admin users', async () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
      });

      const result = await auth.authorizeUser({
        sub: 'user123',
        email: 'test@example.com',
      });

      expect(result).toBe(true);
    });

    it('should return false for non-admin users', async () => {
      vi.mocked(WorkOS).mockImplementationOnce(
        () =>
          ({
            userManagement: {
              getJwksUrl: vi.fn().mockReturnValue('https://mock-jwks-url'),
              listOrganizationMemberships: vi.fn().mockResolvedValue({
                data: [{ role: { slug: 'member' } }],
              }),
            },
          }) as unknown as WorkOS,
      );

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
      });

      const result = await auth.authorizeUser({
        sub: 'user123',
        email: 'test@example.com',
      });

      expect(result).toBe(false);
    });

    it('should return false for falsy user', async () => {
      vi.mocked(WorkOS).mockImplementationOnce(
        () =>
          ({
            userManagement: {
              getJwksUrl: vi.fn().mockReturnValue('https://mock-jwks-url'),
              listOrganizationMemberships: vi.fn().mockResolvedValue({
                data: [], // Empty data array means no roles
              }),
            },
          }) as unknown as WorkOS,
      );

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
      });

      const result = await auth.authorizeUser({
        sub: '',
        email: '',
      });
      expect(result).toBe(false);
    });
  });

  it('can be overridden with custom authorization logic', async () => {
    const workos = new MastraAuthWorkos({
      apiKey: mockApiKey,
      clientId: mockClientId,
      async authorizeUser(user: any): Promise<boolean> {
        // Custom authorization logic that checks for specific permissions
        return user?.permissions?.includes('admin') ?? false;
      },
    });

    // Test with admin user
    const adminUser = { sub: 'user123', permissions: ['admin'] };
    expect(await workos.authorizeUser(adminUser)).toBe(true);

    // Test with non-admin user
    const regularUser = { sub: 'user456', permissions: ['read'] };
    expect(await workos.authorizeUser(regularUser)).toBe(false);

    // Test with user without permissions
    const noPermissionsUser = { sub: 'user789' };
    expect(await workos.authorizeUser(noPermissionsUser)).toBe(false);
  });
});
