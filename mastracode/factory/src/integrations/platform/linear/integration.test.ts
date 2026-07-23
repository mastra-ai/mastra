import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';

import { createPlatformStorageForTests } from '../test-utils.js';
import { PlatformLinearIntegration } from './integration.js';

const config = {
  baseUrl: 'https://platform.example.com/v1',
  accessToken: 'platform-token',
};
const workspace = {
  linearWorkspaceId: 'workspace-1',
  linearWorkspaceName: 'Acme',
  urlKey: 'acme',
  connected: true,
};
const sourceId = (workspaceId: string, projectId: string) =>
  `linear-project:${Buffer.from(JSON.stringify({ workspaceId, projectId })).toString('base64url')}`;
const project1SourceId = sourceId('workspace-1', 'project-1');
const project2SourceId = sourceId('workspace-2', 'project-2');

function fakeAuth(tenant: { orgId?: string; userId: string } | undefined = { orgId: 'org-1', userId: 'user-1' }) {
  return {
    enabled: () => true,
    ensureUser: vi.fn(async () => ({ workosId: tenant?.userId ?? 'user-1', organizationId: tenant?.orgId })),
    tenant: () => tenant,
    isOrganizationAdmin: vi.fn(async () => true),
  };
}

const project = {
  id: 'project-1',
  name: 'Platform',
  state: 'started',
  teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }],
};
const user = {
  id: 'user-1',
  name: 'Ada Lovelace',
  displayName: 'Ada',
  email: 'ada@example.com',
  avatarUrl: null,
};
const issue = {
  id: 'issue-1',
  identifier: 'ENG-42',
  number: 42,
  title: 'Fix intake',
  description: 'Issue body',
  url: 'https://linear.app/acme/issue/ENG-42',
  priority: 2,
  priorityLabel: 'High',
  labels: [{ id: 'label-1', name: 'bug' }],
  state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
  team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
  assignee: user,
  creator: user,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  archivedAt: null,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.stubEnv('MASTRA_SHARED_API_URL', config.baseUrl);
  vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', config.accessToken);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function createIntegration(fetchImpl?: typeof fetch): PlatformLinearIntegration {
  if (fetchImpl) vi.stubGlobal('fetch', fetchImpl);
  return new PlatformLinearIntegration();
}

describe('PlatformLinearIntegration', () => {
  it('does not expose the Platform secret through synthetic Linear connections', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ workspaces: [workspace] }));
    const integration = createIntegration(fetchImpl);

    const storedConnection = await integration.storage.connections.get('org-1');
    const loadedConnection = await integration.loadConnection('org-1');
    if (!loadedConnection) throw new Error('Expected a connected Platform Linear workspace.');

    expect(storedConnection?.data.accessToken).not.toBe(config.accessToken);
    expect(loadedConnection.accessToken).not.toBe(config.accessToken);
    await expect(integration.getFreshAccessToken(loadedConnection)).resolves.not.toBe(config.accessToken);
  });

  it('resolves dispatch context with the platform-managed token when a workspace is connected', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ workspaces: [workspace] }));
    const integration = createIntegration(fetchImpl);

    const resolved = await integration.resolveIntakeDispatch({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: 'issue-1' },
    });
    expect(resolved).toMatchObject({ connection: { type: 'oauth' }, issueId: 'issue-1' });
    expect((resolved?.connection as { accessToken?: string }).accessToken).not.toBe(config.accessToken);
  });

  it('returns null dispatch context without a connected workspace or for non-issue sources', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ workspaces: [] }));
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.resolveIntakeDispatch({
        orgId: 'org-1',
        externalSource: { type: 'issue', externalId: 'issue-1' },
      }),
    ).resolves.toBeNull();
    await expect(
      integration.resolveIntakeDispatch({
        orgId: 'org-1',
        externalSource: { type: 'pull-request', externalId: 'x' },
      }),
    ).resolves.toBeNull();
  });

  it('lists connected workspace projects as Intake sources', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ workspaces: [workspace, { ...workspace, linearWorkspaceId: 'old', connected: false }] }),
      )
      .mockResolvedValueOnce(json({ projects: [project], pageInfo: { hasNextPage: false, endCursor: null } }));
    const integration = createIntegration(fetchImpl);

    await expect(integration.intake.listSources({ orgId: 'org-1', userId: 'user-1' })).resolves.toEqual([
      {
        id: project1SourceId,
        name: 'Platform',
        type: 'project',
        metadata: expect.objectContaining({ workspaceId: 'workspace-1', workspaceName: 'Acme', state: 'started' }),
      },
    ]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://platform.example.com/v1/server/linear/workspaces',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer platform-token' }) }),
    );
  });

  it('normalizes active project issues and filters labels client-side', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ workspaces: [workspace] }))
      .mockResolvedValueOnce(json({ projects: [project], pageInfo: { hasNextPage: false, endCursor: null } }))
      .mockResolvedValueOnce(
        json({
          issues: [
            issue,
            { ...issue, id: 'issue-2', identifier: 'ENG-43', labels: [{ id: 'label-2', name: 'feature' }] },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-2' },
        }),
      );
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.listIssues({
        connection: { type: 'oauth', accessToken: 'unused-provider-token' },
        sourceIds: [project1SourceId],
        labels: ['bug'],
      }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: 'issue-1',
          identifier: 'ENG-42',
          source: 'ENG',
          stateType: 'unstarted',
          priority: 'High',
          assignee: 'Ada',
          labels: ['bug'],
        }),
      ],
      nextCursor: 'cursor-2',
    });
    const issuesUrl = String(fetchImpl.mock.calls[2]?.[0]);
    expect(issuesUrl).toContain('/workspaces/workspace-1/issues?');
    expect(issuesUrl).toContain('projectIds=project-1');
    expect(issuesUrl).toContain('stateType=triage%2Cbacklog%2Cunstarted%2Cstarted');
  });

  it('fetches issue details with comments and creates comments through the source workspace', async () => {
    const comment = {
      id: 'comment-1',
      body: 'Looking now',
      url: 'https://linear.app/acme/issue/ENG-42#comment-comment-1',
      issue: { id: 'issue-1', identifier: 'ENG-42' },
      user,
      parent: null,
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-03T00:00:00Z',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ ...issue, comments: { nodes: [comment], pageInfo: { hasNextPage: false, endCursor: null } } }),
      )
      .mockResolvedValueOnce(json(comment));
    const integration = createIntegration(fetchImpl);
    const connection = { type: 'oauth' as const, accessToken: 'unused-provider-token' };

    await expect(
      integration.intake.getIssue({ connection, sourceId: project1SourceId, issueId: 'ENG-42' }),
    ).resolves.toEqual(
      expect.objectContaining({
        description: 'Issue body',
        commentCount: 1,
        comments: [{ author: 'Ada', body: 'Looking now', createdAt: comment.createdAt }],
      }),
    );
    await expect(
      integration.intake.createComment({ connection, sourceId: project1SourceId, issueId: 'ENG-42', body: 'Done' }),
    ).resolves.toEqual({ id: 'comment-1', url: comment.url });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/issues/ENG-42?include=comments');
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'Done' }) }),
    );
  });

  it('resolves a byType target to a workflow state and PATCHes the Linear issue', async () => {
    const workflowStates = [
      { id: 'state-todo', name: 'Todo', type: 'unstarted', position: 1, teamId: 'team-1' },
      { id: 'state-done', name: 'Done', type: 'completed', position: 3, teamId: 'team-1' },
    ];
    const updatedIssue = { ...issue, state: { id: 'state-done', name: 'Done', type: 'completed' } };
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/workflow-states'))
        return json({ workflowStates, pageInfo: { hasNextPage: false, endCursor: null } });
      if (url.includes(`/issues/${encodeURIComponent('issue-1')}?include=comments`)) {
        // Two calls: initial locate + refreshed fetch after PATCH.
        return fetchImpl.mock.calls.filter(c => String(c[0]).includes('?include=comments')).length > 1
          ? json({ ...updatedIssue, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } })
          : json({ ...issue, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } });
      }
      return json({});
    });
    const integration = createIntegration(fetchImpl);

    const result = await integration.intake.updateIssue({
      connection: { type: 'oauth', accessToken: 'unused-provider-token' },
      sourceId: project1SourceId,
      issueId: 'issue-1',
      state: { kind: 'byType', stateType: 'completed' },
    });
    expect(result).toMatchObject({ id: 'issue-1', state: 'Done', stateType: 'completed' });

    const patchCall = fetchImpl.mock.calls.find(call => (call[1] as RequestInit).method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(String(patchCall![0])).toContain(`/workspaces/workspace-1/issues/${encodeURIComponent('issue-1')}`);
    expect(JSON.parse(String((patchCall![1] as RequestInit).body))).toEqual({ stateId: 'state-done' });
  });

  it('skips the PATCH when the current byType state already matches', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes(`/issues/${encodeURIComponent('issue-1')}?include=comments`)) {
        return json({ ...issue, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } });
      }
      return json({});
    });
    const integration = createIntegration(fetchImpl);

    const result = await integration.intake.updateIssue({
      connection: { type: 'oauth', accessToken: 'unused-provider-token' },
      sourceId: project1SourceId,
      issueId: 'issue-1',
      state: { kind: 'byType', stateType: 'unstarted' },
    });
    expect(result).toMatchObject({ stateType: 'unstarted' });
    expect(fetchImpl.mock.calls.some(c => (c[1] as RequestInit).method === 'PATCH')).toBe(false);
  });

  it('returns null when no workflow state matches the byType target', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/workflow-states')) {
        return json({
          workflowStates: [{ id: 'state-todo', name: 'Todo', type: 'unstarted', position: 1, teamId: 'team-1' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        });
      }
      if (url.includes(`/issues/${encodeURIComponent('issue-1')}?include=comments`)) {
        return json({ ...issue, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } });
      }
      return json({});
    });
    const integration = createIntegration(fetchImpl);
    await expect(
      integration.intake.updateIssue({
        connection: { type: 'oauth', accessToken: 'unused-provider-token' },
        sourceId: project1SourceId,
        issueId: 'issue-1',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toBeNull();
  });

  it('degrades to null when the workflow-states endpoint is not deployed on the platform', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/workflow-states')) return json({ detail: 'Not found' }, 404);
      if (url.includes(`/issues/${encodeURIComponent('issue-1')}?include=comments`)) {
        return json({ ...issue, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } });
      }
      return json({});
    });
    const integration = createIntegration(fetchImpl);
    await expect(
      integration.intake.updateIssue({
        connection: { type: 'oauth', accessToken: 'unused-provider-token' },
        sourceId: project1SourceId,
        issueId: 'issue-1',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toBeNull();
    expect(fetchImpl.mock.calls.some(c => (c[1] as RequestInit).method === 'PATCH')).toBe(false);
  });

  it('searches connected workspaces when issue operations have no source id and returns null on 404', async () => {
    const secondWorkspace = { ...workspace, linearWorkspaceId: 'workspace-2', linearWorkspaceName: 'Second' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ workspaces: [workspace, secondWorkspace] }))
      .mockResolvedValueOnce(json({ detail: 'Not found' }, 404))
      .mockResolvedValueOnce(json({ detail: 'Not found' }, 404));
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.getIssue({
        connection: { type: 'oauth', accessToken: 'unused-provider-token' },
        issueId: 'ENG-404',
      }),
    ).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('tracks independent cursors when selected projects span workspaces', async () => {
    const workspace2 = { ...workspace, linearWorkspaceId: 'workspace-2', linearWorkspaceName: 'Second' };
    const project2 = { ...project, id: 'project-2', name: 'Product' };
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/workspaces')) return json({ workspaces: [workspace, workspace2] });
      if (url.includes('/workspace-1/projects')) {
        return json({ projects: [project], pageInfo: { hasNextPage: false, endCursor: null } });
      }
      if (url.includes('/workspace-2/projects')) {
        return json({ projects: [project2], pageInfo: { hasNextPage: false, endCursor: null } });
      }
      if (url.includes('/workspace-1/issues')) {
        return json({ issues: [issue], pageInfo: { hasNextPage: false, endCursor: null } });
      }
      if (url.includes('/workspace-2/issues')) {
        return json({
          issues: [{ ...issue, id: 'issue-2', identifier: 'ENG-43' }],
          pageInfo: { hasNextPage: true, endCursor: 'next-2' },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = createIntegration(fetchImpl);

    const result = await integration.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [project1SourceId, project2SourceId],
    });
    expect(result.items).toHaveLength(2);
    expect(JSON.parse(result.nextCursor!)).toEqual({ [project1SourceId]: null, [project2SourceId]: 'next-2' });
  });

  it('propagates platform rate limits through Linear capabilities', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Rate limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '11' },
      }),
    );
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.listIssues({
        connection: { type: 'oauth', accessToken: 'unused-provider-token' },
        sourceIds: [project1SourceId],
      }),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 11 });
  });

  it('rejects GitHub-style app-installation connections', async () => {
    const integration = createIntegration();
    await expect(
      integration.intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: ['project-1'],
      }),
    ).rejects.toThrow('Linear capabilities require an OAuth connection.');
  });

  it('exposes platform-backed route and agent-tool surfaces with platform connect routing', async () => {
    const seed = await createPlatformStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.includes('/v1/server/linear/authorize')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://linear.app/oauth/authorize?state=abc' },
        });
      }
      return json({ workspaces: [workspace] });
    });
    const integration = createIntegration(fetchImpl);
    const projectRecord = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Acme app' },
    });
    const context = {
      auth: fakeAuth(),
      storage: {
        generic: seed.integrations.forIntegration('linear'),
        sourceControl: seed.sourceControl.forIntegration('linear'),
        projects: seed.projects,
        intake: seed.intake,
      },
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    integration.initialize?.({
      storage: context.storage.generic,
      projects: context.storage.projects,
      auth: context.auth,
    });
    const routes = integration.routes(context);
    const app = new Hono();
    for (const route of routes) {
      if ('handler' in route) app.on(route.method, route.path, route.handler as never);
    }
    const requestContext = new RequestContext();
    requestContext.set('controller', { resourceId: projectRecord.id });

    expect(integration.id).toBe('linear');
    expect(integration.intake).toBeDefined();
    expect('versionControl' in integration).toBe(false);
    expect(routes.map(route => route.path)).toEqual(
      expect.arrayContaining([
        '/auth/linear/connect',
        '/web/linear/status',
        '/web/linear/projects',
        '/web/linear/issues',
      ]),
    );
    expect(routes.some(route => route.path === '/auth/linear/callback')).toBe(false);
    await expect(app.request('/web/linear/status').then(res => res.json())).resolves.toMatchObject({
      enabled: true,
      connected: true,
      reason: 'ready',
      workspace: { name: 'Acme', urlKey: 'acme' },
    });
    const connect = await app.request('/auth/linear/connect');
    expect(connect.status).toBe(302);
    expect(connect.headers.get('location')).toBe('https://linear.app/oauth/authorize?state=abc');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://platform.example.com/v1/server/linear/authorize?return_to=%2F&originator=https%3A%2F%2Ffactory.example',
      expect.objectContaining({ redirect: 'manual' }),
    );
    await expect(integration.agentTools({ requestContext })).resolves.toEqual(
      expect.objectContaining({ linear_get_issue: expect.anything(), linear_create_comment: expect.anything() }),
    );
    expect(integration.diagnostics()).toEqual({ mode: 'platform', endpointHost: 'platform.example.com' });
    expect(JSON.stringify(integration.diagnostics())).not.toContain(config.accessToken);
  });

  it('defaults the Platform base URL and requires MASTRA_PLATFORM_SECRET_KEY', () => {
    vi.stubEnv('MASTRA_SHARED_API_URL', '');
    expect(new PlatformLinearIntegration().diagnostics()).toEqual({
      mode: 'platform',
      endpointHost: 'platform.mastra.ai',
    });

    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'legacy-token');
    expect(() => new PlatformLinearIntegration()).toThrow(/MASTRA_PLATFORM_SECRET_KEY/);
  });
});
