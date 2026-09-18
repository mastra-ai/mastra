import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformApiClient } from '../platform/api-client.js';
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
  return new GitLabIntegration({ baseUrl: 'https://gitlab.com', accessToken: 'group-token', fetchImpl });
}

const platformConnections = [
  { id: 'a1b_mastra', integrationId: 'gitlab-group-token', status: 'active', accountLabel: 'mastra' },
  { id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' },
  { id: 'a1b_jira', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
] as const;

function platform(): PlatformGitLabIntegration {
  return new PlatformGitLabIntegration({
    client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('GitLabIntegration', () => {
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
  it('lists projects from every active GitLab connection through integrations v2', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) return json({ connections: platformConnections });
      if (url.includes('a1b_mastra/proxy')) return json([project(10, 'mastra/platform')]);
      if (url.includes('a1b_acme/proxy')) return json([project(20, 'acme/app')]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const sources = await platform().intake.listSources({ orgId: 'org-1', userId: 'user-1' });

    expect(sources.map(source => source.name)).toEqual(['mastra/platform', 'acme/app']);
    expect(decodeSourceId(sources[0]!.id)?.connectionId).toBe('a1b_mastra');
    expect(decodeSourceId(sources[1]!.id)?.connectionId).toBe('a1b_acme');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/proxy/'))).toHaveLength(2);
  });

  it('keeps issue pagination and persisted references scoped to their connection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) return json({ connections: platformConnections });
      if (url.includes('a1b_mastra/proxy')) return json([issue(10, 42, 'mastra/platform')]);
      if (url.includes('a1b_acme/proxy')) return json([issue(20, 7, 'acme/app')]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const gitlab = platform();
    const sources = [
      encodeSourceId({ connectionId: 'a1b_mastra', projectId: '10', projectPath: 'mastra/platform' }),
      encodeSourceId({ connectionId: 'a1b_acme', projectId: '20', projectPath: 'acme/app' }),
    ];

    const first = await gitlab.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds: sources });
    const second = await gitlab.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds: sources,
      cursor: first.nextCursor ?? undefined,
    });

    expect(first.items[0]?.title).toBe('mastra/platform#42: Fix intake sync');
    expect(second.items[0]?.title).toBe('acme/app#7: Fix intake sync');
    expect(decodeIssueReference(first.items[0]!.source.externalId)).toEqual({
      connectionId: 'a1b_mastra',
      projectId: '10',
      projectPath: 'mastra/platform',
      issueIid: 42,
    });
  });

  it('resolves persisted issue references to a platform connection marker', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ connections: platformConnections }));
    vi.stubGlobal('fetch', fetchMock);
    const reference = encodeIssueReference({
      connectionId: 'a1b_acme',
      projectId: '20',
      projectPath: 'acme/app',
      issueIid: 7,
    });

    await expect(
      platform().intake.resolveIntakeDispatch?.({
        orgId: 'org-1',
        externalSource: { type: 'issue', externalId: reference },
      }),
    ).resolves.toEqual({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:a1b_acme' },
      sourceId: encodeSourceId({ connectionId: 'a1b_acme', projectId: '20', projectPath: 'acme/app' }),
      issueId: '7',
    });
  });
});
