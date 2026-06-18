import { generateKeyPairSync } from 'node:crypto';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraAuthGoogle } from './auth-provider';
import { MastraRBACGoogle } from './rbac-provider';
import type { GoogleUser } from './types';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

const mockFetch = vi.fn();
const cookiePassword = 'google-cookie-password-must-be-at-least-32-chars';

describe('MastraAuthGoogle', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    (createRemoteJWKSet as any).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.GOOGLE_COOKIE_PASSWORD;
    delete process.env.GOOGLE_ALLOWED_DOMAINS;
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('initializes with environment variables', () => {
      process.env.GOOGLE_ALLOWED_DOMAINS = 'example.com, admin.example.com';
      const auth = new MastraAuthGoogle();

      expect(auth.getClientId()).toBe('test-client-id');
      expect(auth.getAllowedDomains()).toEqual(['example.com', 'admin.example.com']);
    });

    it('throws when client ID is missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      expect(() => new MastraAuthGoogle()).toThrow('Google client ID is required');
    });

    it('attaches SSO methods only when client secret is configured', () => {
      const tokenOnly = new MastraAuthGoogle();
      expect(tokenOnly.isSSOEnabled()).toBe(false);
      expect((tokenOnly as any).getLoginUrl).toBeUndefined();
      expect((tokenOnly as any).handleCallback).toBeUndefined();

      const sso = new MastraAuthGoogle({
        clientSecret: 'test-client-secret',
        session: { cookiePassword },
      });
      expect(sso.isSSOEnabled()).toBe(true);
      expect((sso as any).getLoginUrl).toBeDefined();
      expect((sso as any).handleCallback).toBeDefined();
    });

    it('throws when SSO cookie password is too short', () => {
      expect(
        () =>
          new MastraAuthGoogle({
            clientSecret: 'test-client-secret',
            session: { cookiePassword: 'short' },
          }),
      ).toThrow('Cookie password must be at least 32 characters');
    });

    it('throws in production when SSO cookie password is missing', () => {
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(
          () =>
            new MastraAuthGoogle({
              clientSecret: 'test-client-secret',
            }),
        ).toThrow('GOOGLE_COOKIE_PASSWORD is required');
      } finally {
        process.env.NODE_ENV = nodeEnv;
      }
    });
  });

  describe('SSO login and callback', () => {
    function createSsoAuth(allowedDomains: string | string[] = 'example.com') {
      return new MastraAuthGoogle({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        allowedDomains,
        session: { cookiePassword },
      }) as any;
    }

    it('builds a Google login URL with signed state, nonce, and hosted-domain hint', async () => {
      const auth = createSsoAuth();
      const url = await auth.getLoginUrl('http://localhost:4111/api/auth/sso/callback', 'test-state');
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('openid profile email');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:4111/api/auth/sso/callback');
      expect(parsed.searchParams.get('hd')).toBe('example.com');
      expect(parsed.searchParams.get('nonce')).toBeTruthy();
      expect(parsed.searchParams.get('state')?.split('.')).toHaveLength(2);
    });

    it('keeps the server redirect state visible while passing signed state to the callback', async () => {
      const auth = createSsoAuth();
      const url = await auth.getLoginUrl(
        'http://localhost:4111/api/auth/sso/callback',
        'server-state-id|%2Fstudio%3Ftab%3Dagents',
      );
      const parsed = new URL(url);
      const callbackState = parsed.searchParams.get('state')!;
      const [stateId, encodedRedirect] = callbackState.split('|', 2);

      expect(stateId?.split('.')).toHaveLength(2);
      expect(encodedRedirect).toBe('%2Fstudio%3Ftab%3Dagents');

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token', id_token: 'id-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'google-user-123',
          email: 'user@example.com',
          hd: 'example.com',
          nonce: parsed.searchParams.get('nonce'),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });

      await expect(auth.handleCallback('code', stateId)).resolves.toMatchObject({
        user: { id: 'google-user-123' },
      });
    });

    it('rejects a callback when the visible redirect state suffix was changed', async () => {
      const auth = createSsoAuth();
      const url = await auth.getLoginUrl(
        'http://localhost:4111/api/auth/sso/callback',
        'server-state-id|%2Fstudio',
      );
      const parsed = new URL(url);
      const stateId = parsed.searchParams.get('state')!.split('|', 1)[0]!;

      await expect(auth.handleCallback('code', `${stateId}|%2Fadmin`)).rejects.toThrow(
        'Invalid state redirect suffix',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles callback and creates a session cookie', async () => {
      const auth = createSsoAuth();
      const loginUrl = await auth.getLoginUrl('http://localhost/callback', 'test-state');
      const parsed = new URL(loginUrl);
      const state = parsed.searchParams.get('state')!;
      const nonce = parsed.searchParams.get('nonce')!;

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            id_token: 'id-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      (jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'google-user-123',
          email: 'user@example.com',
          email_verified: true,
          name: 'Test User',
          picture: 'https://example.com/avatar.png',
          hd: 'example.com',
          nonce,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });

      const result = await auth.handleCallback('code', state);

      expect(result.user).toMatchObject({
        id: 'google-user-123',
        googleId: 'google-user-123',
        email: 'user@example.com',
        hostedDomain: 'example.com',
      });
      expect(result.cookies?.[0]).toContain('google_session=');
      expect(result.cookies?.[0]).toContain('HttpOnly');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects invalid state', async () => {
      const auth = createSsoAuth();
      await expect(auth.handleCallback('code', 'bad-state')).rejects.toThrow('Invalid state token format');
    });

    it('rejects a callback with a bad nonce', async () => {
      const auth = createSsoAuth();
      const loginUrl = await auth.getLoginUrl('http://localhost/callback', 'test-state');
      const state = new URL(loginUrl).searchParams.get('state')!;

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token', id_token: 'id-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (jwtVerify as any).mockResolvedValueOnce({
        payload: { sub: 'u1', email: 'user@example.com', hd: 'example.com', nonce: 'wrong' },
      });

      await expect(auth.handleCallback('code', state)).rejects.toThrow('Invalid Google ID token nonce');
    });

    it('rejects missing hosted domain when allowed domains are configured', async () => {
      const auth = createSsoAuth();
      const loginUrl = await auth.getLoginUrl('http://localhost/callback', 'test-state');
      const state = new URL(loginUrl).searchParams.get('state')!;
      const nonce = new URL(loginUrl).searchParams.get('nonce')!;

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token', id_token: 'id-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (jwtVerify as any).mockResolvedValueOnce({
        payload: { sub: 'u1', email: 'user@example.com', nonce },
      });

      await expect(auth.handleCallback('code', state)).rejects.toThrow('allowed hosted domain');
    });

    it('rejects disallowed hosted domains', async () => {
      const auth = createSsoAuth('example.com');
      const loginUrl = await auth.getLoginUrl('http://localhost/callback', 'test-state');
      const parsed = new URL(loginUrl);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token', id_token: 'id-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'u1',
          email: 'user@other.com',
          hd: 'other.com',
          nonce: parsed.searchParams.get('nonce'),
        },
      });

      await expect(auth.handleCallback('code', parsed.searchParams.get('state')!)).rejects.toThrow(
        'allowed hosted domain',
      );
    });
  });

  describe('authenticateToken and authorizeUser', () => {
    it('prefers a valid session cookie before Bearer token fallback', async () => {
      const auth = new MastraAuthGoogle({
        clientSecret: 'test-client-secret',
        allowedDomains: 'example.com',
        session: { cookiePassword },
      }) as any;
      const loginUrl = await auth.getLoginUrl('http://localhost/callback', 'test-state');
      const parsed = new URL(loginUrl);

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token', id_token: 'id-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'google-user-123',
          email: 'user@example.com',
          hd: 'example.com',
          nonce: parsed.searchParams.get('nonce'),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const callbackResult = await auth.handleCallback('code', parsed.searchParams.get('state')!);
      const cookie = callbackResult.cookies![0]!.split(';')[0]!;

      const request = new Request('http://localhost', {
        headers: { Cookie: cookie, Authorization: 'Bearer ignored-token' },
      });
      const result = await auth.authenticateToken('ignored-token', request);

      expect(result?.id).toBe('google-user-123');
      expect(result?.expiresAt).toBeInstanceOf(Date);
      expect(auth.authorizeUser(result!)).toBe(true);
      expect(jwtVerify).toHaveBeenCalledTimes(1);
    });

    it('falls back to Bearer ID token verification', async () => {
      (jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'google-user-123',
          email: 'user@example.com',
          hd: 'example.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const auth = new MastraAuthGoogle({ allowedDomains: 'example.com' });

      const result = await auth.authenticateToken('id-token', new Request('http://localhost'));

      expect(result).toMatchObject({
        id: 'google-user-123',
        hostedDomain: 'example.com',
      });
      expect(jwtVerify).toHaveBeenCalledWith(
        'id-token',
        expect.any(Function),
        expect.objectContaining({
          audience: 'test-client-id',
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
        }),
      );
    });

    it('returns null for expired ID tokens', async () => {
      (jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'google-user-123',
          email: 'user@example.com',
          hd: 'example.com',
          exp: Math.floor(Date.now() / 1000) - 60,
        },
      });
      const auth = new MastraAuthGoogle({ allowedDomains: 'example.com' });

      await expect(auth.authenticateToken('expired-token', new Request('http://localhost'))).resolves.toBeNull();
    });

    it('rejects users without IDs, expired users, and users outside allowed domains', () => {
      const auth = new MastraAuthGoogle({ allowedDomains: 'example.com' });

      expect(auth.authorizeUser({ id: '', googleId: '' })).toBe(false);
      expect(
        auth.authorizeUser({
          id: 'u1',
          googleId: 'u1',
          hostedDomain: 'example.com',
          expiresAt: new Date(Date.now() - 1000),
        }),
      ).toBe(false);
      expect(auth.authorizeUser({ id: 'u1', googleId: 'u1', hostedDomain: 'other.com' })).toBe(false);
      expect(auth.authorizeUser({ id: 'u1', googleId: 'u1', hostedDomain: 'example.com' })).toBe(true);
    });

    it('does not synthesize users by arbitrary ID', async () => {
      const auth = new MastraAuthGoogle({ allowedDomains: 'example.com' });

      await expect(auth.getUser('google-user-123')).resolves.toBeNull();
    });
  });
});

describe('MastraRBACGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const user: GoogleUser = {
    id: 'google-user-123',
    googleId: 'google-user-123',
    email: 'user@example.com',
    hostedDomain: 'example.com',
  };

  it('does not require Directory API authentication when groups are already present', async () => {
    const rbac = new MastraRBACGoogle({
      roleMapping: {
        'engineering@example.com': ['agents:*'],
      },
    });

    await expect(
      rbac.getRoles({
        ...user,
        groups: ['engineering@example.com'],
      }),
    ).resolves.toEqual(['engineering@example.com']);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses groups already present on the user object', async () => {
    const rbac = new MastraRBACGoogle({
      accessToken: 'directory-token',
      roleMapping: {
        'engineering@example.com': ['agents:*'],
      },
    });

    await expect(
      rbac.getRoles({
        ...user,
        groups: ['engineering@example.com'],
      }),
    ).resolves.toEqual(['engineering@example.com']);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('treats an empty groups array as authoritative', async () => {
    const rbac = new MastraRBACGoogle({
      roleMapping: {
        'admins@example.com': ['*'],
        _default: ['agents:read'],
      },
    });
    const userWithoutGroups = { ...user, groups: [] };

    await expect(rbac.getRoles(userWithoutGroups)).resolves.toEqual([]);
    await expect(rbac.getPermissions(userWithoutGroups)).resolves.toEqual(['agents:read']);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches paginated Google Workspace groups and maps permissions', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            groups: [{ email: 'engineering@example.com' }],
            nextPageToken: 'next-page',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ groups: [{ email: 'admins@example.com' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const rbac = new MastraRBACGoogle({
      accessToken: 'directory-token',
      roleMapping: {
        'engineering@example.com': ['agents:*'],
        'admins@example.com': ['*'],
      },
    });

    await expect(rbac.getRoles(user)).resolves.toEqual(['engineering@example.com', 'admins@example.com']);
    await expect(rbac.getPermissions(user)).resolves.toEqual(['agents:*', '*']);

    const firstUrl = new URL(mockFetch.mock.calls[0]![0].toString());
    const secondUrl = new URL(mockFetch.mock.calls[1]![0].toString());
    expect(firstUrl.searchParams.get('userKey')).toBe('user@example.com');
    expect(firstUrl.searchParams.get('maxResults')).toBe('200');
    expect(secondUrl.searchParams.get('pageToken')).toBe('next-page');
    expect(mockFetch.mock.calls[0]![1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('supports custom getUserKey and mapGroupToRoles', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ groups: [{ email: 'eng@example.com', name: 'Engineering' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const rbac = new MastraRBACGoogle({
      accessToken: 'directory-token',
      getUserKey: value => (value as GoogleUser).googleId,
      mapGroupToRoles: group => [group.name?.toLowerCase() ?? group.email],
      roleMapping: {
        engineering: ['workflows:*'],
      },
    });

    await expect(rbac.getRoles(user)).resolves.toEqual(['engineering']);
    await expect(rbac.getPermissions(user)).resolves.toEqual(['workflows:*']);
    expect(new URL(mockFetch.mock.calls[0]![0].toString()).searchParams.get('userKey')).toBe('google-user-123');
  });

  it('deduplicates concurrent cache misses', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ groups: [{ email: 'engineering@example.com' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const rbac = new MastraRBACGoogle({
      accessToken: 'directory-token',
      roleMapping: {
        'engineering@example.com': ['agents:*'],
      },
    });

    const [first, second] = await Promise.all([rbac.getRoles(user), rbac.getRoles(user)]);

    expect(first).toEqual(['engineering@example.com']);
    expect(second).toEqual(['engineering@example.com']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('evicts failed lookups and propagates lookup errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch.mockResolvedValueOnce(new Response('nope', { status: 500 })).mockResolvedValueOnce(
      new Response(JSON.stringify({ groups: [{ email: 'viewer@example.com' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const rbac = new MastraRBACGoogle({
      accessToken: 'directory-token',
      roleMapping: {
        'viewer@example.com': ['agents:read'],
        _default: ['agents:read'],
      },
    });

    await expect(rbac.getPermissions(user)).rejects.toThrow('Google Directory groups.list failed');
    expect(consoleError).toHaveBeenCalledWith(
      '[MastraRBACGoogle] Failed to fetch Google Workspace groups:',
      expect.any(Error),
    );
    expect(consoleError.mock.calls[0]?.join(' ')).not.toContain('user@example.com');

    await expect(rbac.getRoles(user)).resolves.toEqual(['viewer@example.com']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('signs service-account JWTs and normalizes escaped private keys', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const escapedKey = (privateKey as string).replace(/\n/g, '\\n');

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'service-account-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ groups: [{ email: 'admins@example.com' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const rbac = new MastraRBACGoogle({
      serviceAccount: {
        clientEmail: 'svc@example.iam.gserviceaccount.com',
        privateKey: escapedKey,
        subject: 'admin@example.com',
      },
      roleMapping: {
        'admins@example.com': ['*'],
      },
    });

    await expect(rbac.getRoles(user)).resolves.toEqual(['admins@example.com']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]![0]).toBe('https://oauth2.googleapis.com/token');
    expect(mockFetch.mock.calls[0]![1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mockFetch.mock.calls[1]![1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer service-account-token' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('checks role and permission helpers', async () => {
    const rbac = new MastraRBACGoogle({
      accessToken: 'directory-token',
      roleMapping: {
        Admin: ['*'],
      },
    });
    const adminUser = { ...user, groups: ['Admin'] };

    await expect(rbac.hasRole(adminUser, 'Admin')).resolves.toBe(true);
    await expect(rbac.hasPermission(adminUser, 'agents:delete')).resolves.toBe(true);
    await expect(rbac.hasAllPermissions(adminUser, ['agents:read', 'workflows:create'])).resolves.toBe(true);
    await expect(rbac.hasAnyPermission(adminUser, ['agents:read', 'workflows:create'])).resolves.toBe(true);
    await expect(rbac.getAvailableRoles()).resolves.toEqual([{ id: 'Admin', name: 'Admin' }]);
    await expect(rbac.getPermissionsForRole('Admin')).resolves.toEqual(['*']);
  });
});
