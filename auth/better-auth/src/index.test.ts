import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MastraAuthBetterAuth } from './index';

/**
 * Testing Strategy:
 *
 * We use a real in-memory SQLite database (via better-sqlite3) to test Better Auth integration.
 * Using ':memory:' creates a fresh database for each test, ensuring isolation.
 *
 * Approach: Hybrid testing
 * - Real SQLite database for Better Auth initialization
 * - Spy on auth.api.getSession for session validation tests
 * - Tests our wrapper logic without complex end-to-end flows
 *
 * Note on better-sqlite3 native bindings:
 * If you encounter "Could not locate the bindings file" errors, compile the native module:
 *
 *   cd node_modules/.pnpm/better-sqlite3@<version>/node_modules/better-sqlite3
 *   npm run build-release
 *
 * This compiles the C++ bindings for your platform. The build requires:
 * - C++ compiler (gcc/clang on Linux/Mac, MSVC on Windows)
 * - Python 3.x
 * - node-gyp
 *
 */
describe('MastraAuthBetterAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getMockAuthOptions = () => {
    const db = new Database(':memory:');
    return {
      database: db as any,
      emailAndPassword: {
        enabled: true,
      },
    };
  };

  it('should create instance with valid options', () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    expect(authProvider).toBeInstanceOf(MastraAuthBetterAuth);
    expect(authProvider['auth']).toBeDefined();
  });

  it('should throw error without authOptions', () => {
    expect(() => {
      new MastraAuthBetterAuth({
        authOptions: undefined as any,
      });
    }).toThrow('Better Auth configuration is required');
  });

  it('should use default name', () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    expect(authProvider).toBeDefined();
  });

  it('should return null for invalid token', async () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    vi.spyOn(authProvider['auth'].api, 'getSession').mockResolvedValue(null as any);

    const result = await authProvider.authenticateToken('invalid-token');
    expect(result).toBeNull();
  });

  it('should authenticate valid token and return user with session', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
      token: 'valid-token',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    vi.spyOn(authProvider['auth'].api, 'getSession').mockResolvedValue({
      user: mockUser,
      session: mockSession,
    } as any);

    const result = await authProvider.authenticateToken('valid-token');
    expect(result).toEqual({ ...mockUser, session: mockSession });
  });

  it('should reject expired sessions', async () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    const expiredUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      session: {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        token: 'token',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const isAuthorized = await authProvider.authorizeUser(expiredUser);
    expect(isAuthorized).toBe(false);
  });

  it('should authorize valid sessions', async () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    const validUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      session: {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000), // Expires in 1 day
        token: 'token',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const isAuthorized = await authProvider.authorizeUser(validUser);
    expect(isAuthorized).toBe(true);
  });

  it('should use custom validateSession function', async () => {
    const mockValidate = vi.fn().mockResolvedValue(false);

    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
      validateSession: mockValidate,
    });

    const validUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
      session: {
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        token: 'token',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const isAuthorized = await authProvider.authorizeUser(validUser);

    expect(mockValidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ id: 'session-1' }),
    );
    expect(isAuthorized).toBe(false);
  });

  it('should reject authorization for user without session', async () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    const userWithoutSession = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      session: null as any,
    };

    const isAuthorized = await authProvider.authorizeUser(userWithoutSession);
    expect(isAuthorized).toBe(false);
  });

  it('should get session from headers', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSession = {
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
      token: 'session-token',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    const getSessionSpy = vi.spyOn(authProvider['auth'].api, 'getSession').mockResolvedValue({
      user: mockUser,
      session: mockSession,
    } as any);

    const headers = new Headers();
    headers.set('cookie', 'better-auth.session_token=session-token');

    const result = await authProvider.getSessionFromHeaders(headers);
    expect(result).toEqual({ ...mockUser, session: mockSession });
    expect(getSessionSpy).toHaveBeenCalledWith({ headers });
  });

  it('should return null when getSessionFromHeaders fails', async () => {
    const authProvider = new MastraAuthBetterAuth({
      authOptions: getMockAuthOptions(),
    });

    vi.spyOn(authProvider['auth'].api, 'getSession').mockResolvedValue(null as any);

    const headers = new Headers();
    const result = await authProvider.getSessionFromHeaders(headers);
    expect(result).toBeNull();
  });
});
