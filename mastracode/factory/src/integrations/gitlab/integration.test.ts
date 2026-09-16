import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { PlatformGitLabIntegration } from '../platform/gitlab/integration.js';
import {
  decodeIssueReference,
  decodeSourceId,
  encodeIssueReference,
  encodeSourceId,
  GitLabIntegration,
} from './integration.js';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function project(id: number, path: string) {
  return {
    id,
    name: path.split('/').at(-1),
    path_with_namespace: path,
    web_url: `https://gitlab.com/${path}`,
    default_branch: 'main',
  };
}

function issue(projectId = 10, iid = 42, path = 'mastra/platform') {
  return {
    id: projectId * 1000 + iid,
    iid,
    project_id: projectId,
    title: 'Fix intake sync',
    description: 'The full issue description.',
    state: 'opened' as const,
    web_url: `https://gitlab.com/${path}/-/issues/${iid}`,
    author: { name: 'Grace', username: 'grace' },
    assignee: { name: 'Ada', username: 'ada' },
    assignees: [{ name: 'Ada', username: 'ada' }],
    labels: ['bug'],
    user_notes_count: 1,
    created_at: '2026-08-30T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

function direct(fetchImpl: typeof fetch): GitLabIntegration {
  return new GitLabIntegration({
    baseUrl: 'https://gitlab.com',
    accessToken: 'group-token',
    accessTokenType: 'group',
    fetchImpl,
  });
}

const platformConnections = [
  { id: 'a1b_mastra', integrationId: 'gitlab-group-token', status: 'active', accountLabel: 'mastra' },
  { id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' },
  { id: 'a1b_jira', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
] as const;

function platform(connectionId = 'a1b_mastra'): PlatformGitLabIntegration {
  return new PlatformGitLabIntegration({
    clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
    connectionId,
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GitLabIntegration', () => {
  it('exposes webhook configuration and the unauthenticated webhook route without leaking the secret', () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token', webhookSecret: 'webhook-secret' });

    expect(
      gitlab
        .routes({ auth: fakeRouteAuth({ enabled: true }) } as never)
        .map(route => ({ path: route.path, requiresAuth: route.requiresAuth })),
    ).toEqual([
      { path: '/web/gitlab/status', requiresAuth: false },
      { path: '/web/gitlab/projects', requiresAuth: false },
      { path: '/web/gitlab/webhook', requiresAuth: false },
    ]);
    expect(gitlab.diagnostics()).toMatchObject({ webhookConfigured: true });
    expect(JSON.stringify(gitlab.diagnostics())).not.toContain('webhook-secret');
  });

  it.each(['personal', 'group'] as const)('supports a direct %s access token without exposing it', async accessTokenType => {
    const accessToken = `glpat-${accessTokenType}-secret`;
    const gitlab = new GitLabIntegration({ accessToken, accessTokenType });
    const reference = encodeIssueReference({
      connectionId: 'direct',
      projectId: '10',
      projectPath: 'mastra/platform',
      issueIid: 42,
    });

    const resolved = await gitlab.intake.resolveIntakeDispatch?.({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: reference },
    });

    expect(gitlab.diagnostics()).toMatchObject({ mode: 'direct', accessTokenType });
    expect(resolved?.connection).toEqual({ type: 'oauth', accessToken: 'gitlab-direct-access-token' });
    expect(JSON.stringify({ diagnostics: gitlab.diagnostics(), resolved })).not.toContain(accessToken);
  });

  it('reads direct token settings from the environment and validates the token type', () => {
    vi.stubEnv('GITLAB_ACCESS_TOKEN', 'glpat-env-secret');
    vi.stubEnv('GITLAB_ACCESS_TOKEN_TYPE', 'group');
    vi.stubEnv('GITLAB_BASE_URL', 'https://gitlab.acme.test/');
    vi.stubEnv('GITLAB_WEBHOOK_SECRET', 'hook-secret');

    expect(new GitLabIntegration().diagnostics()).toMatchObject({
      accessTokenType: 'group',
      endpointHost: 'gitlab.acme.test',
      webhookConfigured: true,
    });

    vi.stubEnv('GITLAB_ACCESS_TOKEN_TYPE', 'project');
    expect(() => new GitLabIntegration()).toThrow(/GITLAB_ACCESS_TOKEN_TYPE/);
  });

  it('requires a direct access token', () => {
    vi.stubEnv('GITLAB_ACCESS_TOKEN', '');
    expect(() => new GitLabIntegration()).toThrow(/GITLAB_ACCESS_TOKEN/);
  });

  it('uses a direct group token and exposes projects as intake sources', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json([project(10, 'mastra/platform')]));
    const gitlab = direct(fetchMock);

    const sources = await gitlab.intake.listSources({ orgId: 'org-1', userId: 'user-1' });

    expect(sources).toHaveLength(1);
    expect(decodeSourceId(sources[0]!.id)).toEqual({
      connectionId: 'direct',
      projectId: '10',
      projectPath: 'mastra/platform',
    });
    expect(sources[0]).toMatchObject({
      name: 'mastra/platform',
      type: 'project',
      metadata: { defaultBranch: 'main', accountLabel: 'gitlab.com' },
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'private-token': 'group-token' });
  });

  it('fetches issue detail, discussion notes, comments, and state changes directly', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(issue()))
      .mockResolvedValueOnce(
        json([
          { id: 1, body: 'system', author: { username: 'bot' }, created_at: '2026-09-01T01:00:00Z', system: true },
          { id: 2, body: 'ship it', author: { name: 'Lin', username: 'lin' }, created_at: '2026-09-01T02:00:00Z' },
        ]),
      )
      .mockResolvedValueOnce(json(issue()))
      .mockResolvedValueOnce(json({ id: 3, body: 'done', created_at: '2026-09-01T03:00:00Z' }))
      .mockResolvedValueOnce(json(issue()))
      .mockResolvedValueOnce(json({ ...issue(), state: 'closed' }));
    const gitlab = direct(fetchMock);
    const sourceId = encodeSourceId({ connectionId: 'direct', projectId: '10', projectPath: 'mastra/platform' });

    const detail = await gitlab.intake.getIssue({
      connection: { type: 'oauth', accessToken: 'group-token' },
      sourceId,
      issueId: '42',
    });
    const comment = await gitlab.intake.createComment({
      connection: { type: 'oauth', accessToken: 'group-token' },
      sourceId,
      issueId: '42',
      body: 'done',
    });
    const updated = await gitlab.intake.updateIssue({
      connection: { type: 'oauth', accessToken: 'group-token' },
      sourceId,
      issueId: '42',
      state: { kind: 'byType', stateType: 'completed' },
    });

    expect(detail).toMatchObject({
      identifier: 'mastra/platform#42',
      description: 'The full issue description.',
      comments: [{ author: 'Lin', body: 'ship it' }],
    });
    expect(comment).toEqual({ id: '3', url: 'https://gitlab.com/mastra/platform/-/issues/42#note_3' });
    expect(updated).toMatchObject({ state: 'closed', stateType: 'completed' });
  });

  it('resolves project-qualified issue shorthand for the read tool', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(json(issue())).mockResolvedValueOnce(json([]));

    const detail = await direct(fetchMock).intake.getIssue({
      connection: { type: 'oauth', accessToken: 'gitlab-tool' },
      issueId: 'mastra/platform#42',
    });

    expect(detail?.identifier).toBe('mastra/platform#42');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/projects/mastra%2Fplatform/issues/42');
  });
});

describe('PlatformGitLabIntegration', () => {
  it('inherits the complete provider surface without configuring a direct webhook secret', () => {
    const gitlab = platform();

    expect(gitlab.intake).toBeDefined();
    expect(gitlab.versionControl).toBeDefined();
    expect(gitlab.routes({ auth: fakeRouteAuth({ enabled: true }) } as never).map(route => route.path)).toEqual([
      '/web/gitlab/status',
      '/web/gitlab/projects',
      '/web/gitlab/webhook',
    ]);
    expect(gitlab.diagnostics()).toMatchObject({
      mode: 'platform',
      connectionConfigured: true,
      webhookConfigured: false,
    });
  });

  it('lists projects only from the explicitly configured Platform connection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) return json({ connections: platformConnections });
      if (url.includes('a1b_mastra/proxy')) return json([project(10, 'mastra/platform')]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const sources = await platform().intake.listSources({ orgId: 'org-1', userId: 'user-1' });

    expect(sources.map(source => source.name)).toEqual(['mastra/platform']);
    expect(decodeSourceId(sources[0]!.id)?.connectionId).toBe('a1b_mastra');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/proxy/'))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('a1b_acme/proxy'))).toBe(false);
  });

  it('keeps issue references scoped to the configured connection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) return json({ connections: platformConnections });
      if (url.includes('a1b_mastra/proxy')) return json([issue(10, 42, 'mastra/platform')]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const sourceId = encodeSourceId({
      connectionId: 'a1b_mastra',
      projectId: '10',
      projectPath: 'mastra/platform',
    });

    const page = await platform().intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: [sourceId],
    });

    expect(page.items[0]?.title).toBe('mastra/platform#42: Fix intake sync');
    expect(decodeIssueReference(page.items[0]!.source.externalId)).toEqual({
      connectionId: 'a1b_mastra',
      projectId: '10',
      projectPath: 'mastra/platform',
      issueIid: 42,
    });
  });

  it('resolves persisted issue references to an opaque Platform connection marker', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ connections: platformConnections }));
    vi.stubGlobal('fetch', fetchMock);
    const reference = encodeIssueReference({
      connectionId: 'a1b_mastra',
      projectId: '10',
      projectPath: 'mastra/platform',
      issueIid: 42,
    });

    const resolved = await platform().intake.resolveIntakeDispatch?.({
      orgId: 'org-1',
      externalSource: { type: 'issue', externalId: reference },
    });
    expect(resolved).toEqual({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:a1b_mastra' },
      sourceId: encodeSourceId({ connectionId: 'a1b_mastra', projectId: '10', projectPath: 'mastra/platform' }),
      issueId: '42',
    });
    expect(JSON.stringify(resolved)).not.toContain('platform-token');
  });

  it('uses MASTRA_GITLAB_CONNECTION_ID and requires it when omitted', () => {
    vi.stubEnv('MASTRA_GITLAB_CONNECTION_ID', 'a1b_mastra');
    expect(
      new PlatformGitLabIntegration({
        clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
      }).diagnostics(),
    ).toMatchObject({ connectionConfigured: true });

    vi.stubEnv('MASTRA_GITLAB_CONNECTION_ID', '');
    expect(
      () =>
        new PlatformGitLabIntegration({
          clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
        }),
    ).toThrow(/MASTRA_GITLAB_CONNECTION_ID/);
  });
});
