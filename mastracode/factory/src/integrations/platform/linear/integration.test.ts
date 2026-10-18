import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import {
  dedupeIssuesBySource,
  encodeSourceId,
  encodeTeamSourceId,
  linearConnectionToken,
  PlatformLinearIntegration,
} from './integration.js';

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
  /** Serve projects one per page, keyed by the requested cursor, to exercise pagination. */
  pageProjects?: boolean;
  /** Override the issues page served for a request, e.g. to hand back a stuck cursor. */
  issuePage?: (variables: Record<string, any>) => { nodes?: Array<ReturnType<typeof rawIssue>>; pageInfo?: PageInfo };
};

type PageInfo = { hasNextPage: boolean; endCursor: string | null };

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
  const projectQueries: Array<{ query: string; after: string | null }> = [];

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
    if (query.includes('projects(')) {
      projectQueries.push({ query, after: variables.after ?? null });
      if (!workspace.pageProjects) return json({ data: { projects: { nodes: workspace.projects, pageInfo: page } } });
      const index = variables.after ? Number(variables.after) : 0;
      const hasNextPage = index + 1 < workspace.projects.length;
      return json({
        data: {
          projects: {
            nodes: workspace.projects.slice(index, index + 1),
            pageInfo: { hasNextPage, endCursor: hasNextPage ? String(index + 1) : null },
          },
        },
      });
    }
    if (query.includes('teams(')) return json({ data: { teams: { nodes: workspace.teams, pageInfo: page } } });
    if (query.includes('issues(')) {
      const projectId = variables.filter?.project?.id?.eq;
      const teamId = variables.filter?.team?.id?.eq;
      const nodes = workspace.issues.filter(
        i => (!projectId || i.project?.id === projectId) && (!teamId || i.team.id === teamId),
      );
      const override = workspace.issuePage?.(variables);
      return json({ data: { issues: { nodes: override?.nodes ?? nodes, pageInfo: override?.pageInfo ?? page } } });
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
  return { fetchMock, mutations, proxied, projectQueries };
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

const ACME = { linearWorkspaceId: 'org-acme', connectionId: 'conn-acme' };
const BETA = { linearWorkspaceId: 'org-beta', connectionId: 'conn-beta' };

describe('PlatformLinearIntegration', () => {
  it('lists projects and teams from every active Connect connection as Intake sources', async () => {
    const { proxied } = fakePlatform();
    const sources = await new PlatformLinearIntegration().intake.listSources({ connection });

    expect(sources.map(source => [source.type, source.name, source.id])).toEqual([
      ['project', 'Platform', encodeSourceId(ACME, 'project-1')],
      ['team', 'Engineering', encodeTeamSourceId(ACME, 'team-eng')],
      ['team', 'Operations', encodeTeamSourceId(BETA, 'team-ops')],
    ]);
    expect(proxied).not.toContain('conn-stale');
  });

  it('pages through every project with a query that stays under the Linear complexity limit', async () => {
    const project = (n: number) => ({
      id: `project-${n}`,
      name: `Project ${n}`,
      state: 'started',
      teams: { nodes: [{ id: 'team-eng', key: 'ENG', name: 'Engineering' }] },
    });
    const { projectQueries } = fakePlatform({
      connections: [{ id: 'conn-acme', status: 'active', accountLabel: 'Acme' }],
      workspaces: { 'conn-acme': { ...acme(), projects: [project(1), project(2), project(3)], pageProjects: true } },
    });

    const projects = await new PlatformLinearIntegration().listProjects();

    expect(projects.map(p => p.name)).toEqual(['Project 1', 'Project 2', 'Project 3']);
    expect(projectQueries.map(q => q.after)).toEqual([null, '1', '2']);
    for (const { query } of projectQueries) {
      expect(query).toContain('projects(first: 100, after: $after)');
      expect(query).toContain('teams(first: 10)');
    }
  });

  it('skips an active connection whose workspace cannot be loaded instead of failing every workspace', async () => {
    fakePlatform({
      connections: [
        { id: 'conn-acme', status: 'active', accountLabel: 'Acme' },
        { id: 'conn-revoked', status: 'active', accountLabel: 'Revoked' },
        { id: 'conn-beta', status: 'active', accountLabel: 'Beta' },
      ],
    });
    const linear = new PlatformLinearIntegration();

    expect((await linear.listWorkspaces()).map(workspace => workspace.connectionId)).toEqual([
      'conn-acme',
      'conn-beta',
    ]);
    expect((await linear.intake.listSources({ connection })).map(source => source.name)).toEqual([
      'Platform',
      'Engineering',
      'Operations',
    ]);
    expect((await linear.listAllTeams()).map(team => team.key)).toEqual(['ENG', 'OPS']);
  });

  it('lists sources per connection and routes each through the connection it was bound with', async () => {
    const { proxied } = fakePlatform({
      connections: [
        { id: 'conn-acme', status: 'active', accountLabel: 'joel@acme' },
        { id: 'conn-acme-2', status: 'active', accountLabel: 'factory@acme' },
      ],
      workspaces: { 'conn-acme': acme(), 'conn-acme-2': acme() },
    });
    const linear = new PlatformLinearIntegration();

    const sources = await linear.intake.listSources({ connection });
    expect(sources.map(source => [source.name, source.metadata?.connectionLabel])).toEqual([
      ['Platform', 'joel@acme'],
      ['Platform', 'factory@acme'],
      ['Engineering', 'joel@acme'],
      ['Engineering', 'factory@acme'],
    ]);

    const factorySource = encodeTeamSourceId({ linearWorkspaceId: 'org-acme', connectionId: 'conn-acme-2' }, 'team-eng');
    proxied.length = 0;
    await linear.intake.listIssues({ connection, sourceIds: [factorySource] });
    expect(new Set(proxied)).toEqual(new Set(['conn-acme-2']));

    const { mutations } = fakePlatform({
      connections: [
        { id: 'conn-acme', status: 'active', accountLabel: 'joel@acme' },
        { id: 'conn-acme-2', status: 'active', accountLabel: 'factory@acme' },
      ],
      workspaces: { 'conn-acme': acme(), 'conn-acme-2': acme() },
    });
    await new PlatformLinearIntegration().intake.createComment({
      connection,
      sourceId: factorySource,
      issueId: 'ENG-42',
      body: 'Hi',
    });
    expect(mutations.map(mutation => mutation.connectionId)).toEqual(['conn-acme-2']);
  });

  it('offers agent tools each workspace team once when several connections authorize it', async () => {
    fakePlatform({
      connections: [
        { id: 'conn-acme', status: 'active', accountLabel: 'Acme' },
        { id: 'conn-acme-2', status: 'active', accountLabel: 'Acme' },
      ],
      workspaces: { 'conn-acme': acme(), 'conn-acme-2': acme() },
    });
    expect((await new PlatformLinearIntegration().listAllTeams()).map(team => team.key)).toEqual(['ENG']);
  });

  it('lists issues for a team source through the owning connection proxy', async () => {
    const { proxied } = fakePlatform();
    const teamSource = encodeTeamSourceId(BETA, 'team-ops');

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

    const result = await new PlatformLinearIntegration().intake.listIssues({ connection, sourceIds: [legacy] });
    expect(result.issues.map(i => i.title)).toEqual(['Fix intake']);
  });

  it('keeps resolving team source ids stored by the legacy app-install integration', async () => {
    fakePlatform();
    const legacy = `linear-team:${Buffer.from(JSON.stringify({ workspaceId: 'org-acme', teamId: 'team-eng' })).toString('base64url')}`;

    const result = await new PlatformLinearIntegration().intake.listIssues({ connection, sourceIds: [legacy] });
    expect(result.issues.map(i => i.title)).toContain('Fix intake');
  });

  it('normalizes active project issues and filters labels client-side', async () => {
    const requested: Array<Record<string, any>> = [];
    const workspace = acme();
    workspace.issues.push(
      rawIssue({
        id: 'issue-3',
        identifier: 'ENG-43',
        title: 'Add export',
        labels: { nodes: [{ id: 'label-2', name: 'feature' }] },
      }),
    );
    workspace.issuePage = variables => {
      requested.push(variables);
      return undefined;
    };
    fakePlatform({
      connections: [{ id: 'conn-acme', status: 'active', accountLabel: 'Acme' }],
      workspaces: { 'conn-acme': workspace },
    });
    const projectSource = encodeSourceId(ACME, 'project-1');
    const linear = new PlatformLinearIntegration();

    const unfiltered = await linear.intake.listIssues({ connection, sourceIds: [projectSource] });
    expect(unfiltered.issues.map(i => i.identifier)).toEqual(['ENG-42', 'ENG-43']);

    const result = await linear.intake.listIssues({ connection, sourceIds: [projectSource], labels: [' bug ', ''] });
    expect(result).toEqual({
      issues: [
        expect.objectContaining({
          id: 'issue-1',
          identifier: 'ENG-42',
          title: 'Fix intake',
          sourceId: projectSource,
          stateType: 'unstarted',
          priority: 'High',
          assignee: 'Ada',
          labels: ['bug'],
        }),
      ],
      nextCursor: null,
    });
    // Labels are filtered locally; Linear is only asked for active issues in the project.
    expect(requested.at(-1)?.filter).toEqual({
      state: { type: { in: ['triage', 'backlog', 'unstarted', 'started'] } },
      project: { id: { eq: 'project-1' } },
    });
  });

  it('dedupes an issue selected via several sources, keeping the first selected source', async () => {
    fakePlatform({
      connections: [
        { id: 'conn-acme', status: 'active', accountLabel: 'joel@acme' },
        { id: 'conn-acme-2', status: 'active', accountLabel: 'factory@acme' },
      ],
      workspaces: { 'conn-acme': acme(), 'conn-acme-2': acme() },
    });
    const viaFactory = encodeTeamSourceId({ linearWorkspaceId: 'org-acme', connectionId: 'conn-acme-2' }, 'team-eng');
    const viaJoel = encodeTeamSourceId(ACME, 'team-eng');

    const result = await new PlatformLinearIntegration().intake.listIssues({
      connection,
      sourceIds: [viaFactory, viaJoel],
    });

    expect(result.issues.map(i => [i.id, i.sourceId])).toEqual([['issue-1', viaFactory]]);
  });

  it('dedupes an issue selected via both a team and its project, project wins (most-specific)', () => {
    const projectSource = encodeSourceId(ACME, 'project-1');
    const teamSource = encodeTeamSourceId(ACME, 'team-eng');
    const entries = [
      { issue: { id: 'issue-1' }, sourceId: teamSource },
      { issue: { id: 'issue-2' }, sourceId: teamSource },
      { issue: { id: 'issue-1' }, sourceId: projectSource },
    ];

    // The team is selected first, so selection order alone would hand it the overlapping issue.
    expect(dedupeIssuesBySource(entries, [teamSource, projectSource])).toEqual([
      { issue: { id: 'issue-1' }, sourceId: projectSource },
      { issue: { id: 'issue-2' }, sourceId: teamSource },
    ]);
  });

  it('routes an issue reachable via a selected team and its selected project to the project', async () => {
    const workspace = acme();
    workspace.issues.push(rawIssue({ id: 'issue-2', identifier: 'ENG-99', project: null, labels: { nodes: [] } }));
    fakePlatform({
      connections: [{ id: 'conn-acme', status: 'active', accountLabel: 'Acme' }],
      workspaces: { 'conn-acme': workspace },
    });
    const projectSource = encodeSourceId(ACME, 'project-1');
    const teamSource = encodeTeamSourceId(ACME, 'team-eng');

    // The team is selected first, so selection order alone would hand it the overlapping issue.
    const result = await new PlatformLinearIntegration().intake.listIssues({
      connection,
      sourceIds: [teamSource, projectSource],
    });

    // Team and project pages are fetched in parallel, so only the attribution is asserted.
    expect(result.issues.map(i => [i.id, i.sourceId]).sort()).toEqual([
      ['issue-1', projectSource],
      ['issue-2', teamSource],
    ]);
  });

  it('keeps a selected-project issue out of an earlier team page', async () => {
    const workspace = acme();
    // The project page is still empty while the team page already returns the project's issue.
    workspace.issuePage = variables =>
      variables.filter?.project ? { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'project-next' } } : undefined;
    fakePlatform({
      connections: [{ id: 'conn-acme', status: 'active', accountLabel: 'Acme' }],
      workspaces: { 'conn-acme': workspace },
    });
    const projectSource = encodeSourceId(ACME, 'project-1');
    const teamSource = encodeTeamSourceId(ACME, 'team-eng');

    const result = await new PlatformLinearIntegration().intake.listIssues({
      connection,
      sourceIds: [projectSource, teamSource],
    });

    expect(result.issues).toEqual([]);
    expect(result.nextCursor).not.toBeNull();
  });

  it('rejects an issue page that hands back the cursor it was asked for', async () => {
    const workspace = acme();
    const afters: Array<string | null> = [];
    workspace.issuePage = variables => {
      afters.push(variables.after);
      return { pageInfo: { hasNextPage: true, endCursor: 'stuck' } };
    };
    fakePlatform({
      connections: [{ id: 'conn-acme', status: 'active', accountLabel: 'Acme' }],
      workspaces: { 'conn-acme': workspace },
    });
    const projectSource = encodeSourceId(ACME, 'project-1');
    const linear = new PlatformLinearIntegration();

    const first = await linear.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds: [projectSource] });
    expect(first.nextCursor).not.toBeNull();

    await expect(
      linear.intake.listItems({
        orgId: 'org-1',
        userId: 'user-1',
        sourceIds: [projectSource],
        cursor: first.nextCursor!,
      }),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
    expect(afters).toEqual([null, 'stuck']);
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
    expect(teams.map(t => [t.key, t.workspaceId, t.connectionId])).toEqual([
      ['ENG', 'org-acme', 'conn-acme'],
      ['OPS', 'org-beta', 'conn-beta'],
    ]);

    const created = await integration.createIssue('conn-beta', { teamId: 'team-ops', title: 'New' });
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
