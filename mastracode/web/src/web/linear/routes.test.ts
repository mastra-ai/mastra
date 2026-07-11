import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthModule from '../auth';

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
  and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
}));

// In-memory linear_connections table.
let connections: Array<Record<string, any>> = [];

function matches(table: any, row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(table, row, c));
  if (cond.kind === 'eq') {
    for (const [jsKey, col] of Object.entries(table)) {
      if ((col as any)?.name === cond.column) return row[jsKey] === cond.value;
    }
    return false;
  }
  return true;
}

vi.mock('../github/db', () => ({
  getAppDb: () => ({
    select: () => ({
      from: (table: any) => ({
        where: async (cond: any) => connections.filter(row => matches(table, row, cond)),
      }),
    }),
    insert: () => ({
      values: (vals: any) => ({
        onConflictDoUpdate: (opts: any) => {
          const existing = connections.find(row => row.orgId === vals.orgId);
          if (existing) Object.assign(existing, opts?.set ?? {});
          else connections.push({ id: `id-${connections.length + 1}`, ...vals });
          return Promise.resolve();
        },
      }),
    }),
  }),
}));

let featureEnabled = true;
vi.mock('./config', () => ({
  isLinearFeatureEnabled: () => featureEnabled,
  getLinearFeatureDiagnostics: () => ({}),
}));

vi.mock('../github/config', () => ({
  signState: (orgId: string, userId: string) => `state.${orgId}.${userId}`,
  verifyState: (state: string | undefined) => {
    if (!state?.startsWith('state.')) return null;
    const [orgId, userId] = state.slice('state.'.length).split('.');
    if (!orgId || !userId) return null;
    return { orgId, userId };
  },
}));

const exchangeLinearOAuthCode = vi.fn(async () => 'linear-token');
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

vi.mock('./client', () => ({
  buildLinearAuthorizeUrl: (state: string, redirectUri: string) =>
    `https://linear.app/oauth/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  exchangeLinearOAuthCode: (...args: any[]) => exchangeLinearOAuthCode(...(args as [])),
  fetchLinearWorkspace: (...args: any[]) => fetchLinearWorkspace(...(args as [])),
  listLinearProjects: (...args: any[]) => listLinearProjects(...(args as [])),
  listActiveLinearIssues: (token: string, after?: string, projectIds?: string[]) =>
    listActiveLinearIssues(token, after, projectIds),
}));

const getIntakeConfig = vi.fn(async () => ({
  github: { enabled: true, projectIds: null as string[] | null },
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
import { buildLinearRoutes } from './routes';

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(user: { workosId: string; organizationId?: string | null } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) {
      const withOrg = 'organizationId' in user ? user : { ...user, organizationId: 'org1' };
      c.set('webAuthUser' as never, withOrg as never);
    }
    await next();
  });
  mountApiRoutes(app as any, buildLinearRoutes({ baseUrl: 'http://localhost:4111' }));
  return app;
}

const connect = () =>
  connections.push({
    id: 'conn-1',
    orgId: 'org1',
    userId: 'u1',
    accessToken: 'linear-token',
    workspaceName: 'Acme',
    workspaceUrlKey: 'acme',
  });

beforeEach(() => {
  connections = [];
  featureEnabled = true;
  cookieUser = null;
  getIntakeConfig.mockClear();
  getIntakeConfig.mockResolvedValue({
    github: { enabled: true, projectIds: null },
    linear: { enabled: true, projectIds: ['proj-1'] },
  });
  listActiveLinearIssues.mockClear();
  listLinearProjects.mockClear();
  exchangeLinearOAuthCode.mockClear();
  fetchLinearWorkspace.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('status route', () => {
  it('reports disabled without the feature', async () => {
    featureEnabled = false;
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: false, connected: false, reason: 'missing_config' });
  });

  it('reports not connected without a connection row', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/status');
    expect(await res.json()).toMatchObject({ enabled: true, connected: false, reason: 'not_connected' });
  });

  it('reports the connected workspace for the org', async () => {
    connect();
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
    expect(connections[0]).toMatchObject({ orgId: 'org1', accessToken: 'linear-token', workspaceName: 'Acme' });
  });

  it('replaces an existing connection for the org', async () => {
    connect();
    fetchLinearWorkspace.mockResolvedValueOnce({ name: 'Other', urlKey: 'other' });
    cookieUser = { workosId: 'u1' };
    await buildApp(null).request('/auth/linear/callback?code=abc&state=state.org1.u1');
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({ workspaceName: 'Other' });
  });

  it('rejects a state minted for another tenant', async () => {
    cookieUser = { workosId: 'u1' };
    const res = await buildApp(null).request('/auth/linear/callback?code=abc&state=state.org2.u9');
    expect(res.headers.get('location')).toBe('/?linear=error');
    expect(connections).toHaveLength(0);
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
    connect();
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
    connect();
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    const json = await res.json();
    expect(json.issues[0]).toMatchObject({ identifier: 'ENG-42', title: 'Fix intake sync' });
    expect(json.nextCursor).toBe('cursor-2');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('forwards the pagination cursor', async () => {
    connect();
    await buildApp({ workosId: 'u1' }).request('/web/linear/issues?after=cursor-2');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', 'cursor-2', ['proj-1']);
  });

  it('rejects malformed cursors', async () => {
    connect();
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues?after=bad%20cursor%22');
    expect(res.status).toBe(400);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('applies the intake config project selection', async () => {
    connect();
    getIntakeConfig.mockResolvedValueOnce({
      github: { enabled: true, projectIds: null },
      linear: { enabled: true, projectIds: ['proj-1'] },
    });
    await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(listActiveLinearIssues).toHaveBeenCalledWith('linear-token', undefined, ['proj-1']);
  });

  it('returns an empty page without calling Linear when no projects are selected', async () => {
    connect();
    getIntakeConfig.mockResolvedValueOnce({
      github: { enabled: true, projectIds: null },
      linear: { enabled: true, projectIds: null },
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(await res.json()).toEqual({ issues: [], nextCursor: null });
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('404s when Linear intake is disabled in settings', async () => {
    connect();
    getIntakeConfig.mockResolvedValueOnce({
      github: { enabled: true, projectIds: null },
      linear: { enabled: false, projectIds: null },
    });
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(404);
    expect(listActiveLinearIssues).not.toHaveBeenCalled();
  });

  it('502s when the Linear API fails', async () => {
    connect();
    listActiveLinearIssues.mockRejectedValueOnce(new Error('Linear API request failed (500)'));
    const res = await buildApp({ workosId: 'u1' }).request('/web/linear/issues');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'linear_fetch_failed' });
  });
});
