import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import type { TestAuthUser } from '../../routes/test-utils.js';
import type { StateSigner } from '../../state-signing.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { LinearIntegration } from './integration.js';
import { buildLinearRoutes } from './routes.js';

// A real integration instance with the network edges spied out: connection
// persistence, token refresh single-flight, and scope handling all run the
// production code paths against the seeded `:memory:` storage.
let linear!: LinearIntegration;
let seed!: FactoryStorageTestSeed;

const exchangeLinearOAuthCode = vi.fn(async (_code: string, _redirectUri: string) => ({
  accessToken: 'linear-token',
  refreshToken: 'linear-refresh',
  expiresAt: new Date('2026-07-14T00:00:00Z'),
  scope: 'read,comments:create',
}));
const refreshLinearAccessToken = vi.fn(async (_refreshToken: string) => ({
  accessToken: 'linear-token-2',
  refreshToken: 'linear-refresh-2',
  expiresAt: new Date('2026-07-15T00:00:00Z'),
  scope: null,
}));
const fetchLinearWorkspace = vi.fn(async () => ({ name: 'Acme', urlKey: 'acme' }));
const listLinearProjects = vi.fn(async () => [
  { id: 'proj-1', name: 'Q3 Roadmap', state: 'started', teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }] },
]);
const listActiveLinearIssues = vi.fn(async (_token: string, _after?: string, _sourceIds?: string[]) => ({
  issues: [
    {
      id: 'issue-1',
      projectId: 'proj-1',
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

// Deterministic state signer injected the same way the factory does it.
const stateSigner: StateSigner = {
  stable: true,
  sign: (orgId: string, userId: string) => `state.${orgId}.${userId}`,
  verify: (state: string | undefined) => {
    if (!state?.startsWith('state.')) return null;
    const [orgId, userId] = state.slice('state.'.length).split('.');
    if (!orgId || !userId) return null;
    return { orgId, userId };
  },
};

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: TestAuthUser | null,
  options: {
    signer?: StateSigner | null;
    authEnabled?: boolean;
    ingestFactoryIssues?: Parameters<typeof buildLinearRoutes>[0]['ingestFactoryIssues'];
  } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app,
    buildLinearRoutes({
      baseUrl: 'http://localhost:4111',
      linear,
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      stateSigner: options.signer === undefined ? stateSigner : (options.signer ?? undefined),
      intake: seed.intake,
      ingestFactoryIssues: options.ingestFactoryIssues,
    }),
  );
  return app;
}

const org1 = (): TestAuthUser => ({ workosId: 'u1', organizationId: 'org1' });

const connect = (overrides: Record<string, any> = {}) =>
  linear.upsertConnection({
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
  seed = await createFactoryStorageForTests();
  linear = new LinearIntegration({ clientId: 'lin_client', clientSecret: 'lin_secret' });
  linear.initialize({
    storage: seed.integrations.forIntegration('linear'),
    projects: seed.projects,
    auth: fakeRouteAuth(),
  });
  vi.spyOn(linear, 'exchangeOAuthCode').mockImplementation(exchangeLinearOAuthCode);
  vi.spyOn(linear, 'refreshAccessToken').mockImplementation(refreshLinearAccessToken);
  vi.spyOn(linear, 'fetchWorkspace').mockImplementation(fetchLinearWorkspace);
  vi.spyOn(linear, 'listProjects').mockImplementation(listLinearProjects);
  // The intake path passes a 4th `labels` arg; forward only what the tests assert on.
  vi.spyOn(linear, 'listActiveIssues').mockImplementation(
    (token, after, sourceIds) => listActiveLinearIssues(token, after, sourceIds) as never,
  );
  await seed.intake.saveConfig({
    orgId: 'org1',
    userId: 'u1',
    config: { linear: { enabled: true, sourceIds: ['proj-1'] } },
  });
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without web auth', async () => {
    const res = await buildApp(org1(), { authEnabled: false }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false, reason: 'missing_config' });
  });

  it('reports disabled without a state signer', async () => {
    const res = await buildApp(org1(), { signer: null }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false, reason: 'missing_config' });
  });

  it('reports not connected without a connection row', async () => {
    const res = await buildApp(org1()).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: true, connected: false, reason: 'not_connected' });
  });

  it('reports the connected workspace for the org', async () => {
    await connect();
    const res = await buildApp(org1()).request('/web/linear/status');
    expect(await res.json()).toMatchObject({
      enabled: true,
      connected: true,
      reason: 'ready',
      workspace: { name: 'Acme', urlKey: 'acme' },
    });
  });

  it('requires an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: true, connected: false, reason: 'organization_required' });
  });
});

describe('connect route', () => {
  it('redirects to the Linear authorize URL with a signed state', async () => {
    const res = await buildApp(org1()).request('/auth/linear/connect');
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
    const res = await buildApp(org1()).request('/auth/linear/callback?code=abc&state=state.org1.u1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/?linear=connected');
    expect(exchangeLinearOAuthCode).toHaveBeenCalledWith('abc', 'http://localhost:4111/auth/linear/callback');
    expect(await linear.loadConnection('org1')).toMatchObject({
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
    await buildApp(org1()).request('/auth/linear/callback?code=abc&state=state.org1.u1');
    expect(await linear.loadConnection('org1')).toMatchObject({ workspaceName: 'Other' });
  });

  it('rejects a state minted for another tenant', async () => {
    const res = await buildApp(org1()).request('/auth/linear/callback?code=abc&state=state.org2.u9');
    expect(res.headers.get('location')).toBe('/?linear=error');
    expect(await linear.loadConnection('org1')).toBeNull();
    expect(await linear.loadConnection('org2')).toBeNull();
  });

  it('redirects to the error page when consent is denied (no code)', async () => {
    const res = await buildApp(org1()).request('/auth/linear/callback?state=state.org1.u1');
    expect(res.headers.get('location')).toBe('/?linear=error');
  });
});

describe('projects route', () => {
  it('409s when Linear is not connected', async () => {
    const res = await buildApp(org1()).request('/web/linear/projects');
    expect(res.status).toBe(409);
  });

  it('lists the workspace projects', async () => {
    await connect();
    const res = await buildApp(org1()).request('/web/linear/projects');
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
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(409);
  });

  it('returns a page of issues with the next cursor', async () => {
    await connect();
    const res = await buildApp(org1()).request('/web/linear/issues');
    const json = await res.json();
    expect(json.issues[0]).toMatchObject({ identifier: 'ENG-42', title: 'Fix intake sync' });
    expect(json.nextCursor).toBe('cursor-2');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('ingests fetched issues for the active Factory project', async () => {
    await connect();
    const ingestFactoryIssues = vi.fn(async () => ({ status: 'committed', ingested: 1 }));
    const factoryProjectId = '11111111-1111-4111-8111-111111111111';
    const res = await buildApp(org1(), { ingestFactoryIssues }).request(
      `/web/linear/issues?factoryProjectId=${factoryProjectId}`,
    );

    expect(res.status).toBe(200);
    expect(ingestFactoryIssues).toHaveBeenCalledWith({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId,
      issues: expect.arrayContaining([expect.objectContaining({ id: 'issue-1', identifier: 'ENG-42' })]),
    });
  });

  it('rejects malformed Factory project identifiers before fetching issues', async () => {
    await connect();
    const ingestFactoryIssues = vi.fn();
    const res = await buildApp(org1(), { ingestFactoryIssues }).request(
      '/web/linear/issues?factoryProjectId=not-a-uuid',
    );

    expect(res.status).toBe(400);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
    expect(ingestFactoryIssues).not.toHaveBeenCalled();
  });

  it('forwards the pagination cursor', async () => {
    await connect();
    await buildApp(org1()).request('/web/linear/issues?after=cursor-2');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', 'cursor-2', ['proj-1']);
  });

  it('rejects malformed cursors', async () => {
    await connect();
    const res = await buildApp(org1()).request('/web/linear/issues?after=bad%20cursor%22');
    expect(res.status).toBe(400);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('applies the intake config project selection', async () => {
    await connect();
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: { linear: { enabled: true, sourceIds: ['proj-1'] } },
    });
    await buildApp(org1()).request('/web/linear/issues');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('returns an empty page without calling Linear when no projects are selected', async () => {
    await connect();
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: { linear: { enabled: true, sourceIds: null } },
    });
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('404s when Linear intake is disabled in settings', async () => {
    await connect();
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: { linear: { enabled: false, sourceIds: null } },
    });
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(404);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token and persists the rotated token set', async () => {
    await connect({ expiresAt: new Date(Date.now() - 1000) });
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(200);
    expect(refreshLinearAccessToken).toHaveBeenCalledWith('linear-refresh');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token-2', undefined, ['proj-1']);
    expect(await linear.loadConnection('org1')).toMatchObject({
      accessToken: 'linear-token-2',
      refreshToken: 'linear-refresh-2',
      expiresAt: new Date('2026-07-15T00:00:00Z'),
    });
  });

  it('does not refresh an unexpired token', async () => {
    await connect();
    await buildApp(org1()).request('/web/linear/issues');
    expect(refreshLinearAccessToken).not.toHaveBeenCalled();
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('409s with linear_reauth_required when the token is expired and has no refresh token', async () => {
    await connect({ expiresAt: new Date(Date.now() - 1000), refreshToken: null });
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'linear_reauth_required' });
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('409s with linear_reauth_required when the refresh grant is rejected', async () => {
    await connect({ expiresAt: new Date(Date.now() - 1000) });
    const err = new Error('Linear token refresh failed (400)');
    (err as any).status = 400;
    refreshLinearAccessToken.mockRejectedValueOnce(err);
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'linear_reauth_required' });
  });

  it('409s with linear_reauth_required when Linear rejects the access token', async () => {
    await connect();
    const err = new Error('Linear API request failed (401)');
    (err as any).status = 401;
    listActiveLinearIssues.mockRejectedValueOnce(err);
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'linear_reauth_required' });
  });

  it('502s when the Linear API fails', async () => {
    await connect();
    listActiveLinearIssues.mockRejectedValueOnce(new Error('Linear API request failed (500)'));
    const res = await buildApp(org1()).request('/web/linear/issues');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'linear_fetch_failed' });
  });
});
