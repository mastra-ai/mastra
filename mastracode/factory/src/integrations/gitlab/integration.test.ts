import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
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
    labels: [{ name: 'bug', color: '#d73a4a', text_color: '#ffffff' }],
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
        .routes({ auth: fakeRouteAuth({ enabled: true }), storage: { intake: {} } } as never)
        .map(route => ({ path: route.path, requiresAuth: route.requiresAuth })),
    ).toEqual([
      { path: '/web/gitlab/status', requiresAuth: false },
      { path: '/web/gitlab/projects', requiresAuth: false },
      { path: '/web/gitlab/projects/registration', requiresAuth: false },
      { path: '/web/gitlab/projects/:id/prs', requiresAuth: false },
      { path: '/web/gitlab/projects/:id/prs/:number', requiresAuth: false },
      { path: '/web/gitlab/issues', requiresAuth: false },
      { path: '/web/gitlab/issues/:issueId', requiresAuth: false },
      { path: '/web/gitlab/subscriptions', requiresAuth: false },
      { path: '/web/gitlab/webhook', requiresAuth: false },
    ]);
    expect(gitlab.diagnostics()).toMatchObject({ webhookConfigured: true });
    expect(JSON.stringify(gitlab.diagnostics())).not.toContain('webhook-secret');
  });

  it.each(['personal', 'group'] as const)(
    'supports a direct %s access token without exposing it',
    async accessTokenType => {
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
    },
  );

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
  it('keeps canonical project identity stable across credential connections while decoding legacy ids', () => {
    const directId = encodeSourceId({
      host: 'GitLab.com',
      connectionId: 'direct',
      projectId: '10',
      projectPath: 'old/path',
    });
    const platformId = encodeSourceId({
      host: 'gitlab.com',
      connectionId: 'git_01_platform',
      projectId: '10',
      projectPath: 'new/path',
    });
    const legacyId = encodeSourceId({
      connectionId: 'direct',
      projectId: '10',
      projectPath: 'mastra/platform',
    });

    expect(platformId).toBe(directId);
    expect(decodeSourceId(legacyId)).toEqual({
      connectionId: 'direct',
      projectId: '10',
      projectPath: 'mastra/platform',
    });
  });

  it('uses a direct group token and exposes projects as intake sources', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json([project(10, 'mastra/platform')]));
    const gitlab = direct(fetchMock);

    const sources = await gitlab.intake.listSources({ orgId: 'org-1', userId: 'user-1' });

    expect(sources).toHaveLength(1);
    expect(decodeSourceId(sources[0]!.id)).toEqual({
      version: 2,
      host: 'gitlab.com',
      projectId: '10',
    });
    expect(sources[0]).toMatchObject({
      name: 'mastra/platform',
      type: 'project',
      metadata: { defaultBranch: 'main', accountLabel: 'gitlab.com' },
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'private-token': 'group-token' });
  });

  it('keeps a direct self-managed relative URL root when resolving clone access', async () => {
    const gitlab = new GitLabIntegration({
      baseUrl: 'https://gitlab.example.com/gitlab/',
      accessToken: 'group-token',
      accessTokenType: 'group',
    });
    const storage = new SourceControlStorageInMemory('gitlab');
    gitlab.versionControl.initialize({ storage });
    const installation = await gitlab.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: {
        externalId: 'direct',
        accountName: 'gitlab.example.com',
        metadata: { connection: { type: 'oauth', accessToken: 'gitlab-direct-access-token' } },
      },
    });
    const [repository] = await gitlab.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '10', slug: 'mastra/platform', defaultBranch: 'main' }],
    });

    await expect(
      gitlab.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository!.id }),
    ).resolves.toMatchObject({ cloneUrl: 'https://gitlab.example.com/gitlab/mastra/platform.git' });
  });

  it('round-trips a listed project-local issue id into an update', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json([{ ...issue(10, 42), weight: 3 }]))
      .mockResolvedValueOnce(json([issue(10, 42)]))
      .mockResolvedValueOnce(json({ ...issue(10, 42), state: 'closed' }));
    const gitlab = direct(fetchMock);
    const sourceId = encodeSourceId({ connectionId: 'direct', projectId: '10', projectPath: 'mastra/platform' });

    const page = await gitlab.intake.listIssues({
      connection: { type: 'oauth', accessToken: 'gitlab-direct-access-token' },
      sourceIds: [sourceId],
    });
    expect(page.issues[0]?.id).toBe('42');
    expect(page.issues[0]?.labels).toEqual(['bug']);
    expect(page.issues[0]?.labelColors).toEqual({ bug: '#d73a4a' });
    expect(page.issues[0]?.priority).toBe('3');
    expect(page.issues[0]).toMatchObject({ author: 'Grace', authorUsername: 'grace' });

    await gitlab.intake.updateIssue({
      connection: { type: 'oauth', accessToken: 'gitlab-direct-access-token' },
      sourceId,
      issueId: page.issues[0]!.id,
      state: { kind: 'byType', stateType: 'completed' },
    });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/projects/10/issues/42');
  });

  it('continues issue pagination across a full page and then the next selected project', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      const projectId = url.pathname.match(/\/projects\/(10|11)\/issues$/)?.[1];
      const page = Number(url.searchParams.get('page'));
      if (projectId === '10' && page === 1) return json(Array.from({ length: 30 }, (_, index) => issue(10, index + 1)));
      if (projectId === '10' && page === 2) return json([]);
      if (projectId === '11' && page === 1) return json([issue(11, 1, 'mastra/control')]);
      throw new Error(`Unexpected GitLab issue request: ${url.pathname}${url.search}`);
    });
    const gitlab = direct(fetchMock);
    const primary = encodeSourceId({ connectionId: 'direct', projectId: '10', projectPath: 'mastra/platform' });
    const control = encodeSourceId({ connectionId: 'direct', projectId: '11', projectPath: 'mastra/control' });
    const input = {
      connection: { type: 'oauth' as const, accessToken: 'gitlab-direct-access-token' },
      sourceIds: [primary, control],
    };

    const first = await gitlab.intake.listIssues(input);
    const second = await gitlab.intake.listIssues({ ...input, cursor: first.nextCursor ?? undefined });
    const third = await gitlab.intake.listIssues({ ...input, cursor: second.nextCursor ?? undefined });

    expect(first.issues).toHaveLength(30);
    expect(first.issues.every(candidate => decodeSourceId(candidate.sourceId)?.projectId === '10')).toBe(true);
    expect(second).toMatchObject({ issues: [] });
    expect(second.nextCursor).toBeTruthy();
    expect(third.issues).toMatchObject([{ id: '1' }]);
    expect(decodeSourceId(third.issues[0]!.sourceId)?.projectId).toBe('11');
    expect(third.nextCursor).toBeNull();
  });

  it('fetches issue detail, discussion notes, comments, and state changes directly', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json([issue()]))
      .mockResolvedValueOnce(
        json([
          { id: 1, body: 'system', author: { username: 'bot' }, created_at: '2026-09-01T01:00:00Z', system: true },
          { id: 2, body: 'ship it', author: { name: 'Lin', username: 'lin' }, created_at: '2026-09-01T02:00:00Z' },
        ]),
      )
      .mockResolvedValueOnce(json([issue()]))
      .mockResolvedValueOnce(json({ id: 3, body: 'done', created_at: '2026-09-01T03:00:00Z' }))
      .mockResolvedValueOnce(json([issue()]))
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
      author: 'Grace',
      authorUsername: 'grace',
      description: 'The full issue description.',
      labelColors: { bug: '#d73a4a' },
      comments: [{ author: 'Lin', body: 'ship it' }],
    });
    expect(comment).toEqual({ id: '3', url: 'https://gitlab.com/mastra/platform/-/issues/42#note_3' });
    expect(updated).toMatchObject({ state: 'closed', stateType: 'completed' });
  });

  it('resolves project-qualified issue shorthand for the read tool', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json([issue()]))
      .mockResolvedValueOnce(json([]));

    const detail = await direct(fetchMock).intake.getIssue({
      connection: { type: 'oauth', accessToken: 'gitlab-tool' },
      issueId: 'mastra/platform#42',
    });

    expect(detail?.identifier).toBe('mastra/platform#42');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/projects/mastra%2Fplatform/issues?iids%5B%5D=42');
  });

  it('does not resolve an issue URL through a linked repository on another GitLab host', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const gitlab = direct(fetchMock);
    const storage = new SourceControlStorageInMemory('gitlab');
    gitlab.versionControl.initialize({ storage });
    gitlab.initialize({ projects: {} as never, auth: fakeRouteAuth({ enabled: false }), sourceControl: storage });
    const installation = await storage.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'direct',
      providerMetadata: {
        host: 'gitlab.other.example',
        connection: { type: 'oauth', accessToken: 'gitlab-direct-access-token' },
      },
    });
    const repository = await storage.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: '10',
        slug: 'mastra/platform',
        defaultBranch: 'main',
      },
    });
    const connection = await storage.connections.create({
      orgId: 'org-1',
      factoryProjectId: 'factory-1',
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    await storage.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace',
    });

    await expect(
      gitlab.getIssueForFactoryProject({
        orgId: 'org-1',
        factoryProjectId: 'factory-1',
        issueId: 'https://gitlab.com/mastra/platform/-/issues/42',
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a direct token for a same-host repository linked under Platform OAuth', async () => {
    const gitlab = direct(vi.fn<typeof fetch>());
    const storage = new SourceControlStorageInMemory('gitlab');
    gitlab.versionControl.initialize({ storage });
    const installation = await storage.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'git_platform_connection',
      providerMetadata: {
        host: 'gitlab.com',
        connection: { type: 'oauth', accessToken: 'gitlab-connection:git_platform_connection' },
      },
    });
    const repository = await storage.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '10', slug: 'mastra/platform', defaultBranch: 'main' },
    });

    await expect(
      gitlab.versionControl.getRepositoryTarget({ orgId: 'org-1', repositoryId: repository.id }),
    ).resolves.toEqual({
      connection: { type: 'oauth', accessToken: 'gitlab-direct-access-token' },
      sourceId: '10:mastra/platform',
    });
    await expect(
      gitlab.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).resolves.toEqual({
      cloneUrl: 'https://gitlab.com/mastra/platform.git',
      authorization: { scheme: 'bearer', token: 'group-token', username: 'oauth2' },
    });
    await expect(gitlab.resolveActiveConnectionForHost('git_platform_connection', 'gitlab.com')).resolves.toBe(
      'direct',
    );
    await expect(
      gitlab.resolveActiveConnectionForHost('git_platform_connection', 'gitlab.other.example'),
    ).resolves.toBe('git_platform_connection');

    const otherHost = await storage.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'git_other_connection',
      providerMetadata: {
        host: 'gitlab.other.example',
        connection: { type: 'oauth', accessToken: 'gitlab-connection:git_other_connection' },
      },
    });
    const otherRepository = await storage.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: otherHost.id, externalId: '11', slug: 'mastra/other', defaultBranch: 'main' },
    });
    await expect(
      gitlab.versionControl.getRepositoryTarget({ orgId: 'org-1', repositoryId: otherRepository.id }),
    ).rejects.toThrow('GitLab connection is unavailable.');
  });
});

describe('PlatformGitLabIntegration', () => {
  it('inherits the complete provider surface without configuring a direct webhook secret', () => {
    const gitlab = platform();

    expect(gitlab.intake).toBeDefined();
    expect(gitlab.versionControl).toBeDefined();
    expect(
      gitlab
        .routes({ auth: fakeRouteAuth({ enabled: true }), storage: { intake: {} } } as never)
        .map(route => route.path),
    ).toEqual([
      '/web/gitlab/status',
      '/web/gitlab/projects',
      '/web/gitlab/projects/registration',
      '/web/gitlab/projects/:id/prs',
      '/web/gitlab/projects/:id/prs/:number',
      '/web/gitlab/issues',
      '/web/gitlab/issues/:issueId',
      '/web/gitlab/subscriptions',
      '/web/gitlab/webhook',
    ]);
    expect(gitlab.diagnostics()).toMatchObject({
      mode: 'platform',
      connectionFilterConfigured: true,
      webhookConfigured: false,
    });
  });
  it.each([
    {
      name: 'OAuth',
      credential: { type: 'oauth2', accessToken: 'oauth-clone-token', expiresAt: null },
      token: 'oauth-clone-token',
    },
    {
      name: 'group access token',
      credential: { type: 'api_key', apiKey: 'group-clone-token' },
      token: 'group-clone-token',
    },
  ])(
    'fetches a fresh $name credential for each repository operation without persisting it',
    async ({ credential, token }) => {
      let credentialResponse: unknown = credential;
      let credentialStatus = 200;
      const fetchMock = vi.fn<typeof fetch>(async input => {
        const url = String(input);
        if (url.includes('/v2/connections?providerKey=gitlab')) return json({ connections: platformConnections });
        if (url.endsWith('/v2/connections/a1b_mastra/credentials')) return json(credentialResponse, credentialStatus);
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);
      const gitlab = platform();
      const storage = new SourceControlStorageInMemory('gitlab');
      gitlab.versionControl.initialize({ storage });
      const installation = await gitlab.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: {
          externalId: 'a1b_mastra',
          accountName: 'mastra',
          accountType: 'GitLab',
          metadata: { connection: { type: 'oauth', accessToken: 'gitlab-connection:a1b_mastra' } },
        },
      });
      const [repository] = await gitlab.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [{ externalId: '10', slug: 'mastra/platform', defaultBranch: 'main' }],
      });

      const input = { orgId: 'org-1', repositoryId: repository!.id };
      await expect(
        gitlab.versionControl.getRepositoryAccess({ orgId: 'org-other', repositoryId: repository!.id }),
      ).rejects.toThrow('Version-control repository not found.');
      expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/credentials'))).toHaveLength(0);
      await expect(gitlab.versionControl.getRepositoryAccess(input)).resolves.toEqual({
        cloneUrl: 'https://gitlab.com/mastra/platform.git',
        authorization: { scheme: 'bearer', token, username: 'oauth2' },
      });
      await gitlab.versionControl.getRepositoryAccess(input);
      expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/credentials'))).toHaveLength(2);
      expect(JSON.stringify({ installation, repository, diagnostics: gitlab.diagnostics() })).not.toContain(token);
      credentialResponse = { type: 'oauth2', accessToken: '' };
      await expect(gitlab.versionControl.getRepositoryAccess(input)).rejects.toMatchObject<Partial<GitLabApiError>>({
        status: 502,
      });
      credentialResponse = { message: 'GitLab connection requires reauthorization.' };
      credentialStatus = 401;
      await expect(gitlab.versionControl.getRepositoryAccess(input)).rejects.toMatchObject({ status: 401 });
      expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('https://integrations.example.com/'))).toBe(
        true,
      );
    },
  );

  it('lists projects only from the explicitly configured Platform connection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/connections?providerKey=gitlab')) return json({ connections: platformConnections });
      if (url.includes('a1b_mastra/proxy')) return json([project(10, 'mastra/platform')]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const sources = await platform().intake.listSources({ orgId: 'org-1', userId: 'user-1' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://integrations.example.com/v2/connections?providerKey=gitlab',
    );

    expect(sources.map(source => source.name)).toEqual(['mastra/platform']);
    expect(decodeSourceId(sources[0]!.id)).toEqual({
      version: 2,
      host: 'gitlab.com',
      projectId: '10',
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/proxy/'))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('a1b_acme/proxy'))).toBe(false);
  });

  it('keeps issue references scoped to the configured connection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/connections?providerKey=gitlab')) return json({ connections: platformConnections });
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
      version: 2,
      host: 'gitlab.com',
      projectId: '10',
      issueIid: 42,
    });
  });

  it('resolves persisted issue references to an opaque Platform connection marker', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => json({ connections: platformConnections }));
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
      sourceId: encodeSourceId({ host: 'gitlab.com', projectId: '10' }),
      issueId: '42',
    });
    expect(JSON.stringify(resolved)).not.toContain('platform-token');
  });

  it('tries another account only when the first account cannot access a canonical project', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/connections?providerKey=gitlab')) return json({ connections: platformConnections });
      if (url.includes('a1b_acme/proxy/api/v4/projects/10')) return json({ message: 'Not found' }, 404);
      if (url.includes('a1b_mastra/proxy/api/v4/projects/10')) return json(project(10, 'mastra/platform'));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const gitlab = new PlatformGitLabIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
    });
    const reference = encodeIssueReference({ host: 'gitlab.com', projectId: '10', issueIid: 42 });

    await expect(
      gitlab.intake.resolveIntakeDispatch?.({
        orgId: 'org-1',
        externalSource: { type: 'issue', externalId: reference },
      }),
    ).resolves.toMatchObject({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:a1b_mastra' },
    });
  });

  it('preserves transient project lookup failures instead of masking them as another account miss', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/connections?providerKey=gitlab')) return json({ connections: platformConnections });
      if (url.includes('a1b_acme/proxy/api/v4/projects/10')) return json({ message: 'Temporarily unavailable' }, 503);
      if (url.includes('a1b_mastra/proxy/api/v4/projects/10')) return json(project(10, 'mastra/platform'));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const gitlab = new PlatformGitLabIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
    });
    const reference = encodeIssueReference({ host: 'gitlab.com', projectId: '10', issueIid: 42 });

    await expect(
      gitlab.intake.resolveIntakeDispatch?.({
        orgId: 'org-1',
        externalSource: { type: 'issue', externalId: reference },
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('a1b_mastra/proxy'))).toBe(false);
  });

  it('resolves an exact, non-blocked GitLab project member access level for webhook trust', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json([
        { id: 1, username: 'alice-other', access_level: 50 },
        { id: 2, username: 'Alice', state: 'active', access_level: 40 },
      ]),
    );
    const gitlab = direct(fetchMock);

    await expect(gitlab.getProjectMemberAccessLevel('direct', '10', 'alice')).resolves.toBe(40);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v4/projects/10/members/all'),
      expect.objectContaining({ headers: expect.objectContaining({ 'private-token': 'group-token' }) }),
    );
  });

  it('does not trust a blocked exact member', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json([{ id: 2, username: 'alice', state: 'blocked', access_level: 50 }]));
    await expect(direct(fetchMock).getProjectMemberAccessLevel('direct', '10', 'alice')).resolves.toBeUndefined();
  });
  it('resolves issue and merge-request authors through the same GitLab API client', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/issues?iids%5B%5D=42')) return json([issue()]);
      if (url.endsWith('/merge_requests/17')) return json({ author: { username: 'review-author' } });
      throw new Error(`Unexpected request: ${url}`);
    });
    const gitlab = direct(fetchMock);

    await expect(gitlab.getWorkItemAuthorUsername('direct', '10', 'issue', 42)).resolves.toBe('grace');
    await expect(gitlab.getWorkItemAuthorUsername('direct', '10', 'merge_request', 17)).resolves.toBe('review-author');
  });
  it('uses MASTRA_GITLAB_CONNECTION_ID as an optional filter and otherwise discovers every GitLab connection', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const providerKey = new URL(String(input)).searchParams.get('providerKey');
      return json({ connections: platformConnections.filter(connection => connection.integrationId === providerKey) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('MASTRA_GITLAB_CONNECTION_ID', 'a1b_mastra');
    const filtered = new PlatformGitLabIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
    });
    await expect(filtered.listConnections()).resolves.toMatchObject([{ id: 'a1b_mastra' }]);
    expect(filtered.diagnostics()).toMatchObject({ connectionFilterConfigured: true });

    vi.stubEnv('MASTRA_GITLAB_CONNECTION_ID', '');
    const discovered = new PlatformGitLabIntegration({
      clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' },
    });
    await expect(discovered.listConnections()).resolves.toMatchObject([{ id: 'a1b_acme' }, { id: 'a1b_mastra' }]);
    expect(discovered.diagnostics()).toMatchObject({ connectionFilterConfigured: false });
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('providerKey'))).toEqual([
      'gitlab',
      'gitlab-group',
      'gitlab-group-token',
      'gitlab',
      'gitlab-group',
      'gitlab-group-token',
    ]);
  });
});
