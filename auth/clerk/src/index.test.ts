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

describe('MastraAuthClerk', () => {
  const mockOptions = {
    jwksUri: 'https://clerk.jwks.uri',
    secretKey: 'test-secret-key',
    publishableKey: 'test-publishable-key',
  };

  const mockClerkClient = {
    users: {
      getOrganizationMembershipList: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClerkClient as any).mockReturnValue(mockClerkClient);
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
      expect(mockClerkClient.users.getOrganizationMembershipList).not.toHaveBeenCalled();
    });

    it('should return true when user has organization memberships', async () => {
      mockClerkClient.users.getOrganizationMembershipList.mockResolvedValue({
        data: [{ id: 'org1' }],
      });

      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authorizeUser({ sub: 'user123' });

      expect(mockClerkClient.users.getOrganizationMembershipList).toHaveBeenCalledWith({
        userId: 'user123',
      });
      expect(result).toBe(true);
    });

    it('should return false when user has no organization memberships', async () => {
      mockClerkClient.users.getOrganizationMembershipList.mockResolvedValue({
        data: [],
      });

      const auth = new MastraAuthClerk(mockOptions);
      const result = await auth.authorizeUser({ sub: 'user123' });

      expect(result).toBe(false);
    });
  });

  it('can be overridden with custom authorization logic', async () => {
    const clerk = new MastraAuthClerk({
      ...mockOptions,
      async authorizeUser(user: any): Promise<boolean> {
        // Custom authorization logic that checks for specific permissions
        return user?.permissions?.includes('admin') ?? false;
      },
    });

    // Test with admin user
    const adminUser = { sub: 'user123', permissions: ['admin'] };
    expect(await clerk.authorizeUser(adminUser)).toBe(true);

    // Test with non-admin user
    const regularUser = { sub: 'user456', permissions: ['read'] };
    expect(await clerk.authorizeUser(regularUser)).toBe(false);

    // Test with user without permissions
    const noPermissionsUser = { sub: 'user789' };
    expect(await clerk.authorizeUser(noPermissionsUser)).toBe(false);
  });
});
