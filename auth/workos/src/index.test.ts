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

  return {
    WorkOS: MockWorkOS,
  };
});

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
      });

      expect(mockWorkOSConstructor).toHaveBeenCalledWith(mockApiKey, {
        clientId: mockClientId,
      });
    });

    it('should initialize with environment variables', () => {
      process.env.WORKOS_API_KEY = mockApiKey;
      process.env.WORKOS_CLIENT_ID = mockClientId;

      new MastraAuthWorkos();

      expect(mockWorkOSConstructor).toHaveBeenCalledWith(mockApiKey, {
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
      // Override the mock for this test
      mockListOrganizationMemberships.mockResolvedValueOnce({
        data: [{ role: { slug: 'member' } }],
      });

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
      // Override the mock for this test
      mockListOrganizationMemberships.mockResolvedValueOnce({
        data: [], // Empty data array means no roles
      });

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
