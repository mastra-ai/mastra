import { createRemoteJWKSet, jwtVerify } from 'jose';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

import { MastraAuthOkta } from './auth-provider';
import { MastraRBACOkta } from './rbac-provider';
import type { OktaUser } from './types';

// Mock jose library
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

// Mock Okta SDK - use class syntax for proper constructor behavior
const mockListUserGroups = vi.fn();
vi.mock('@okta/okta-sdk-nodejs', () => ({
  default: {
    Client: class MockOktaClient {
      userApi = {
        listUserGroups: mockListUserGroups,
      };
    },
  },
}));

describe('MastraAuthOkta', () => {
  beforeEach(() => {
    process.env.OKTA_DOMAIN = 'dev-123456.okta.com';
    process.env.OKTA_CLIENT_ID = 'test-client-id';
    process.env.OKTA_CLIENT_SECRET = 'test-client-secret';
    process.env.OKTA_REDIRECT_URI = 'http://localhost:4111/api/auth/callback';
    process.env.OKTA_COOKIE_PASSWORD = 'test-cookie-password-must-be-32-chars-long';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.OKTA_DOMAIN;
    delete process.env.OKTA_CLIENT_ID;
    delete process.env.OKTA_CLIENT_SECRET;
    delete process.env.OKTA_REDIRECT_URI;
    delete process.env.OKTA_COOKIE_PASSWORD;
    delete process.env.OKTA_ISSUER;
  });

  describe('constructor', () => {
    test('initializes with environment variables', () => {
      const auth = new MastraAuthOkta();
      expect(auth['domain']).toBe('dev-123456.okta.com');
      expect(auth['clientId']).toBe('test-client-id');
      expect(auth['issuer']).toBe('https://dev-123456.okta.com/oauth2/default');
    });

    test('initializes with provided options', () => {
      const auth = new MastraAuthOkta({
        domain: 'custom.okta.com',
        clientId: 'custom-client-id',
        clientSecret: 'custom-secret',
        redirectUri: 'http://localhost/callback',
        issuer: 'https://custom.okta.com/oauth2/custom',
        session: { cookiePassword: 'custom-password-must-be-32-chars-long' },
      });
      expect(auth['domain']).toBe('custom.okta.com');
      expect(auth['clientId']).toBe('custom-client-id');
      expect(auth['issuer']).toBe('https://custom.okta.com/oauth2/custom');
    });

    test('throws error when client secret is missing', () => {
      delete process.env.OKTA_CLIENT_SECRET;
      expect(() => new MastraAuthOkta()).toThrow('Okta client secret is required');
    });

    test('throws error when redirect URI is missing', () => {
      delete process.env.OKTA_REDIRECT_URI;
      expect(() => new MastraAuthOkta()).toThrow('Okta redirect URI is required');
    });

    test('throws error when domain is missing', () => {
      delete process.env.OKTA_DOMAIN;
      expect(() => new MastraAuthOkta()).toThrow('Okta domain is required');
    });

    test('throws error when client ID is missing', () => {
      delete process.env.OKTA_CLIENT_ID;
      expect(() => new MastraAuthOkta()).toThrow('Okta client ID is required');
    });
  });

  describe('authenticateToken', () => {
    test('verifies JWT and returns user', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: {
          sub: 'okta-user-123',
          email: 'test@example.com',
          name: 'Test User',
          groups: ['Engineering', 'Admin'],
        },
      });

      const auth = new MastraAuthOkta();
      const result = await auth.authenticateToken('test-token', {} as any);

      expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://dev-123456.okta.com/oauth2/default/v1/keys'));
      expect(jwtVerify).toHaveBeenCalledWith('test-token', mockJWKS, {
        issuer: 'https://dev-123456.okta.com/oauth2/default',
        audience: 'test-client-id',
      });
      expect(result).toEqual({
        id: 'okta-user-123',
        oktaId: 'okta-user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: undefined,
        groups: ['Engineering', 'Admin'],
        metadata: {
          oktaId: 'okta-user-123',
          emailVerified: undefined,
          updatedAt: undefined,
        },
      });
    });

    test('returns null for invalid token', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Invalid token'));

      const auth = new MastraAuthOkta();
      const result = await auth.authenticateToken('invalid-token', {} as any);
      expect(result).toBeNull();
    });

    test('returns null for empty token', async () => {
      const auth = new MastraAuthOkta();
      expect(await auth.authenticateToken('', {} as any)).toBeNull();
      expect(await auth.authenticateToken(null as any, {} as any)).toBeNull();
    });
  });

  describe('authorizeUser', () => {
    test('returns true for valid user', () => {
      const auth = new MastraAuthOkta();
      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        email: 'test@example.com',
      };
      expect(auth.authorizeUser(user, {} as any)).toBe(true);
    });

    test('returns false for null user', () => {
      const auth = new MastraAuthOkta();
      expect(auth.authorizeUser(null as any, {} as any)).toBe(false);
    });

    test('returns false for user without oktaId', () => {
      const auth = new MastraAuthOkta();
      const user = { id: 'user-123' } as any;
      expect(auth.authorizeUser(user, {} as any)).toBe(false);
    });
  });

  describe('getUser', () => {
    test('returns user from Okta Users API when apiToken is set', async () => {
      const auth = new MastraAuthOkta({ apiToken: 'test-api-token' });

      const mockResponse = {
        ok: true,
        json: async () => ({
          id: '00u123',
          profile: { login: 'user@example.com', email: 'user@example.com', firstName: 'Test', lastName: 'User' },
        }),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      const user = await auth.getUser('00u123');
      expect(user).toEqual({
        id: '00u123',
        oktaId: '00u123',
        email: 'user@example.com',
        name: 'Test User',
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://dev-123456.okta.com/api/v1/users/00u123',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'SSWS test-api-token' }) }),
      );
    });

    test('returns null when no apiToken is configured', async () => {
      const auth = new MastraAuthOkta();
      delete process.env.OKTA_API_TOKEN;
      const user = await (auth as any).getUser('00u123');
      expect(user).toBeNull();
    });

    test('returns null when user is not found', async () => {
      const auth = new MastraAuthOkta({ apiToken: 'test-api-token' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 404 } as any);
      const user = await auth.getUser('nonexistent');
      expect(user).toBeNull();
    });
  });
});

describe('MastraRBACOkta', () => {
  beforeEach(() => {
    process.env.OKTA_DOMAIN = 'dev-123456.okta.com';
    process.env.OKTA_API_TOKEN = 'test-api-token';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.OKTA_DOMAIN;
    delete process.env.OKTA_API_TOKEN;
  });

  describe('constructor', () => {
    test('initializes with environment variables', () => {
      const rbac = new MastraRBACOkta({
        roleMapping: { Admin: ['*'] },
      });
      expect(rbac.roleMapping).toEqual({ Admin: ['*'] });
    });

    test('throws error when domain is missing', () => {
      delete process.env.OKTA_DOMAIN;
      expect(() => new MastraRBACOkta({ roleMapping: { Admin: ['*'] } })).toThrow('Okta domain is required');
    });

    test('throws error when API token is missing', () => {
      delete process.env.OKTA_API_TOKEN;
      expect(() => new MastraRBACOkta({ roleMapping: { Admin: ['*'] } })).toThrow('Okta API token is required');
    });
  });

  describe('getRoles', () => {
    test('returns groups from user object if present', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: { Admin: ['*'] },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Engineering', 'Admin'],
      };

      const roles = await rbac.getRoles(user);
      expect(roles).toEqual(['Engineering', 'Admin']);
    });
  });

  describe('getPermissions', () => {
    test('resolves permissions from role mapping', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Engineering: ['agents:*', 'workflows:*'],
          Admin: ['*'],
          _default: [],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Engineering'],
      };

      const permissions = await rbac.getPermissions(user);
      expect(permissions).toContain('agents:*');
      expect(permissions).toContain('workflows:*');
    });

    test('uses _default for unmapped roles', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Admin: ['*'],
          _default: ['agents:read'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['UnknownGroup'],
      };

      const permissions = await rbac.getPermissions(user);
      expect(permissions).toContain('agents:read');
    });
  });

  describe('hasRole', () => {
    test('returns true when user has role', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: { Admin: ['*'] },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Engineering', 'Admin'],
      };

      expect(await rbac.hasRole(user, 'Admin')).toBe(true);
      expect(await rbac.hasRole(user, 'Engineering')).toBe(true);
    });

    test('returns false when user does not have role', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: { Admin: ['*'] },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Engineering'],
      };

      expect(await rbac.hasRole(user, 'Admin')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    test('returns true when user has permission', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Admin: ['*'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Admin'],
      };

      expect(await rbac.hasPermission(user, 'agents:read')).toBe(true);
      expect(await rbac.hasPermission(user, 'workflows:create')).toBe(true);
    });

    test('returns false when user lacks permission', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Viewer: ['agents:read'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Viewer'],
      };

      expect(await rbac.hasPermission(user, 'agents:read')).toBe(true);
      expect(await rbac.hasPermission(user, 'agents:create')).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    test('returns true when user has all permissions', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Engineering: ['agents:*', 'workflows:*'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Engineering'],
      };

      expect(await rbac.hasAllPermissions(user, ['agents:read', 'workflows:read'])).toBe(true);
    });

    test('returns false when user lacks some permissions', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Viewer: ['agents:read'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Viewer'],
      };

      expect(await rbac.hasAllPermissions(user, ['agents:read', 'agents:create'])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    test('returns true when user has at least one permission', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Viewer: ['agents:read'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Viewer'],
      };

      expect(await rbac.hasAnyPermission(user, ['agents:read', 'agents:create'])).toBe(true);
    });

    test('returns false when user has no matching permissions', async () => {
      const rbac = new MastraRBACOkta({
        roleMapping: {
          Viewer: ['agents:read'],
        },
      });

      const user: OktaUser = {
        id: 'user-123',
        oktaId: 'okta-user-123',
        groups: ['Viewer'],
      };

      expect(await rbac.hasAnyPermission(user, ['workflows:create', 'workflows:delete'])).toBe(false);
    });
  });

  describe('getUserId option', () => {
    test('uses custom getUserId function for cross-provider support', async () => {
      // Mock Okta API to return groups when called with the correct user ID
      mockListUserGroups.mockReturnValueOnce(
        (async function* () {
          yield { profile: { name: 'Admin' } };
        })(),
      );

      const rbac = new MastraRBACOkta({
        roleMapping: { Admin: ['*'] },
        getUserId: (user: any) => user.metadata?.oktaUserId,
      });

      // Simulate an Auth0 user with Okta ID in metadata — no pre-populated groups
      const auth0User = {
        id: 'auth0|123',
        oktaId: '',
        groups: [],
        metadata: {
          oktaUserId: 'okta-user-456',
        },
      } as OktaUser;

      const roles = await rbac.getRoles(auth0User);
      expect(roles).toEqual(['Admin']);
      // Verify getUserId resolved the correct Okta user ID for the API call
      expect(mockListUserGroups).toHaveBeenCalledWith({ userId: 'okta-user-456' });
    });
  });
});
