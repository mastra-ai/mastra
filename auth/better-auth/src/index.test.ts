import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraAuthBetterAuth } from './index';
import type { BetterAuthUser, BetterAuthConfig } from './types';

// Mock the better-auth library
const mockGetSession = vi.fn();
const mockSignInEmail = vi.fn();
const mockSignUpEmail = vi.fn();
const mockForgetPassword = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({
    api: {
      getSession: mockGetSession,
      signInEmail: mockSignInEmail,
      signUpEmail: mockSignUpEmail,
      forgetPassword: mockForgetPassword,
      resetPassword: mockResetPassword,
    },
  })),
}));

// Mock console to avoid noise
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('MastraAuthBetterAuth', () => {
  const validConfig: BetterAuthConfig = {
    database: {
      provider: 'postgresql',
      url: 'postgresql://localhost:5432/test',
    },
    secret: 'test-secret-key-that-is-at-least-32-characters-long',
    baseURL: 'http://localhost:3000',
  };

  const mockBetterAuthUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    image: 'https://example.com/avatar.png',
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with valid config', () => {
      const auth = new MastraAuthBetterAuth(validConfig);

      expect(auth).toBeInstanceOf(MastraAuthBetterAuth);
      expect(auth.name).toBe('better-auth');
      expect(auth.credentials).toBeDefined();
      expect(auth.user).toBeDefined();
    });

    it('should throw error when database config is missing', () => {
      expect(() => new MastraAuthBetterAuth({} as any)).toThrow('Better Auth: database configuration is required');
    });

    it('should throw error when database provider is missing', () => {
      expect(
        () =>
          new MastraAuthBetterAuth({
            database: { url: 'test' } as any,
            secret: 'test-secret-key-that-is-at-least-32-characters-long',
            baseURL: 'http://localhost:3000',
          }),
      ).toThrow('Better Auth: database.provider is required');
    });

    it('should throw error when database url is missing', () => {
      expect(
        () =>
          new MastraAuthBetterAuth({
            database: { provider: 'postgresql' } as any,
            secret: 'test-secret-key-that-is-at-least-32-characters-long',
            baseURL: 'http://localhost:3000',
          }),
      ).toThrow('Better Auth: database.url is required');
    });

    it('should throw error when secret is missing', () => {
      expect(
        () =>
          new MastraAuthBetterAuth({
            database: { provider: 'postgresql', url: 'test' },
            baseURL: 'http://localhost:3000',
          } as any),
      ).toThrow('Better Auth: secret is required');
    });

    it('should throw error when secret is too short', () => {
      expect(
        () =>
          new MastraAuthBetterAuth({
            database: { provider: 'postgresql', url: 'test' },
            secret: 'short',
            baseURL: 'http://localhost:3000',
          }),
      ).toThrow('Better Auth: secret must be at least 32 characters');
    });

    it('should throw error when baseURL is missing', () => {
      expect(
        () =>
          new MastraAuthBetterAuth({
            database: { provider: 'postgresql', url: 'test' },
            secret: 'test-secret-key-that-is-at-least-32-characters-long',
          } as any),
      ).toThrow('Better Auth: baseURL is required');
    });

    it('should return Better Auth instance via getBetterAuthInstance', () => {
      const auth = new MastraAuthBetterAuth(validConfig);
      const instance = auth.getBetterAuthInstance();

      expect(instance).toBeDefined();
      expect(instance.api).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when valid session exists', async () => {
      mockGetSession.mockResolvedValue({ user: mockBetterAuthUser });

      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'better_auth_session=test-session-token' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
      expect(result?.betterAuth.emailVerified).toBe(true);
    });

    it('should return null when no cookie is present', async () => {
      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000');

      const result = await auth.getCurrentUser(request);

      expect(result).toBeNull();
    });

    it('should return null when session cookie is not found', async () => {
      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'other_cookie=value' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).toBeNull();
    });

    it('should return null when session is invalid', async () => {
      mockGetSession.mockResolvedValue(null);

      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'better_auth_session=invalid-token' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).toBeNull();
    });

    it('should return null when getSession throws', async () => {
      mockGetSession.mockRejectedValue(new Error('Session error'));

      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'better_auth_session=test-token' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).toBeNull();
    });

    it('should use custom cookie name from config', async () => {
      mockGetSession.mockResolvedValue({ user: mockBetterAuthUser });

      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        session: { cookieName: 'my_custom_session' },
      });
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'my_custom_session=test-session-token' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
    });
  });

  describe('credentials provider - signIn', () => {
    it('should sign in with valid credentials', async () => {
      mockSignInEmail.mockResolvedValue({
        user: mockBetterAuthUser,
        token: 'session-token',
      });

      const auth = new MastraAuthBetterAuth(validConfig);
      const result = await auth.credentials.signIn('test@example.com', 'password123');

      expect(mockSignInEmail).toHaveBeenCalledWith({
        body: { email: 'test@example.com', password: 'password123' },
      });
      expect(result.user.id).toBe('user-123');
      expect(result.session.userId).toBe('user-123');
      expect(result.cookies['Set-Cookie']).toContain('better_auth_session=');
    });

    it('should throw error for invalid credentials', async () => {
      mockSignInEmail.mockResolvedValue(null);

      const auth = new MastraAuthBetterAuth(validConfig);

      await expect(auth.credentials.signIn('test@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw error when email verification required but not verified', async () => {
      mockSignInEmail.mockResolvedValue({
        user: { ...mockBetterAuthUser, emailVerified: false },
        token: 'session-token',
      });

      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { requireEmailVerification: true },
      });

      await expect(auth.credentials.signIn('test@example.com', 'password123')).rejects.toThrow(
        'Email verification required',
      );
    });
  });

  describe('credentials provider - signUp', () => {
    it('should sign up new user', async () => {
      mockSignUpEmail.mockResolvedValue({
        user: mockBetterAuthUser,
        token: 'session-token',
      });

      const auth = new MastraAuthBetterAuth(validConfig);
      const result = await auth.credentials.signUp('test@example.com', 'password123', 'Test User');

      expect(mockSignUpEmail).toHaveBeenCalledWith({
        body: { email: 'test@example.com', password: 'password123', name: 'Test User' },
      });
      expect(result.user.id).toBe('user-123');
      expect(result.session).toBeDefined();
    });

    it('should throw error when password is too short', async () => {
      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { minPasswordLength: 12 },
      });

      await expect(auth.credentials.signUp('test@example.com', 'short')).rejects.toThrow(
        'Password must be at least 12 characters',
      );
    });

    it('should throw error when signUp is disabled', async () => {
      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { enabled: false },
      });

      await expect(auth.credentials.signUp('test@example.com', 'password123')).rejects.toThrow('Sign up is disabled');
    });

    it('should check if signUp is enabled', () => {
      const authEnabled = new MastraAuthBetterAuth(validConfig);
      expect(authEnabled.credentials.isSignUpEnabled()).toBe(true);

      const authDisabled = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { enabled: false },
      });
      expect(authDisabled.credentials.isSignUpEnabled()).toBe(false);
    });
  });

  describe('credentials provider - password reset', () => {
    it('should request password reset', async () => {
      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { allowPasswordReset: true },
      });

      await auth.credentials.requestPasswordReset('test@example.com');

      expect(mockForgetPassword).toHaveBeenCalledWith({
        body: {
          email: 'test@example.com',
          redirectTo: 'http://localhost:3000/reset-password',
        },
      });
    });

    it('should throw when password reset is disabled', async () => {
      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { allowPasswordReset: false },
      });

      await expect(auth.credentials.requestPasswordReset('test@example.com')).rejects.toThrow(
        'Password reset is disabled',
      );
    });

    it('should reset password with valid token', async () => {
      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { allowPasswordReset: true },
      });

      await auth.credentials.resetPassword('reset-token', 'newPassword123');

      expect(mockResetPassword).toHaveBeenCalledWith({
        body: { token: 'reset-token', newPassword: 'newPassword123' },
      });
    });

    it('should throw when new password is too short', async () => {
      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        emailAndPassword: { allowPasswordReset: true, minPasswordLength: 10 },
      });

      await expect(auth.credentials.resetPassword('reset-token', 'short')).rejects.toThrow(
        'Password must be at least 10 characters',
      );
    });
  });

  describe('user provider', () => {
    it('should get user profile URL', () => {
      const auth = new MastraAuthBetterAuth(validConfig);
      const user: BetterAuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: {},
        betterAuth: {
          userId: 'user-123',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const url = auth.user.getUserProfileUrl(user);

      expect(url).toBe('http://localhost:3000/profile/user-123');
    });

    it('should return null for getUser (not implemented)', async () => {
      const auth = new MastraAuthBetterAuth(validConfig);
      const result = await auth.user.getUser('user-123');

      expect(result).toBeNull();
    });

    it('should get current user from request', async () => {
      mockGetSession.mockResolvedValue({ user: mockBetterAuthUser });

      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'better_auth_session=test-session-token' },
      });

      const result = await auth.user.getCurrentUser(request);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
    });
  });

  describe('user mapping', () => {
    it('should map Better Auth user to BetterAuthUser format', async () => {
      mockGetSession.mockResolvedValue({ user: mockBetterAuthUser });

      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'better_auth_session=test-token' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        metadata: {},
        betterAuth: {
          userId: 'user-123',
          emailVerified: true,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle missing optional fields', async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      });

      const auth = new MastraAuthBetterAuth(validConfig);
      const request = new Request('http://localhost:3000', {
        headers: { cookie: 'better_auth_session=test-token' },
      });

      const result = await auth.getCurrentUser(request);

      expect(result).not.toBeNull();
      expect(result?.name).toBeUndefined();
      expect(result?.avatarUrl).toBeUndefined();
      expect(result?.betterAuth.emailVerified).toBe(false);
    });
  });

  describe('session configuration', () => {
    it('should use custom session expiry', async () => {
      mockSignInEmail.mockResolvedValue({
        user: mockBetterAuthUser,
        token: 'session-token',
      });

      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        session: { expiresIn: 3600 }, // 1 hour
      });

      const result = await auth.credentials.signIn('test@example.com', 'password123');

      // Session should expire in approximately 1 hour
      const now = Date.now();
      const expiresAt = result.session.expiresAt.getTime();
      const hourInMs = 3600 * 1000;

      expect(expiresAt).toBeGreaterThan(now);
      expect(expiresAt).toBeLessThanOrEqual(now + hourInMs + 1000); // Allow 1 second tolerance
    });

    it('should use custom cookie name in Set-Cookie header', async () => {
      mockSignInEmail.mockResolvedValue({
        user: mockBetterAuthUser,
        token: 'session-token',
      });

      const auth = new MastraAuthBetterAuth({
        ...validConfig,
        session: { cookieName: 'my_session' },
      });

      const result = await auth.credentials.signIn('test@example.com', 'password123');

      expect(result.cookies['Set-Cookie']).toContain('my_session=');
    });
  });
});
