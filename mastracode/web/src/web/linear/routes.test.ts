import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthModule from '../auth';

let featureEnabled = true;
vi.mock('./config', () => ({
  isLinearFeatureEnabled: () => featureEnabled,
  getLinearFeatureDiagnostics: () => ({}),
}));

const exchangeLinearOAuthCode = vi.fn(async () => ({
  accessToken: 'linear-token',
  refreshToken: 'linear-refresh',
  expiresAt: new Date('2026-07-14T00:00:00Z'),
}));
const refreshLinearAccessToken = vi.fn(async () => ({
  accessToken: 'linear-token-2',
  refreshToken: 'linear-refresh-2',
  expiresAt: new Date('2026-07-15T00:00:00Z'),
}));
const fetchLinearWorkspace = vi.fn(async () => ({ name: 'Acme', urlKey: 'acme' }));
const listLinearProjects = vi.fn(async () => [
  { id: 'proj-1', name: 'Q3 Roadmap', state: 'started', teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }] },
]);
const listActiveLinearIssues = vi.fn(async (_token: string, _after?: string, _projectIds?: string[]) => ({
  issues: [
    {
      id: 'issue-1',
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      url: 'https://linear.app/acme/issue/ENG-42',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: 'ada',
      team: 'ENG',
      labels: ['bug'],
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    },
  ],
  nextCursor: 'cursor-2',
}));

// Stub integration instance: real DI through `MountLinearRoutesOptions.linear`
// instead of module mocking — mirrors how the factory hands the instance to
// `buildLinearRoutes` in production.
const linearStub = {
  id: 'linear',
  buildAuthorizeUrl: (state: string, redirectUri: string) =>
    `https://linear.app/oauth/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  exchangeOAuthCode: (...args: any[]) => exchangeLinearOAuthCode(...(args as [])),
  refreshAccessToken: (...args: any[]) => refreshLinearAccessToken(...(args as [])),
  fetchWorkspace: (...args: any[]) => fetchLinearWorkspace(...(args as [])),
  listProjects: (...args: any[]) => listLinearProjects(...(args as [])),
  listActiveIssues: (token: string, after?: string, projectIds?: string[]) =>
    listActiveLinearIssues(token, after, projectIds),
} as unknown as import('./integration').LinearIntegration;

// Deterministic state signer injected the same way the factory does it.
const stateSigner: import('../state-signing').StateSigner = {
  stable: true,
  sign: (orgId: string, userId: string) => `state.${orgId}.${userId}`,
  verify: (state: string | undefined) => {
    if (!state?.startsWith('state.')) return null;
    const [orgId, userId] = state.slice('state.'.length).split('.');
    if (!orgId || !userId) return null;
    return { orgId, userId };
  },
};

const getIntakeConfig = vi.fn(async () => ({
  github: { enabled: true, repositoryIds: null as string[] | null },
  linear: { enabled: true, projectIds: null as string[] | null },
}));
vi.mock('../intake/store', () => ({
  getIntakeConfig: (...args: any[]) => getIntakeConfig(...(args as [])),
}));

// Partially mock `../auth` the same way as the GitHub route tests: the
// harness middleware stashes the user; `ensureWebAuthUser` falls back to a
// controllable cookie user for `/auth/*` routes.
let cookieUser: { workosId: string; organizationId?: string } | null = null;
vi.mock('../auth', async () => {
  const actual = (await vi.importActual('../auth')) as typeof AuthModule;
  return {
    ...actual,
    ensureWebAuthUser: async (c: any) => {
      const existing = actual.getWebAuthUser(c);
      if (existing) return existing;
      if (!cookieUser) return undefined;
      const withOrg = { workosId: cookieUser.workosId, organizationId: cookieUser.organizationId ?? 'org1' };
      c.set('webAuthUser', withOrg);
      return withOrg;
    },
  };
});

import { mountApiRoutes } from '../test-utils';
import { __resetRuntimeConfigForTests } from '../runtime-config';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import { buildLinearRoutes } from './routes';
import { getLinearConnection, upsertLinearConnection } from './storage';

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: { workosId: string; organizationId?: string | null } | null,
  signer: import('../state-signing').StateSigner | null = stateSigner,
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      const withOrg = 'organizationId' in user ? user : { ...user, organizationId: 'org1' };
      c.set('webAuthUser' as never, withOrg as never);
    }
    await next();
  });
  mountApiRoutes(
    app as any,
    buildLinearRoutes({ baseUrl: 'http://localhost:4111', linear: linearStub, stateSigner: signer ?? undefined }),
  );
  return app;
}

const connect = (overrides: Record<string, any> = {}) =>
  upsertLinearConnection({
    orgId: 'org1',
    userId: 'u1',
    accessToken: 'linear-token',
    refreshToken: 'linear-refresh',
    // Unexpired by default; tests override to simulate expiry.
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scope: null,
    workspaceName: 'Acme',
    workspaceUrlKey: 'acme',
    ...overrides,
  });

beforeEach(async () => {
  await seedFactoryStorageForTests();
  featureEnabled = true;
  cookieUser = null;
  getIntakeConfig.mockClear();
  getIntakeConfig.mockResolvedValue({
    github: { enabled: true, repositoryIds: null },
    linear: { enabled: true, projectIds: ['proj-1'] },
  });
  listActiveLinearIssues.mockClear();
  listLinearProjects.mockClear();
  exchangeLinearOAuthCode.mockClear();
  refreshLinearAccessToken.mockClear();
  fetchLinearWorkspace.mockClear();
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without the feature', async () => {
    featureEnabled = false;
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false, reason: 'missing_config' });
  });

  it('reports disabled without a state signer', async () => {
    const res = await buildApp({ workosId: 'u1' }, null).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false, reason: 'missing_config' });
  });

  it('reports not connected without a connection row', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: true, connected: false, reason: 'not_connected' });
  });

  it('reports the connected workspace for the org', async () => {
    await connect();
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({
      enabled: true,
      connected: true,
      reason: 'ready',
      workspace: { name: 'Acme', urlKey: 'acme' },
    });
  });

  it('requires an organization', async () => {
    const res = await buildApp({ workosId: 'u1', organizationId: undefined }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: true, connected: false, reason: 'organization_required' });
  });
});

describe('connect route', () => {
  it('redirects to the Linear authorize URL with a signed state', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/linear/connect');
    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toContain('https://linear.app/oauth/authorize');
    expect(location).toContain('state=state.org1.u1');
  });

  it('rejects unauthenticated users', async () => {
    const res = await buildApp(null).request('/auth/linear/connect');
    expect(res.status).toBe(401);
  });
});

describe('callback route', () => {
  it('persists the connection and redirects on success', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/linear/callback?code=abc&state=state.org1.u1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/?linear=connected');
    expect(exchangeLinearOAuthCode).toHaveBeenCalledWith('abc', 'http://localhost:4111/auth/linear/callback');
    expect(await getLinearConnection('org1')).toMatchObject({
      orgId: 'org1',
      accessToken: 'linear-token',
      refreshToken: 'linear-refresh',
      expiresAt: new Date('2026-07-14T00:00:00Z'),
      workspaceName: 'Acme',
    });
  });

  it('replaces an existing connection for the org', async () => {
    await connect();
    fetchLinearWorkspace.mockResolvedValueOnce({ name: 'Other', urlKey: 'other' });
    cookieUser = { workosId: 'u1' };
    await buildApp(null).request('/auth/linear/callback?code=abc&state=state.org1.u1');
    expect(await getLinearConnection('org1')).toMatchObject({ workspaceName: 'Other' });
  });

  it('rejects a state minted for another tenant', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/linear/callback?code=abc&state=state.org2.u9');
    expect(res.headers.get('location')).toBe('/?linear=error');
    expect(await getLinearConnection('org1')).toBeNull();
    expect(await getLinearConnection('org2')).toBeNull();
  });

  it('redirects to the error page when consent is denied (no code)', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/linear/callback?state=state.org1.u1');
    expect(res.headers.get('location')).toBe('/?linear=error');
  });
});

describe('projects route', () => {
  it('409s when Linear is not connected', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/projects');
    expect(res.status).toBe(409);
  });

  it('lists the workspace projects', async () => {
    await connect();
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/projects');
    expect(await res.json()).toEqual({
      projects: [
        {
          id: 'proj-1',
          name: 'Q3 Roadmap',
          state: 'started',
          teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }],
        },
      ],
    });
  });
});

describe('issues route', () => {
  it('409s when Linear is not connected', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(409);
  });

  it('returns a page of issues with the next cursor', async () => {
    await connect();
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    const json = await res.json();
    expect(json.issues[0]).toMatchObject({ identifier: 'ENG-42', title: 'Fix intake sync' });
    expect(json.nextCursor).toBe('cursor-2');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('forwards the pagination cursor', async () => {
    await connect();
    await buildApp({ workosId: 'u1' }).request('/web/linear/issues?after=cursor-2');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', 'cursor-2', ['proj-1']);
  });

  it('rejects malformed cursors', async () => {
    await connect();
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues?after=bad%20cursor%22');
    expect(res.status).toBe(400);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('applies the intake config project selection', async () => {
    await connect();
    getIntakeConfig.mockResolvedValueOnce({
      github: { enabled: true, repositoryIds: null },
      linear: { enabled: true, projectIds: ['proj-1'] },
    });
    await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('returns an empty page without calling Linear when no projects are selected', async () => {
    await connect();
    getIntakeConfig.mockResolvedValueOnce({
      github: { enabled: true, repositoryIds: null },
      linear: { enabled: true, projectIds: null },
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('404s when Linear intake is disabled in settings', async () => {
    await connect();
    getIntakeConfig.mockResolvedValueOnce({
      github: { enabled: true, repositoryIds: null },
      linear: { enabled: false, projectIds: null },
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(404);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token and persists the rotated token set', async () => {
    await connect({ expiresAt: new Date(Date.now() - 1000) });
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(200);
    expect(refreshLinearAccessToken).toHaveBeenCalledWith('linear-refresh');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token-2', undefined, ['proj-1']);
    expect(await getLinearConnection('org1')).toMatchObject({
      accessToken: 'linear-token-2',
      refreshToken: 'linear-refresh-2',
      expiresAt: new Date('2026-07-15T00:00:00Z'),
    });
  });

  it('does not refresh an unexpired token', async () => {
    await connect();
    await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(refreshLinearAccessToken).not.toHaveBeenCalled();
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('409s with linear_reauth_required when the token is expired and has no refresh token', async () => {
    await connect({ expiresAt: new Date(Date.now() - 1000), refreshToken: null });
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'linear_reauth_required' });
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('409s with linear_reauth_required when the refresh grant is rejected', async () => {
    await connect({ expiresAt: new Date(Date.now() - 1000) });
    const err = new Error('Linear token refresh failed (400)');
    (err as any).status = 400;
    refreshLinearAccessToken.mockRejectedValueOnce(err);
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'linear_reauth_required' });
  });

  it('409s with linear_reauth_required when Linear rejects the access token', async () => {
    await connect();
    const err = new Error('Linear API request failed (401)');
    (err as any).status = 401;
    listActiveLinearIssues.mockRejectedValueOnce(err);
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'linear_reauth_required' });
  });

  it('502s when the Linear API fails', async () => {
    await connect();
    listActiveLinearIssues.mockRejectedValueOnce(new Error('Linear API request failed (500)'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'linear_fetch_failed' });
  });
});
