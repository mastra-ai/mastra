import { beforeEach, describe, expect, it, vi } from 'vitest';

const workos = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authenticateWithCode: vi.fn(),
  getAuthorizationUrlWithPKCE: vi.fn(),
  getLogoutUrl: vi.fn(),
  listOrganizationMemberships: vi.fn(),
  loadSealedSession: vi.fn(),
}));

vi.mock('@workos-inc/node', () => ({
  WorkOS: class {
    readonly userManagement = {
      authenticateWithCode: workos.authenticateWithCode,
      getAuthorizationUrlWithPKCE: workos.getAuthorizationUrlWithPKCE,
      getLogoutUrl: workos.getLogoutUrl,
      listOrganizationMemberships: workos.listOrganizationMemberships,
      loadSealedSession: workos.loadSealedSession,
    };
  },
}));

import { createWorkosDashboardSessionClient } from '../../src/app/auth/workos-session.js';

describe('WorkOS dashboard session client', () => {
  beforeEach(() => {
    workos.authenticate.mockReset().mockResolvedValue({
      authenticated: true,
      user: { id: 'user_123' },
      sessionId: 'session_123',
      organizationId: 'organization_123',
      roles: ['soc_manager'],
    });
    workos.authenticateWithCode.mockReset().mockResolvedValue({
      sealedSession: 'sealed-session',
    });
    workos.getAuthorizationUrlWithPKCE.mockReset().mockResolvedValue({
      url: 'https://api.workos.com/user_management/authorize',
      state: 'state_123',
      codeVerifier: 'v'.repeat(43),
    });
    workos.getLogoutUrl.mockReset().mockReturnValue('https://api.workos.com/user_management/sessions/logout');
    workos.loadSealedSession.mockReset().mockReturnValue({
      authenticate: workos.authenticate,
    });
    workos.listOrganizationMemberships.mockReset().mockResolvedValue({
      data: [],
    });
  });

  it.each([
    ['sign-in', 'sign-in'],
    ['sign-up', 'sign-up'],
  ] as const)('forces an interactive AuthKit %s flow', async (intent, screenHint) => {
    const client = createWorkosDashboardSessionClient({
      enabled: true,
      workosApiKey: 'workos-api-key-for-tests',
      workosClientId: 'client_123',
      workosRedirectUri: 'http://localhost:3000/auth/callback',
      workosCookiePassword: 'c'.repeat(32),
      dashboardOrigin: 'http://localhost:3000',
      csrfSecret: 's'.repeat(32),
      sessionMaxAgeSeconds: 28_800,
      sseMaxConnections: 4,
    });

    await expect(client?.startLogin({ intent })).resolves.toMatchObject({
      authorizationUrl: 'https://api.workos.com/user_management/authorize',
    });
    expect(workos.getAuthorizationUrlWithPKCE).toHaveBeenCalledWith({
      clientId: 'client_123',
      redirectUri: 'http://localhost:3000/auth/callback',
      provider: 'authkit',
      prompt: 'login',
      screenHint,
    });
  });

  it('builds the hosted logout URL from the authenticated session ID', async () => {
    const client = createWorkosDashboardSessionClient({
      enabled: true,
      workosApiKey: 'workos-api-key-for-tests',
      workosClientId: 'client_123',
      workosRedirectUri: 'http://localhost:3000/auth/callback',
      workosCookiePassword: 'c'.repeat(32),
      dashboardOrigin: 'http://localhost:3000',
      csrfSecret: 's'.repeat(32),
      sessionMaxAgeSeconds: 28_800,
      sseMaxConnections: 4,
    });

    await expect(client?.getLogoutUrl('session_123', 'http://localhost:3000/')).resolves.toBe(
      'https://api.workos.com/user_management/sessions/logout',
    );
    expect(workos.getLogoutUrl).toHaveBeenCalledWith({
      sessionId: 'session_123',
      returnTo: 'http://localhost:3000/',
    });
    expect(workos.loadSealedSession).not.toHaveBeenCalled();
  });

  it('provides the cookie password when asking AuthKit to seal the session', async () => {
    const cookiePassword = 'c'.repeat(32);
    const client = createWorkosDashboardSessionClient({
      enabled: true,
      workosApiKey: 'workos-api-key-for-tests',
      workosClientId: 'client_123',
      workosRedirectUri: 'http://localhost:3000/auth/callback',
      workosCookiePassword: cookiePassword,
      dashboardOrigin: 'http://localhost:3000',
      csrfSecret: 's'.repeat(32),
      sessionMaxAgeSeconds: 28_800,
      sseMaxConnections: 4,
    });

    await expect(
      client?.completeLogin({
        code: 'authorization-code',
        codeVerifier: 'v'.repeat(43),
      }),
    ).resolves.toMatchObject({ sealedSession: 'sealed-session' });
    expect(workos.authenticateWithCode).toHaveBeenCalledWith({
      clientId: 'client_123',
      code: 'authorization-code',
      codeVerifier: 'v'.repeat(43),
      session: { sealSession: true, cookiePassword },
    });
  });

  it('uses the single role claim when the multiple-role claim is empty', async () => {
    workos.authenticate.mockResolvedValue({
      authenticated: true,
      user: { id: 'user_123' },
      sessionId: 'session_123',
      organizationId: 'organization_123',
      role: 'soc-manager',
      roles: [],
    });
    const client = createWorkosDashboardSessionClient({
      enabled: true,
      workosApiKey: 'workos-api-key-for-tests',
      workosClientId: 'client_123',
      workosRedirectUri: 'http://localhost:3000/auth/callback',
      workosCookiePassword: 'c'.repeat(32),
      dashboardOrigin: 'http://localhost:3000',
      csrfSecret: 's'.repeat(32),
      sessionMaxAgeSeconds: 28_800,
      sseMaxConnections: 4,
    });

    await expect(
      client?.completeLogin({
        code: 'authorization-code',
        codeVerifier: 'v'.repeat(43),
      }),
    ).resolves.toMatchObject({ session: { roles: ['soc-manager'] } });
  });

  it('maps approved WorkOS role slugs and rejects generic memberships', async () => {
    workos.listOrganizationMemberships.mockResolvedValue({
      data: [
        {
          status: 'active',
          organizationId: 'organization_123',
          organizationName: 'Security',
          role: { slug: 'soc-manager' },
        },
        {
          status: 'active',
          organizationId: 'organization_456',
          organizationName: 'General',
          role: { slug: 'member' },
        },
      ],
    });
    const client = createWorkosDashboardSessionClient({
      enabled: true,
      workosApiKey: 'workos-api-key-for-tests',
      workosClientId: 'client_123',
      workosRedirectUri: 'http://localhost:3000/auth/callback',
      workosCookiePassword: 'c'.repeat(32),
      dashboardOrigin: 'http://localhost:3000',
      csrfSecret: 's'.repeat(32),
      sessionMaxAgeSeconds: 28_800,
      sseMaxConnections: 4,
    });

    await expect(client?.listOrganizations('user_123')).resolves.toEqual([
      {
        organizationId: 'organization_123',
        organizationName: 'Security',
        role: 'soc_manager',
      },
    ]);
  });
});
