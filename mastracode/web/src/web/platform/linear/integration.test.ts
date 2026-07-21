import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '@mastra/factory/integrations/base';

import { __resetRuntimeConfigForTests, seedRuntimeConfig } from '../../runtime-config.js';
import { seedFactoryStorageForTests } from '../../storage/test-utils.js';
import { PlatformLinearIntegration } from './integration.js';

const config = {
  baseUrl: 'https://platform.example.com/',
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
  vi.stubEnv('MASTRA_PLATFORM_BASE_URL', config.baseUrl);
  vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', config.accessToken);
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function createIntegration(fetchImpl?: typeof fetch): PlatformLinearIntegration {
  if (fetchImpl) vi.stubGlobal('fetch', fetchImpl);
  return new PlatformLinearIntegration();
}

describe('PlatformLinearIntegration', () => {
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

  it('exposes platform-backed route and agent-tool surfaces without local OAuth routes', async () => {
    const seed = await seedFactoryStorageForTests();
    const integration = createIntegration();
    const projectRecord = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Acme app' },
    });
    seedRuntimeConfig({
      storage: seed.storage,
      authProvider: {} as never,
      integrations: [integration],
      stateSigner: { stable: true } as never,
    });
    const context = {
      storage: {
        generic: seed.integrations.forIntegration('linear'),
        sourceControl: seed.sourceControl.forIntegration('linear'),
        projects: seed.projects,
        intake: seed.intake,
      },
      stateSigner: {},
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic, projects: context.storage.projects });
    const routes = integration.routes(context);
    const requestContext = new RequestContext();
    requestContext.set('controller', { resourceId: projectRecord.id });

    expect(integration.id).toBe('linear');
    expect(integration.intake).toBeDefined();
    expect('versionControl' in integration).toBe(false);
    expect(routes.map(route => route.path)).toEqual(
      expect.arrayContaining(['/web/linear/status', '/web/linear/projects', '/web/linear/issues']),
    );
    expect(routes.some(route => route.path.startsWith('/auth/linear/'))).toBe(false);
    await expect(integration.agentTools({ requestContext })).resolves.toEqual(
      expect.objectContaining({ linear_get_issue: expect.anything(), linear_create_comment: expect.anything() }),
    );
    expect(integration.diagnostics()).toEqual({ mode: 'platform', endpointHost: 'platform.example.com' });
    expect(JSON.stringify(integration.diagnostics())).not.toContain(config.accessToken);
  });

  it('defaults the Platform base URL and requires the access token environment variable', () => {
    vi.stubEnv('MASTRA_PLATFORM_BASE_URL', '');
    expect(new PlatformLinearIntegration().diagnostics()).toEqual({
      mode: 'platform',
      endpointHost: 'platform.mastra.ai',
    });

    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    expect(() => new PlatformLinearIntegration()).toThrow(/MASTRA_PLATFORM_ACCESS_TOKEN/);
  });
});
