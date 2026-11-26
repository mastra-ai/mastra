import type { JwtPayload } from '@mastra/auth';
import { verifyJwks } from '@mastra/auth';
import { sessionEncryption } from '@workos/authkit-session';
import type { User } from '@workos-inc/node';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { workosSdkMock } from './_types/workos-sdk-mock';
import { MastraAuthWorkos } from './index';

// One shared mock for the WorkOS SDK, registered identically by every test file
// in this package. The package runs with `isolate: false`, so the first file to
// import the SDK decides the mock that every later file receives — two
// different mocks made the suites depend on which file ran first. See
// ./_types/workos-sdk-mock.ts.
vi.mock('@workos-inc/node');

const mockWorkOSConstructor = workosSdkMock.construct;
const mockListOrganizationMemberships = workosSdkMock.userManagement.listOrganizationMemberships;
const mockGetUser = workosSdkMock.userManagement.getUser;
const mockCreateOrganizationMembership = workosSdkMock.userManagement.createOrganizationMembership;
const mockCreateOrganization = workosSdkMock.organizations.createOrganization;
const mockGetOrganizationByExternalId = workosSdkMock.organizations.getOrganizationByExternalId;
const mockAuthenticateWithCode = workosSdkMock.userManagement.authenticateWithCode;

// Mock the verifyJwks function
vi.mock('@mastra/auth', () => ({
  verifyJwks: vi.fn().mockResolvedValue({
    sub: 'user123',
    email: 'test@example.com',
  } as JwtPayload),
}));

// Mock @workos/authkit-session
const mockWithAuth = vi.fn();
vi.mock('@workos/authkit-session', async () => {
  const actual = await vi.importActual<typeof import('@workos/authkit-session')>('@workos/authkit-session');
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
    // Keep the real seal/unseal implementation: the handleCallback regression
    // we cover is its behaviour on the user payload (see the handleCallback suite).
    sessionEncryption: actual.sessionEncryption,
  };
});

describe('MastraAuthWorkos', () => {
  const mockApiKey = 'test-api-key';
  const mockClientId = 'test-client-id';
  const mockRedirectUri = 'https://example.com/auth/callback';
  const mockCookiePassword = 'test-cookie-password-at-least-32-chars';

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockReset();
    mockListOrganizationMemberships.mockReset();
    mockGetUser.mockReset();
    mockCreateOrganizationMembership.mockReset();
    mockCreateOrganization.mockReset();
    mockGetOrganizationByExternalId.mockReset();
    mockAuthenticateWithCode.mockReset();
    vi.mocked(verifyJwks).mockReset();
    // Reset environment variables
    delete process.env.WORKOS_API_KEY;
    delete process.env.WORKOS_CLIENT_ID;
    delete process.env.WORKOS_REDIRECT_URI;
    delete process.env.WORKOS_COOKIE_PASSWORD;
    // Reset default mock behavior
    const memberships = [{ role: { slug: 'admin' } }, { role: { slug: 'member' } }];
    mockListOrganizationMemberships.mockResolvedValue({
      data: memberships,
      autoPagination: vi.fn().mockResolvedValue(memberships),
    });
    vi.mocked(verifyJwks).mockResolvedValue({
      sub: 'user123',
      email: 'test@example.com',
    } as JwtPayload);
    mockGetUser.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profilePictureUrl: null,
      emailVerified: true,
      createdAt: new Date().toISOString(),
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

    it('should defer redirect URI resolution to init()/getLoginUrl when not provided', async () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        session: { cookiePassword: mockCookiePassword },
      });

      // Unresolvable without a publicUrl: both init() and getLoginUrl() fail clearly.
      await expect(auth.init({})).rejects.toThrow('could not resolve a callback URL');
      expect(() => auth.getLoginUrl('', 'state')).toThrow('WorkOS redirect URI is required');

      // Resolvable from the host's publicUrl.
      await auth.init({ publicUrl: 'https://factory.example.com' });
      expect(auth.getRedirectUri()).toBe('https://factory.example.com/auth/callback');
    });

    it('should wire mapUserToResourceId from options', () => {
      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        mapUserToResourceId: user => `tenant:${user.id}`,
      });

      expect(auth.mapUserToResourceId?.({ id: 'user-1', workosId: 'wos_1', email: 'a@b.com' } as any)).toBe(
        'tenant:user-1',
      );
    });
  });

  describe('handleCallback', () => {
    const createAuth = () =>
      new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

    const buildUser = (lastSignInAt: Date | null): User => ({
      object: 'user',
      id: 'user_01H',
      email: 'ada@example.com',
      emailVerified: true,
      profilePictureUrl: 'https://example.com/ada.png',
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      lastSignInAt,
      locale: 'en-US',
      createdAt: new Date('2025-12-31T23:59:59.000Z'),
      updatedAt: new Date('2026-01-02T03:04:05.678Z'),
      externalId: 'external-123',
      metadata: { plan: 'pro' },
    });

    const buildAuthResponse = (user: User) => ({
      user,
      organizationId: 'org_01H',
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      impersonator: { email: 'admin@example.com', reason: 'support' },
    });

    const readCookie = (cookies: string[] | undefined) => {
      expect(cookies).toHaveLength(1);
      const cookie = cookies![0];
      const [pair, ...attributes] = cookie.split('; ');
      const separator = pair.indexOf('=');
      return {
        name: pair.slice(0, separator),
        value: pair.slice(separator + 1),
        attributes,
      };
    };

    // The WorkOS Node SDK v12 returns `Date` objects for `createdAt`, `updatedAt`
    // and `lastSignInAt`. iron-webcrypto (used by @workos/authkit-session's
    // sessionEncryption) throws "Data is not JSON serializable" on `Date`, so
    // sealing the raw session payload used to fail before handleCallback could
    // return the session cookie.
    it.each([
      ['a populated lastSignInAt', new Date('2026-01-01T00:00:00.000Z')],
      ['a null lastSignInAt', null],
    ])('seals the session when the user has %s', async (_label, lastSignInAt) => {
      const user = buildUser(lastSignInAt);
      mockAuthenticateWithCode.mockResolvedValue(buildAuthResponse(user));

      const auth = createAuth();
      const result = await auth.handleCallback('auth-code', 'state-value');

      // The code exchange happened exactly once, with the configured client.
      expect(mockAuthenticateWithCode).toHaveBeenCalledTimes(1);
      expect(mockAuthenticateWithCode).toHaveBeenCalledWith({
        clientId: mockClientId,
        code: 'auth-code',
      });

      // The WorkOS user is mapped to the EEUser identity unchanged.
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        name: 'Ada Lovelace',
        avatarUrl: 'https://example.com/ada.png',
        metadata: {
          workosId: user.id,
          emailVerified: true,
          createdAt: user.createdAt,
        },
        workosId: user.id,
        organizationId: 'org_01H',
      });
      expect(result.tokens).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });

      // The cookie carries the sealed session with the existing attributes.
      const cookie = readCookie(result.cookies);
      expect(cookie.name).toBe('wos_session');
      expect(cookie.value.length).toBeGreaterThan(0);
      expect(cookie.attributes).toContain('Path=/');
      expect(cookie.attributes).toContain('HttpOnly');
      expect(cookie.attributes).toContain('SameSite=Lax');

      // The cookie round-trips through the real seal/unseal implementation.
      const session = await sessionEncryption.unsealData<{
        accessToken: string;
        refreshToken: string;
        user: User;
        organizationId?: string;
        impersonator?: { email: string; reason: string | null };
      }>(cookie.value, { password: mockCookiePassword });

      expect(session.accessToken).toBe('access-token-123');
      expect(session.refreshToken).toBe('refresh-token-456');
      expect(session.organizationId).toBe('org_01H');
      expect(session.impersonator).toEqual({ email: 'admin@example.com', reason: 'support' });

      // Every user field survives the round-trip, with the three Date fields
      // normalized to ISO strings (lastSignInAt stays null when it was null).
      expect(session.user).toEqual({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastSignInAt: lastSignInAt?.toISOString() ?? null,
      });
      expect(session.user.createdAt).toBe(user.createdAt.toISOString());
      expect(session.user.updatedAt).toBe(user.updatedAt.toISOString());
      expect(session.user.lastSignInAt).toBe(lastSignInAt?.toISOString() ?? null);

      // Normalization must not mutate the fixture the SDK handed us.
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
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

    describe('session organization inference', () => {
      const createAuth = (fetchMemberships: boolean) =>
        new MastraAuthWorkos({
          apiKey: mockApiKey,
          clientId: mockClientId,
          redirectUri: mockRedirectUri,
          session: { cookiePassword: mockCookiePassword },
          fetchMemberships,
        });

      const mockSession = (organizationId?: string) =>
        mockWithAuth.mockResolvedValueOnce({
          auth: { user: { id: 'user123', email: 'test@example.com' }, organizationId },
        });

      const mockMemberships = (memberships: unknown[]) =>
        mockListOrganizationMemberships.mockResolvedValueOnce({
          data: memberships,
          autoPagination: vi.fn().mockResolvedValue(memberships),
        });

      it('should infer organizationId from a single membership when the session has none', async () => {
        mockSession();
        const memberships = [{ id: 'om-1', organizationId: 'org-1', role: { slug: 'member' } }];
        mockMemberships(memberships);

        const result = await createAuth(true).authenticateToken('', mockRequest);

        expect(result?.organizationId).toBe('org-1');
        expect(result?.memberships).toEqual(memberships);
      });

      it('should not infer organizationId from multiple memberships', async () => {
        mockSession();
        mockMemberships([
          { id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } },
          { id: 'om-2', organizationId: 'org-2', role: { slug: 'member' } },
        ]);

        const result = await createAuth(true).authenticateToken('', mockRequest);

        expect(result?.organizationId).toBeUndefined();
      });

      it('should not infer organizationId when there are no memberships', async () => {
        mockSession();
        mockMemberships([]);

        const result = await createAuth(true).authenticateToken('', mockRequest);

        expect(result?.organizationId).toBeUndefined();
      });

      it('should keep the session user without organizationId when the membership fetch fails', async () => {
        mockSession();
        mockListOrganizationMemberships.mockRejectedValueOnce(new Error('membership API unavailable'));

        const result = await createAuth(true).authenticateToken('', mockRequest);

        expect(result).toMatchObject({ workosId: 'user123' });
        expect(result?.organizationId).toBeUndefined();
        expect(result?.memberships).toBeUndefined();
      });

      it('should keep the session organizationId over a single membership', async () => {
        mockSession('org-explicit');
        mockMemberships([{ id: 'om-1', organizationId: 'org-1', role: { slug: 'member' } }]);

        const result = await createAuth(true).authenticateToken('', mockRequest);

        expect(result?.organizationId).toBe('org-explicit');
      });

      it('should not fetch memberships or infer organizationId when fetchMemberships is disabled', async () => {
        mockSession();

        const result = await createAuth(false).authenticateToken('', mockRequest);

        expect(mockListOrganizationMemberships).not.toHaveBeenCalled();
        expect(result?.organizationId).toBeUndefined();
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

    it('should not merge configured JWT organization claims onto a fetched WorkOS user by default', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'user123',
        org_id: 'org_123',
        'urn:mastra:organization_membership_id': 'om_123',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        jwtClaims: {
          organizationMembershipId: 'urn:mastra:organization_membership_id',
        },
        mapJwtPayloadToUser: () => ({
          memberships: [{ id: 'om_123', organizationId: 'org_123' }],
        }),
      });

      const result = await auth.authenticateToken('valid-token', mockRequest);

      expect(mockGetUser).toHaveBeenCalledWith('user123');
      expect(result).toMatchObject({
        id: 'user123',
        workosId: 'user123',
      });
      expect(result?.organizationId).toBeUndefined();
      expect(result?.organizationMembershipId).toBeUndefined();
      expect(result?.memberships).toBeUndefined();
    });

    it('should trust configured JWT claims for service tokens when getUser lookup does not apply', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      mockGetUser.mockRejectedValueOnce(new Error('not a WorkOS user'));
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'svc_automation',
        email: 'automation@example.com',
        org_id: 'org_service',
        'urn:mastra:organization_membership_id': 'om_service',
        'urn:mastra:team_id': 'team_a',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        trustJwtClaims: true,
        jwtClaims: {
          organizationMembershipId: 'urn:mastra:organization_membership_id',
        },
      });

      const result = await auth.authenticateToken('service-token', mockRequest);

      expect(result).toMatchObject({
        id: 'svc_automation',
        workosId: 'svc_automation',
        email: 'automation@example.com',
        organizationId: 'org_service',
        organizationMembershipId: 'om_service',
      });
      expect((result as any)?.['urn:mastra:team_id']).toBe('team_a');
    });

    it('should keep bearer-token auth when optional membership enrichment fails', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      mockListOrganizationMemberships.mockRejectedValueOnce(new Error('membership API unavailable'));
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'user123',
        email: 'test@example.com',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const result = await auth.authenticateToken('valid-token', mockRequest);

      expect(result).toMatchObject({
        id: 'user123',
        workosId: 'user123',
      });
      expect(result?.memberships).toBeUndefined();
    });

    it('should not infer organizationId from multiple fetched memberships during bearer-token auth', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: { user: null },
      });
      const memberships = [
        { id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } },
        { id: 'om-2', organizationId: 'org-2', role: { slug: 'member' } },
      ];
      mockListOrganizationMemberships.mockResolvedValueOnce({
        data: memberships,
        autoPagination: vi.fn().mockResolvedValue(memberships),
      });
      vi.mocked(verifyJwks).mockResolvedValueOnce({
        sub: 'user123',
        email: 'test@example.com',
      } as JwtPayload);

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const result = await auth.authenticateToken('valid-token', mockRequest);

      expect(result?.organizationId).toBeUndefined();
      expect(result?.memberships).toEqual(memberships);
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

  describe('getCurrentUser', () => {
    it('should not fetch memberships when fetchMemberships is disabled', async () => {
      mockWithAuth.mockResolvedValueOnce({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: undefined,
        },
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

      const user = await auth.getCurrentUser(new Request('https://example.com'));

      expect(user).toMatchObject({
        id: 'user123',
        workosId: 'user123',
      });
      expect(mockListOrganizationMemberships).not.toHaveBeenCalled();
    });

    it('should cache memberships across repeated requests when fetchMemberships is enabled', async () => {
      mockWithAuth.mockResolvedValue({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: undefined,
        },
      });
      const memberships = [{ id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } }];
      const autoPagination = vi.fn().mockResolvedValue(memberships);
      mockListOrganizationMemberships.mockResolvedValue({
        data: memberships,
        autoPagination,
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const firstUser = await auth.getCurrentUser(new Request('https://example.com/one'));
      const secondUser = await auth.getCurrentUser(new Request('https://example.com/two'));

      expect(firstUser).toMatchObject({
        organizationId: 'org-1',
        memberships: [{ id: 'om-1', organizationId: 'org-1' }],
      });
      expect(secondUser).toMatchObject({
        organizationId: 'org-1',
        memberships: [{ id: 'om-1', organizationId: 'org-1' }],
      });
      expect(mockListOrganizationMemberships).toHaveBeenCalledTimes(1);
      expect(autoPagination).toHaveBeenCalledTimes(1);
    });

    it('should cache the full auto-paginated memberships when fetchMemberships is enabled', async () => {
      mockWithAuth.mockResolvedValue({
        auth: {
          user: { id: 'user123', email: 'test@example.com' },
          organizationId: undefined,
        },
      });
      const firstPageMemberships = [{ id: 'om-1', organizationId: 'org-1', role: { slug: 'admin' } }];
      const allMemberships = [
        ...firstPageMemberships,
        { id: 'om-2', organizationId: 'org-2', role: { slug: 'member' } },
      ];
      const autoPagination = vi.fn().mockResolvedValue(allMemberships);
      mockListOrganizationMemberships.mockResolvedValue({
        data: firstPageMemberships,
        autoPagination,
      });

      const auth = new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
        fetchMemberships: true,
      });

      const firstUser = await auth.getCurrentUser(new Request('https://example.com/one'));
      const secondUser = await auth.getCurrentUser(new Request('https://example.com/two'));

      expect(firstUser?.organizationId).toBeUndefined();
      expect(firstUser).toMatchObject({
        memberships: [
          { id: 'om-1', organizationId: 'org-1' },
          { id: 'om-2', organizationId: 'org-2' },
        ],
      });
      expect(secondUser?.organizationId).toBeUndefined();
      expect(secondUser).toMatchObject({
        memberships: [
          { id: 'om-1', organizationId: 'org-1' },
          { id: 'om-2', organizationId: 'org-2' },
        ],
      });
      expect(mockListOrganizationMemberships).toHaveBeenCalledTimes(1);
      expect(autoPagination).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureOrganization', () => {
    const makeAuth = () =>
      new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

    const seedMemberships = (memberships: any[]) => {
      mockListOrganizationMemberships.mockResolvedValue({
        data: memberships,
        autoPagination: vi.fn().mockResolvedValue(memberships),
      });
    };

    it('returns the existing org without creating one when the user has a membership', async () => {
      seedMemberships([{ id: 'om-1', organizationId: 'org-existing', role: { slug: 'member' } }]);

      const orgId = await makeAuth().ensureOrganization('user_1');

      expect(orgId).toBe('org-existing');
      expect(mockCreateOrganization).not.toHaveBeenCalled();
      expect(mockCreateOrganizationMembership).not.toHaveBeenCalled();
    });

    it('creates a personal org + membership with a stable idempotency key when the user has none', async () => {
      seedMemberships([]);
      mockCreateOrganization.mockResolvedValue({ id: 'org-new' });
      mockCreateOrganizationMembership.mockResolvedValue({ id: 'om-new' });

      const orgId = await makeAuth().ensureOrganization('user_1');

      expect(orgId).toBe('org-new');
      expect(mockCreateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({ externalId: 'user_1', name: "test@example.com's org" }),
        { idempotencyKey: 'mastra-personal-org:user_1' },
      );
      expect(mockCreateOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org-new',
        userId: 'user_1',
      });
    });

    it('recovers the existing org when create fails with external_id_already_used', async () => {
      seedMemberships([]);
      mockCreateOrganization.mockRejectedValue({ code: 'external_id_already_used' });
      mockGetOrganizationByExternalId.mockResolvedValue({ id: 'org-recovered' });
      mockCreateOrganizationMembership.mockResolvedValue({ id: 'om-new' });

      const orgId = await makeAuth().ensureOrganization('user_1');

      expect(orgId).toBe('org-recovered');
      expect(mockGetOrganizationByExternalId).toHaveBeenCalledWith('user_1');
      expect(mockCreateOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org-recovered',
        userId: 'user_1',
      });
    });

    it('tolerates organization_membership_already_exists on the membership step', async () => {
      seedMemberships([]);
      mockCreateOrganization.mockResolvedValue({ id: 'org-new' });
      mockCreateOrganizationMembership.mockRejectedValue({
        rawData: { code: 'organization_membership_already_exists' },
      });

      await expect(makeAuth().ensureOrganization('user_1')).resolves.toBe('org-new');
    });

    it('returns undefined instead of throwing when WorkOS rejects the bootstrap', async () => {
      seedMemberships([]);
      mockCreateOrganization.mockRejectedValue(new Error('forbidden'));

      await expect(makeAuth().ensureOrganization('user_1')).resolves.toBeUndefined();
    });
  });

  describe('isOrganizationAdmin', () => {
    const makeAuth = () =>
      new MastraAuthWorkos({
        apiKey: mockApiKey,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        session: { cookiePassword: mockCookiePassword },
      });

    const seedMemberships = (memberships: any[]) => {
      mockListOrganizationMemberships.mockResolvedValue({
        data: memberships,
        autoPagination: vi.fn().mockResolvedValue(memberships),
      });
    };

    it('accepts legacy single-role admin and owner slugs', async () => {
      seedMemberships([{ organizationId: 'org-1', role: { slug: 'admin' } }]);
      expect(await makeAuth().isOrganizationAdmin('org-1', 'user_1')).toBe(true);

      seedMemberships([{ organizationId: 'org-1', role: { slug: 'owner' } }]);
      expect(await makeAuth().isOrganizationAdmin('org-1', 'user_1')).toBe(true);
    });

    it('prefers the multi-role roles array over the legacy role field', async () => {
      seedMemberships([{ organizationId: 'org-1', role: { slug: 'member' }, roles: [{ slug: 'owner' }] }]);
      expect(await makeAuth().isOrganizationAdmin('org-1', 'user_1')).toBe(true);
    });

    it('rejects non-admin members, other orgs, and provider errors', async () => {
      seedMemberships([{ organizationId: 'org-1', role: { slug: 'member' } }]);
      expect(await makeAuth().isOrganizationAdmin('org-1', 'user_1')).toBe(false);
      expect(await makeAuth().isOrganizationAdmin('org-other', 'user_1')).toBe(false);

      mockListOrganizationMemberships.mockRejectedValue(new Error('boom'));
      expect(await makeAuth().isOrganizationAdmin('org-1', 'user_1')).toBe(false);
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
