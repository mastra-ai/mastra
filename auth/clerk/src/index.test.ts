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
      getUser: vi.fn(),
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

    it('can use organization-based authorization when organizations are enabled', async () => {
      // Mock the organization membership API call for this test
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
            // Fallback if organizations are not enabled
            return true;
          }
        },
      });

      // Test with user who has organization membership
      mockOrgClerkClient.users.getOrganizationMembershipList.mockResolvedValue({
        data: [{ id: 'org1' }],
      });
      const userWithOrg = { sub: 'user123' };
      expect(await clerk.authorizeUser(userWithOrg)).toBe(true);

      // Test with user who has no organization memberships
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
});
