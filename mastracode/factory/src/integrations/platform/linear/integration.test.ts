import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import { encodeSourceId, encodeTeamSourceId, linearConnectionToken, PlatformLinearIntegration } from './integration.js';

const PLATFORM_BASE = 'https://platform.example.com';
const connection = { type: 'oauth' as const, accessToken: linearConnectionToken('conn-acme') };

const user = { id: 'user-1', name: 'Ada Lovelace', displayName: 'Ada', email: 'ada@example.com', avatarUrl: null };

function rawIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue-1',
    identifier: 'ENG-42',
    number: 42,
    title: 'Fix intake',
    description: 'Issue body',
    url: 'https://linear.app/acme/issue/ENG-42',
    priority: 2,
    priorityLabel: 'High',
    labels: { nodes: [{ id: 'label-1', name: 'bug' }] },
    state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
    team: { id: 'team-eng', key: 'ENG', name: 'Engineering' },
    project: { id: 'project-1' },
    assignee: user,
    creator: user,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

type Workspace = {
  organization: { id: string; name: string; urlKey: string };
  projects: Array<{ id: string; name: string; state: string; teams: { nodes: Array<Record<string, string>> } }>;
  teams: Array<{ id: string; key: string; name: string }>;
  issues: Array<ReturnType<typeof rawIssue>>;
  comments?: Array<Record<string, unknown>>;
};

const acme = (): Workspace => ({
  organization: { id: 'org-acme', name: 'Acme', urlKey: 'acme' },
  projects: [
    {
      id: 'project-1',
      name: 'Platform',
      state: 'started',
      teams: { nodes: [{ id: 'team-eng', key: 'ENG', name: 'Engineering' }] },
    },
  ],
  teams: [{ id: 'team-eng', key: 'ENG', name: 'Engineering' }],
  issues: [rawIssue()],
  comments: [
    {
      id: 'comment-1',
      body: 'Looks related',
      url: 'https://linear.app/acme/issue/ENG-42#comment-1',
      issue: { id: 'issue-1', identifier: 'ENG-42' },
      user,
      parent: null,
      createdAt: '2026-07-02T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    },
  ],
});

const beta = (): Workspace => ({
  organization: { id: 'org-beta', name: 'Beta', urlKey: 'beta' },
  projects: [],
  teams: [{ id: 'team-ops', key: 'OPS', name: 'Operations' }],
  issues: [
    rawIssue({
      id: 'issue-2',
      identifier: 'OPS-7',
      title: 'Rotate keys',
      url: 'https://linear.app/beta/issue/OPS-7',
      team: { id: 'team-ops', key: 'OPS', name: 'Operations' },
      project: null,
    }),
  ],
});

type Mutation = { connectionId: string; name: string; variables: Record<string, any> };

function fakePlatform(
  options: {
    connections?: Array<{ id: string; status: 'active' | 'needs_reauth'; accountLabel: string | null }>;
    workspaces?: Record<string, Workspace>;
  } = {},
) {
  const connections = options.connections ?? [
    { id: 'conn-acme', status: 'active', accountLabel: 'Acme' },
    { id: 'conn-beta', status: 'active', accountLabel: 'Beta' },
    { id: 'conn-stale', status: 'needs_reauth', accountLabel: null },
  ];
  const workspaces = options.workspaces ?? { 'conn-acme': acme(), 'conn-beta': beta() };
  const mutations: Mutation[] = [];
  const proxied: string[] = [];

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/v2/connections?providerKey=linear')) return json({ connections });
    const match = url.match(/\/v2\/connections\/([^/]+)\/proxy\/graphql$/);
    if (!match || init?.method !== 'POST') return json({ error: `unexpected ${init?.method} ${url}` }, 500);

    const connectionId = decodeURIComponent(match[1]!);
    proxied.push(connectionId);
    const workspace = workspaces[connectionId];
    if (!workspace) return json({ error: 'unknown connection' }, 404);
    const { query, variables } = JSON.parse(String(init.body)) as { query: string; variables: Record<string, any> };

    for (const name of ['issueUpdate', 'commentCreate', 'issueCreate']) {
      if (!query.includes(`${name}(`)) continue;
      mutations.push({ connectionId, name, variables });
      if (name === 'issueUpdate') {
        const target = workspace.issues.find(i => i.id === variables.id);
        if (target) target.state = { id: 'state-progress', name: 'In Progress', type: 'started' };
        return json({ data: { issueUpdate: { success: true } } });
      }
      if (name === 'commentCreate') {
        return json({ data: { commentCreate: { success: true, comment: { id: 'comment-new', url: 'https://linear.app/c' } } } });
      }
      const created = { id: 'issue-new', identifier: 'ENG-99', title: variables.input.title, url: 'https://linear.app/i' };
      return json({ data: { issueCreate: { success: true, issue: created } } });
    }
    if (query.includes('organization {')) return json({ data: { organization: workspace.organization } });
    if (query.includes('workflowStates(')) {
      return json({
        data: {
          workflowStates: {
            nodes: [
              { id: 'state-todo', name: 'Todo', type: 'unstarted', position: 1, team: { id: variables.teamId } },
              { id: 'state-progress', name: 'In Progress', type: 'started', position: 2, team: { id: variables.teamId } },
            ],
          },
        },
      });
    }
    const page = { hasNextPage: false, endCursor: null };
    if (query.includes('projects(')) return json({ data: { projects: { nodes: workspace.projects, pageInfo: page } } });
    if (query.includes('teams(')) return json({ data: { teams: { nodes: workspace.teams, pageInfo: page } } });
    if (query.includes('issues(')) {
      const projectId = variables.filter?.project?.id?.eq;
      const teamId = variables.filter?.team?.id?.eq;
      const nodes = workspace.issues.filter(
        i => (!projectId || i.project?.id === projectId) && (!teamId || i.team.id === teamId),
      );
      return json({ data: { issues: { nodes, pageInfo: page } } });
    }
    if (query.includes('issue(')) {
      const found = workspace.issues.find(i => i.id === variables.id || i.identifier === variables.id);
      if (!found) return json({ data: null, errors: [{ message: 'Entity not found: Issue' }] });
      const comments = query.includes('comments(')
        ? { comments: { nodes: workspace.comments ?? [], pageInfo: page } }
        : {};
      return json({ data: { issue: { ...found, ...comments } } });
    }
    return json({ error: 'unhandled query' }, 500);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, mutations, proxied };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', PLATFORM_BASE);
  vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-token');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PlatformLinearIntegration', () => {
  it('lists projects and teams from every active Connect connection as Intake sources', async () => {
    const { proxied } = fakePlatform();
    const sources = await new PlatformLinearIntegration().intake.listSources({ connection });

    expect(sources.map(source => [source.type, source.name, source.id])).toEqual([
      ['project', 'Platform', encodeSourceId('org-acme', 'project-1')],
      ['team', 'Engineering', encodeTeamSourceId('org-acme', 'team-eng')],
      ['team', 'Operations', encodeTeamSourceId('org-beta', 'team-ops')],
    ]);
    expect(proxied).not.toContain('conn-stale');
  });

  it('lists a workspace once when several connections authorize it', async () => {
    fakePlatform({
      connections: [
        { id: 'conn-acme', status: 'active', accountLabel: 'Acme' },
        { id: 'conn-acme-2', status: 'active', accountLabel: 'Acme' },
      ],
      workspaces: { 'conn-acme': acme(), 'conn-acme-2': acme() },
    });
    const linear = new PlatformLinearIntegration();

    const sources = await linear.intake.listSources({ connection });
    expect(sources.map(source => source.name)).toEqual(['Platform', 'Engineering']);
    expect((await linear.listAllTeams()).map(team => team.key)).toEqual(['ENG']);
  });

  it('lists issues for a team source through the owning connection proxy', async () => {
    const { proxied } = fakePlatform();
    const teamSource = encodeTeamSourceId('org-beta', 'team-ops');

    const result = await new PlatformLinearIntegration().intake.listIssues({ connection, sourceIds: [teamSource] });

    expect(result.issues).toEqual([
      expect.objectContaining({ title: 'Rotate keys', sourceId: teamSource, labels: ['bug'] }),
    ]);
    expect(proxied).toContain('conn-beta');
  });

  it('keeps resolving source ids stored by the legacy app-install integration', async () => {
    fakePlatform();
    // Legacy ids encode the Linear organization id as `workspaceId` — the same value used today.
    const legacy = `linear-project:${Buffer.from(JSON.stringify({ workspaceId: 'org-acme', projectId: 'project-1' })).toString('base64url')}`;
    expect(legacy).toBe(encodeSourceId('org-acme', 'project-1'));

    const result = await new PlatformLinearIntegration().intake.listIssues({ connection, sourceIds: [legacy] });
    expect(result.issues.map(i => i.title)).toEqual(['Fix intake']);
  });

  it('keeps resolving team source ids stored by the legacy app-install integration', async () => {
    fakePlatform();
    const legacy = `linear-team:${Buffer.from(JSON.stringify({ workspaceId: 'org-acme', teamId: 'team-eng' })).toString('base64url')}`;

    const result = await new PlatformLinearIntegration().intake.listIssues({ connection, sourceIds: [legacy] });
    expect(result.issues.map(i => i.title)).toContain('Fix intake');
  });

  it('fetches issue detail with comments across connections', async () => {
    fakePlatform();
    const detail = await new PlatformLinearIntegration().intake.getIssue({ connection, issueId: 'ENG-42' });

    expect(detail).toMatchObject({ title: 'Fix intake' });
    expect(JSON.stringify(detail)).toContain('Looks related');
  });

  it('returns null for an issue no connection knows about', async () => {
    fakePlatform();
    await expect(
      new PlatformLinearIntegration().intake.getIssue({ connection, issueId: 'NOPE-1' }),
    ).resolves.toBeNull();
  });

  it('comments through the connection that owns the issue', async () => {
    const { mutations } = fakePlatform();
    const comment = await new PlatformLinearIntegration().intake.createComment({
      connection,
      issueId: 'OPS-7',
      body: 'On it',
    });

    expect(comment).toEqual({ id: 'comment-new', url: 'https://linear.app/c' });
    expect(mutations).toEqual([
      { connectionId: 'conn-beta', name: 'commentCreate', variables: { input: { issueId: 'OPS-7', body: 'On it' } } },
    ]);
  });

  it('moves an issue to the first workflow state of the requested type', async () => {
    const { mutations } = fakePlatform();
    const updated = await new PlatformLinearIntegration().intake.updateIssue({
      connection,
      issueId: 'ENG-42',
      state: { kind: 'byType', stateType: 'started' },
    });

    expect(mutations).toEqual([
      { connectionId: 'conn-acme', name: 'issueUpdate', variables: { id: 'issue-1', input: { stateId: 'state-progress' } } },
    ]);
    expect(updated).toMatchObject({ state: 'In Progress', stateType: 'started' });
  });

  it('skips the write when the issue is already in the target state', async () => {
    const { mutations } = fakePlatform();
    await new PlatformLinearIntegration().intake.updateIssue({
      connection,
      issueId: 'ENG-42',
      state: { kind: 'byType', stateType: 'unstarted' },
    });
    expect(mutations).toEqual([]);
  });

  it('creates issues through the connection for the requested workspace', async () => {
    const { mutations } = fakePlatform();
    const integration = new PlatformLinearIntegration();

    const teams = await integration.listAllTeams();
    expect(teams.map(t => [t.key, t.workspaceId])).toEqual([
      ['ENG', 'org-acme'],
      ['OPS', 'org-beta'],
    ]);

    const created = await integration.createIssue('org-beta', { teamId: 'team-ops', title: 'New' });
    expect(created.identifier).toBe('ENG-99');
    expect(mutations[0]).toMatchObject({ connectionId: 'conn-beta', name: 'issueCreate' });
  });

  it('reports a Connect-backed connection only while one is active', async () => {
    fakePlatform({ connections: [{ id: 'conn-stale', status: 'needs_reauth', accountLabel: null }] });
    const integration = new PlatformLinearIntegration();
    await expect(integration.loadConnection('org-1')).resolves.toBeNull();
    await expect(integration.checkConnection('org-1')).resolves.toMatchObject({ connected: false, canCreateIssues: false });
  });

  it('names the Connect connection in the compatibility row, never the Platform secret', async () => {
    fakePlatform();
    const row = await new PlatformLinearIntegration().loadConnection('org-1');

    expect(row).toMatchObject({ accessToken: 'linear-connection:conn-acme', workspaceName: 'Acme' });
    expect(JSON.stringify(row)).not.toContain('platform-token');
  });

  it('drops the legacy OAuth routes and reports Connect status', async () => {
    fakePlatform();
    const integration = new PlatformLinearIntegration();
    const ctx = {
      auth: { enabled: () => false },
      storage: { intake: {}, projects: {} },
      runtime: {},
      baseUrl: 'https://factory.example.com',
    } as unknown as IntegrationContext;

    const paths = integration.routes(ctx).map(route => route.path);
    expect(paths.some(path => path.startsWith('/auth/linear/'))).toBe(false);
  });

  describe('workers', () => {
    const workerContext = {
      controller: {},
      storage: { generic: {}, sourceControl: {}, projects: { listAll: async () => [] }, intake: {} },
      runtime: { configVersion: 'test-v1', workItems: {} },
    } as unknown as IntegrationContext;

    it('registers an issue reconcile worker', () => {
      expect(new PlatformLinearIntegration().workers(workerContext).map(worker => worker.name)).toEqual([
        'linear-issue-reconcile',
      ]);
    });

    it('registers nothing when issue reconciliation is disabled', () => {
      vi.stubEnv('MASTRACODE_LINEAR_ISSUE_RECONCILE_ENABLED', 'false');
      expect(new PlatformLinearIntegration().workers(workerContext)).toEqual([]);
    });
  });
});
