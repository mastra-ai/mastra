import { jwtVerify, createRemoteJWKSet } from 'jose';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { MastraAuthAuth0 } from './index';

// Mock jose library
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('MastraAuthAuth0', () => {
  beforeEach(() => {
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com';
    process.env.AUTH0_AUDIENCE = 'test-audience';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
  });

  describe('constructor', () => {
    test('initializes with environment variables', () => {
      const auth0 = new MastraAuthAuth0();
      expect(auth0['domain']).toBe('test-domain.auth0.com');
      expect(auth0['audience']).toBe('test-audience');
    });

    test('initializes with provided options', () => {
      const auth0 = new MastraAuthAuth0({
        domain: 'custom-domain.auth0.com',
        audience: 'custom-audience',
      });
      expect(auth0['domain']).toBe('custom-domain.auth0.com');
      expect(auth0['audience']).toBe('custom-audience');
    });

    test('throws error when domain is missing', () => {
      delete process.env.AUTH0_DOMAIN;
      expect(() => new MastraAuthAuth0()).toThrow();
    });

    test('throws error when audience is missing', () => {
      delete process.env.AUTH0_AUDIENCE;
      expect(() => new MastraAuthAuth0()).toThrow();
    });
  });

  describe('authenticateToken', () => {
    test('verifies JWT and returns payload', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'user123', permissions: ['read'] },
      });

      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authenticateToken('test-token');

      expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://test-domain.auth0.com/.well-known/jwks.json'));
      expect(jwtVerify).toHaveBeenCalledWith('test-token', mockJWKS, {
        issuer: 'https://test-domain.auth0.com/',
        audience: 'test-audience',
      });
      expect(result).toEqual({ sub: 'user123', permissions: ['read'] });
    });

    test('handles JWT verification failure', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid token'));

      const auth0 = new MastraAuthAuth0();
      await expect(auth0.authenticateToken('invalid-token')).rejects.toThrow('Invalid token');
    });
  });

  describe('authorizeUser', () => {
    test('returns true for valid user', async () => {
      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authorizeUser({ sub: 'user123' });
      expect(result).toBe(true);
    });

    test('returns false for null/undefined user', async () => {
      const auth0 = new MastraAuthAuth0();
      const result = await auth0.authorizeUser(null as any);
      expect(result).toBe(false);
    });

    test('can be overridden with custom authorization logic', async () => {
      const auth0 = new MastraAuthAuth0({
        async authorizeUser(user: any): Promise<boolean> {
          // Custom authorization logic that checks for specific permissions
          return user?.permissions?.includes('admin') ?? false;
        },
      });

      // Test with admin user
      const adminUser = { sub: 'user123', permissions: ['admin'] };
      expect(await auth0.authorizeUser(adminUser)).toBe(true);

      // Test with non-admin user
      const regularUser = { sub: 'user456', permissions: ['read'] };
      expect(await auth0.authorizeUser(regularUser)).toBe(false);

      // Test with user without permissions
      const noPermissionsUser = { sub: 'user789' };
      expect(await auth0.authorizeUser(noPermissionsUser)).toBe(false);
    });
  });
});
