import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthBetterAuth } from './index';
import type { BetterAuthUser } from './index';

describe('MastraAuthBetterAuth', () => {
  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 86400000), // 1 day from now
    token: 'test-session-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuth = {
    api: {
      getSession: vi.fn(),
    },
  };

  const mockRequest = {
    header: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.header.mockReset();
  });

  describe('initialization', () => {
    it('should initialize with provided auth instance', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      expect(auth).toBeInstanceOf(MastraAuthBetterAuth);
    });

    it('should throw error when auth instance is not provided', () => {
      expect(() => new MastraAuthBetterAuth({} as any)).toThrow('Better Auth instance is required');
    });

    it('should use default name "better-auth" when not provided', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      expect(auth.name).toBe('better-auth');
    });

    it('should use custom name when provided', () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        name: 'custom-auth',
      });
      expect(auth.name).toBe('custom-auth');
    });
  });

  describe('authenticateToken', () => {
    it('should authenticate valid session token and return user', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      mockRequest.header.mockImplementation((name: string) => {
        if (name === 'Authorization') return 'Bearer test-token';
        return undefined;
      });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('test-token', mockRequest);

      expect(mockAuth.api.getSession).toHaveBeenCalled();
      expect(result).toEqual({
        session: mockSession,
        user: mockUser,
      });
    });

    it('should return null when session is not found', async () => {
      mockAuth.api.getSession.mockResolvedValue(null);
      mockRequest.header.mockReturnValue(undefined);

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('invalid-token', mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when getSession throws an error', async () => {
      mockAuth.api.getSession.mockRejectedValue(new Error('Session expired'));
      mockRequest.header.mockReturnValue(undefined);

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('expired-token', mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when session is missing user', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: null,
      });
      mockRequest.header.mockReturnValue(undefined);

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('test-token', mockRequest);

      expect(result).toBeNull();
    });

    it('should return null when session is missing session object', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: null,
        user: mockUser,
      });
      mockRequest.header.mockReturnValue(undefined);

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authenticateToken('test-token', mockRequest);

      expect(result).toBeNull();
    });

    it('should pass Authorization header when present', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      mockRequest.header.mockImplementation((name: string) => {
        if (name === 'Authorization') return 'Bearer existing-token';
        return undefined;
      });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('test-token', mockRequest);

      expect(mockAuth.api.getSession).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );

      // Verify the headers contain the Authorization
      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Authorization')).toBe('Bearer existing-token');
    });

    it('should pass Cookie header when present for cookie-based sessions', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      mockRequest.header.mockImplementation((name: string) => {
        if (name === 'Cookie') return 'better-auth.session_token=abc123';
        return undefined;
      });

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('test-token', mockRequest);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Cookie')).toBe('better-auth.session_token=abc123');
    });

    it('should set Authorization header from token when no existing header', async () => {
      mockAuth.api.getSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });
      mockRequest.header.mockReturnValue(undefined);

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      await auth.authenticateToken('my-bearer-token', mockRequest);

      const call = mockAuth.api.getSession.mock.calls[0][0];
      expect(call.headers.get('Authorization')).toBe('Bearer my-bearer-token');
    });
  });

  describe('authorizeUser', () => {
    it('should return true for valid user with session', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: mockSession,
        user: mockUser,
      } as BetterAuthUser);

      expect(result).toBe(true);
    });

    it('should return false when session id is missing', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: { ...mockSession, id: '' },
        user: mockUser,
      } as BetterAuthUser);

      expect(result).toBe(false);
    });

    it('should return false when user id is missing', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: mockSession,
        user: { ...mockUser, id: '' },
      } as BetterAuthUser);

      expect(result).toBe(false);
    });

    it('should return false when user is null', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser(null as any);

      expect(result).toBe(false);
    });

    it('should return false when session is null', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
      });
      const result = await auth.authorizeUser({
        session: null,
        user: mockUser,
      } as any);

      expect(result).toBe(false);
    });
  });

  describe('custom authorization', () => {
    it('can be overridden with custom authorization logic', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        async authorizeUser(user: BetterAuthUser): Promise<boolean> {
          // Custom logic: only allow verified emails
          return user?.user?.emailVerified === true;
        },
      });

      // Test with verified user
      const verifiedUser = {
        session: mockSession,
        user: { ...mockUser, emailVerified: true },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(verifiedUser)).toBe(true);

      // Test with unverified user
      const unverifiedUser = {
        session: mockSession,
        user: { ...mockUser, emailVerified: false },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(unverifiedUser)).toBe(false);
    });

    it('can implement role-based access control', async () => {
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        async authorizeUser(user: BetterAuthUser): Promise<boolean> {
          // Custom logic: check for admin role
          const userWithRole = user?.user as any;
          return userWithRole?.role === 'admin';
        },
      });

      // Test with admin user
      const adminUser = {
        session: mockSession,
        user: { ...mockUser, role: 'admin' },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(adminUser)).toBe(true);

      // Test with regular user
      const regularUser = {
        session: mockSession,
        user: { ...mockUser, role: 'user' },
      } as BetterAuthUser;
      expect(await auth.authorizeUser(regularUser)).toBe(false);
    });
  });

  describe('route configuration options', () => {
    it('should store public routes configuration when provided', () => {
      const publicRoutes = ['/health', '/api/status'];
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        public: publicRoutes,
      });

      expect(auth.public).toEqual(publicRoutes);
    });

    it('should store protected routes configuration when provided', () => {
      const protectedRoutes = ['/api/*', '/admin/*'];
      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        protected: protectedRoutes,
      });

      expect(auth.protected).toEqual(protectedRoutes);
    });

    it('should handle both public and protected routes together', () => {
      const publicRoutes = ['/health', '/api/status'];
      const protectedRoutes = ['/api/*', '/admin/*'];

      const auth = new MastraAuthBetterAuth({
        auth: mockAuth as any,
        public: publicRoutes,
        protected: protectedRoutes,
      });

      expect(auth.public).toEqual(publicRoutes);
      expect(auth.protected).toEqual(protectedRoutes);
    });
  });
});
