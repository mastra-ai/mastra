import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubIntegration } from './integration.js';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(async (_input: { sessionScope: string }) => ({ created: true })),
  unsubscribe: vi.fn(async (_input: { sessionScope: string }) => ({ removed: true })),
  getPullRequest: vi.fn(async () => ({ data: { base: { repo: { id: 99 } } } })),
  getRepositoryAccess: vi.fn(async () => ({
    cloneUrl: 'https://github.com/mastra-ai/mastra.git',
    authorization: { scheme: 'bearer' as const, token: 'fresh-gh-token' },
  })),
  getSession: vi.fn(async (): Promise<{
    sessionId: string;
    orgId: string;
    userId: string;
    visibility: 'private' | 'org';
    projectRepositoryId: string;
  } | null> => ({
    sessionId: 'resource-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'private',
    projectRepositoryId: 'project-repository-1',
  })),
  upsertTriageComment: vi.fn(async (): Promise<{ action: 'created' | 'updated'; commentId: string; url: string }> => ({
    action: 'created',
    commentId: '42',
    url: 'https://github.com/mastra-ai/mastra/issues/7#issuecomment-42',
  })),
}));

vi.mock('./subscriptions', () => ({
  subscribeToPullRequest: mocks.subscribe,
  unsubscribeFromPullRequest: mocks.unsubscribe,
}));

// Stub integration: entry points consume the injected instance for PR verification and persistence.
const integrationStorage: { settings?: { get: (orgId: string, userId: string) => Promise<unknown> } } = {};
const githubStub = {
  integrationStorage,
  sourceControlStorage: {
    sessions: { getBySessionId: mocks.getSession },
    projectRepositories: {
      get: vi.fn(async () => ({
        id: 'project-repository-1',
        connectionId: 'connection-1',
        repositoryId: 'repository-1',
      })),
    },
    connections: {
      get: vi.fn(async () => ({
        id: 'connection-1',
        factoryProjectId: 'resource-1',
        installationId: 'installation-1',
      })),
    },
    repositories: {
      get: vi.fn(async () => ({
        id: 'repository-1',
        installationId: 'installation-1',
        externalId: '99',
        slug: 'mastra-ai/mastra',
      })),
    },
    installations: {
      get: vi.fn(async () => ({ id: 'installation-1', externalId: '7' })),
    },
  },
  versionControl: {
    getRepositoryAccess: mocks.getRepositoryAccess,
  },
  getInstallationOctokit: () => ({ pulls: { get: mocks.getPullRequest } }),
  upsertFactoryTriageComment: mocks.upsertTriageComment,
} as unknown as GithubIntegration;

import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  refreshGithubToken,
  subscribeCurrentSessionToPullRequest,
  unsubscribeCurrentSessionFromPullRequest,
  upsertFactoryTriageComment,
} from './session-subscriptions.js';
import { registerGithubPatKind, registerGithubTokenInjector } from './token-refresh.js';

function authenticatedRequestContext(
  scope = '/worktrees/a',
  state: { factoryProjectId?: string; projectRepositoryId?: string } = {
    factoryProjectId: 'resource-1',
    projectRepositoryId: 'project-repository-1',
  },
  threadId: string | undefined = 'thread-1',
) {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  requestContext.set('controller', {
    resourceId: 'resource-1',
    threadId,
    scope,
    session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
    getState: () => state,
  });
  return requestContext;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete integrationStorage.settings;
});

describe('parseCreatedPullRequest', () => {
  it.each([
    {
      command: 'gh pr create --draft --title "Fix"',
      output: { stdout: 'https://github.com/mastra-ai/mastra/pull/123\n' },
    },
    {
      command:
        'gh pr create --head factory/issue-6 --base main --draft --title "Fix" --body-file /tmp/pr-body.md\nstatus=$?\nrm /tmp/pr-body.md\nexit $status',
      output: { result: 'https://github.com/mastra-ai/mastra/pull/123\n' },
    },
    {
      command:
        "gh pr close 122 && cat <<'EOF' > /tmp/pr-body.md\nFixes the issue.\nEOF\ngh pr create --draft --body-file /tmp/pr-body.md",
      output: { result: 'Closed pull request #122\nhttps://github.com/mastra-ai/mastra/pull/123\n' },
    },
  ])('extracts one canonical PR URL from successful execute_command output', ({ command, output }) => {
    expect(
      parseCreatedPullRequest({
        toolName: 'execute_command',
        input: { command },
        output,
      }),
    ).toBe('https://github.com/mastra-ai/mastra/pull/123');
  });

  it.each([
    { toolName: 'other', input: { command: 'gh pr create' }, output: 'https://github.com/o/r/pull/1' },
    { toolName: 'execute_command', input: { command: 'echo "gh pr create"' }, output: 'https://github.com/o/r/pull/1' },
    { toolName: 'execute_command', input: { command: 'create-pr' }, output: 'https://github.com/o/r/pull/1' },
    {
      toolName: 'execute_command',
      input: { command: "cat <<'EOF'\ngh pr create\nEOF" },
      output: 'https://github.com/o/r/pull/1',
    },
    { toolName: 'execute_command', input: { command: 'gh pr create' }, output: 'no url', error: new Error('failed') },
    {
      toolName: 'execute_command',
      input: { command: 'gh pr create' },
      output: 'https://github.com/o/r/pull/1 https://github.com/o/r/pull/2',
    },
  ])('rejects unsafe, failed, or ambiguous output', context => {
    expect(parseCreatedPullRequest(context)).toBeUndefined();
  });

  it('reads the pull request URL from a successful shared change-request tool result', () => {
    expect(
      parseCreatedPullRequest({
        toolName: 'source_control_create_change_request',
        input: { title: 'Fix' },
        output: { id: '123', url: 'https://github.com/mastra-ai/mastra/pull/123/' },
      }),
    ).toBe('https://github.com/mastra-ai/mastra/pull/123');
  });

  it.each([
    { output: { url: 'https://gitlab.com/acme/app/-/merge_requests/9' } },
    { output: { url: 'https://github.com/mastra-ai/mastra/issues/123' } },
    { output: 'https://github.com/mastra-ai/mastra/pull/123' },
    { output: { url: 'https://github.com/mastra-ai/mastra/pull/123' }, error: new Error('failed') },
  ])('ignores shared change-request results that are not a GitHub pull request: %o', context => {
    expect(
      parseCreatedPullRequest({ toolName: 'source_control_create_change_request', input: {}, ...context }),
    ).toBeUndefined();
  });
});

describe('GitHub subscription entry points', () => {
  it.each([
    { user: undefined, resourceId: 'resource-1' },
    { user: { workosId: 'user-1' }, resourceId: 'resource-1' },
    { user: { organizationId: 'org-1' }, resourceId: 'resource-1' },
  ])('does not expose tools without authenticated identity: %o', ({ user, resourceId }) => {
    const requestContext = new RequestContext();
    if (user) requestContext.set('user', user);
    requestContext.set('controller', {
      resourceId,
      getState: () => ({ projectRepositoryId: 'project-repository-1' }),
    });
    expect(createGithubSubscriptionTools(requestContext, githubStub)).toEqual({});
  });

  it('keeps the existing repository-tool gate when the controller has no resource ID', () => {
    const requestContext = authenticatedRequestContext();
    requestContext.set('controller', {
      threadId: 'thread-1',
      getState: () => ({ projectRepositoryId: 'project-repository-1' }),
    });
    expect(Object.keys(createGithubSubscriptionTools(requestContext, githubStub))).toEqual([
      'github_upsert_factory_triage_comment',
      'github_subscribe_pr',
      'github_unsubscribe_pr',
    ]);
  });

  it('exposes only refresh without an active thread', () => {
    const requestContext = authenticatedRequestContext('/worktrees/a', {}, undefined);
    expect(Object.keys(createGithubSubscriptionTools(requestContext, githubStub))).toEqual(['github_refresh_token']);
  });

  it.each([{ factoryProjectId: 'resource-1' }, {}])(
    'refreshes a persisted GitHub session with controller state %o',
    async state => {
      const requestContext = authenticatedRequestContext('/worktrees/a', state);
      const inject = vi.fn();
      registerGithubTokenInjector(requestContext, inject);
      const tools = createGithubSubscriptionTools(requestContext, githubStub);
      expect(Object.keys(tools)).toEqual(['github_refresh_token']);
      await expect(tools.github_refresh_token!.execute!({}, {} as never)).resolves.toEqual({ refreshed: true });
      expect(mocks.getSession).toHaveBeenCalledWith('resource-1');
      expect(inject).toHaveBeenCalledWith('fresh-gh-token');
    },
  );

  it('exposes refresh before sandbox start but refuses to read credentials without its injector', async () => {
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    const tool = createGithubSubscriptionTools(requestContext, githubStub).github_refresh_token!;
    await expect(tool.execute!({}, {} as never)).rejects.toThrow('active Factory sandbox workspace');
    expect(integrationStorage.settings.get).not.toHaveBeenCalled();
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('rejects direct refresh without identity or a controller resource', async () => {
    const requestContext = new RequestContext();
    await expect(refreshGithubToken(requestContext, githubStub)).rejects.toThrow('authenticated Factory session');
    expect(mocks.getSession).not.toHaveBeenCalled();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    await expect(refreshGithubToken(requestContext, githubStub)).rejects.toThrow('authenticated Factory session');
  });

  it('rejects chat-only and GitLab-only sessions without looking up a PAT', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    registerGithubTokenInjector(requestContext, vi.fn());
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    await expect(
      createGithubSubscriptionTools(requestContext, githubStub).github_refresh_token!.execute!({}, {} as never),
    ).rejects.toThrow('not backed by a GitHub workspace');
    expect(integrationStorage.settings.get).not.toHaveBeenCalled();
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it.each([
    { orgId: 'org-2', userId: 'user-1', visibility: 'org' as const },
    { orgId: 'org-1', userId: 'user-2', visibility: 'private' as const },
  ])('rejects unauthorized persisted session %o before reading credentials', async session => {
    mocks.getSession.mockResolvedValueOnce({
      sessionId: 'resource-1',
      projectRepositoryId: 'project-repository-1',
      ...session,
    });
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    registerGithubTokenInjector(requestContext, vi.fn());
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    await expect(refreshGithubToken(requestContext, githubStub)).rejects.toThrow('not available');
    expect(integrationStorage.settings.get).not.toHaveBeenCalled();
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('permits a same-org member on an org-visible GitHub session', async () => {
    mocks.getSession.mockResolvedValueOnce({
      sessionId: 'resource-1',
      projectRepositoryId: 'project-repository-1',
      orgId: 'org-1',
      userId: 'user-2',
      visibility: 'org',
    });
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();
    expect(inject).toHaveBeenCalledWith('fresh-gh-token');
  });

  it.each([
    { state: { projectRepositoryId: 'other-repository' }, message: 'controller repository' },
    { state: { factoryProjectId: 'other-project' }, message: 'Factory project' },
  ])('rejects conflicting controller state $state', async ({ state, message }) => {
    const requestContext = authenticatedRequestContext('/worktrees/a', state);
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    await expect(refreshGithubToken(requestContext, githubStub)).rejects.toThrow(message);
    expect(inject).not.toHaveBeenCalled();
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it.each([
    { record: 'projectRepositories' as const, message: 'project repository' },
    { record: 'connections' as const, message: 'connection' },
    { record: 'repositories' as const, message: 'repository' },
  ])('rejects missing GitHub $record before injection', async ({ record, message }) => {
    vi.spyOn(githubStub.sourceControlStorage[record], 'get').mockResolvedValueOnce(null);
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    await expect(refreshGithubToken(requestContext, githubStub)).rejects.toThrow(message);
    expect(inject).not.toHaveBeenCalled();
  });

  it('mints repository access and injects the fresh token into the active sandbox', async () => {
    const requestContext = authenticatedRequestContext();
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);

    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();

    expect(mocks.getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repository-1' });
    expect(inject).toHaveBeenCalledWith('fresh-gh-token');
  });

  it('re-injects a configured org PAT instead of minting an installation token', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_org_pat' })) };
    const requestContext = authenticatedRequestContext();
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);

    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();

    expect(inject).toHaveBeenCalledWith('ghp_org_pat');
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('re-injects the reviewer PAT when the sandbox was provisioned as a reviewer', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker', reviewerPat: 'ghp_reviewer' })) };
    const requestContext = authenticatedRequestContext();
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    registerGithubPatKind(requestContext, 'reviewer');

    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();

    expect(inject).toHaveBeenCalledWith('ghp_reviewer');
  });

  it('falls back from an absent reviewer PAT to the worker PAT', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    registerGithubPatKind(requestContext, 'reviewer');
    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();
    expect(inject).toHaveBeenCalledWith('ghp_worker');
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('refuses missing repository bearer tokens without claiming success', async () => {
    mocks.getRepositoryAccess.mockResolvedValueOnce({ cloneUrl: 'https://github.com/mastra-ai/mastra.git', authorization: { scheme: 'bearer', token: '' } });
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    const tool = createGithubSubscriptionTools(requestContext, githubStub).github_refresh_token!;
    await expect(tool.execute!({}, {} as never)).rejects.toThrow('did not include a bearer token');
    expect(inject).not.toHaveBeenCalled();
  });

  it('propagates injector failures without returning token material', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_secret' })) };
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    registerGithubTokenInjector(requestContext, () => { throw new Error('sandbox retired'); });
    const tool = createGithubSubscriptionTools(requestContext, githubStub).github_refresh_token!;
    await expect(tool.execute!({}, {} as never)).rejects.toThrow('sandbox retired');
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('silently skips auto-subscription outside repository sessions', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      resourceId: 'resource-1',
      threadId: 'thread-1',
      scope: '/worktrees/a',
      session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
      getState: () => ({}),
    });

    await expect(
      subscribeCurrentSessionToPullRequest(requestContext, 123, 'auto-gh-pr-create', githubStub),
    ).resolves.toBeUndefined();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('still rejects the explicit tool path outside repository sessions', async () => {
    await expect(
      subscribeCurrentSessionToPullRequest(new RequestContext(), 123, 'explicit-tool', githubStub),
    ).rejects.toThrow('GitHub subscriptions require an authenticated repository session with an active thread.');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes the exact scoped session after verifying the active-project PR', async () => {
    const requestContext = authenticatedRequestContext('/worktrees/a');

    await subscribeCurrentSessionToPullRequest(requestContext, 123, 'auto-gh-pr-create', githubStub);
    await subscribeCurrentSessionToPullRequest(requestContext, 123, 'auto-gh-pr-create', githubStub);

    expect(mocks.getPullRequest).toHaveBeenCalledWith({ owner: 'mastra-ai', repo: 'mastra', pull_number: 123 });
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    expect(mocks.subscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changeRequestId: '123',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionScope: '/worktrees/a',
        source: 'auto-gh-pr-create',
      }),
      integrationStorage,
    );
  });

  it('rejects a canonical URL for another repository before subscription', async () => {
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/other/repo/pull/123',
        'explicit-tool',
        githubStub,
      ),
    ).rejects.toThrow('Pull request must belong to mastra-ai/mastra.');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('keeps parallel worktree scopes isolated', async () => {
    await subscribeCurrentSessionToPullRequest(
      authenticatedRequestContext('/worktrees/a'),
      123,
      'explicit-tool',
      githubStub,
    );
    await subscribeCurrentSessionToPullRequest(
      authenticatedRequestContext('/worktrees/b'),
      123,
      'explicit-tool',
      githubStub,
    );

    expect(mocks.subscribe.mock.calls.map(([input]) => input.sessionScope)).toEqual(['/worktrees/a', '/worktrees/b']);
  });

  it('upserts the Factory triage handoff through the active installation and repository', async () => {
    await expect(
      upsertFactoryTriageComment(
        authenticatedRequestContext(),
        { issueNumber: 7, body: '<!-- mastra-factory-triage -->\nPending' },
        githubStub,
      ),
    ).resolves.toMatchObject({ action: 'created', commentId: '42' });

    expect(mocks.upsertTriageComment).toHaveBeenCalledWith({
      installationId: 7,
      repository: 'mastra-ai/mastra',
      issueNumber: 7,
      body: '<!-- mastra-factory-triage -->\nPending',
    });
  });

  it('exposes the triage upsert only in authenticated repository sessions and rejects unmarked bodies', () => {
    const tool = (createGithubSubscriptionTools(authenticatedRequestContext(), githubStub) as any)
      .github_upsert_factory_triage_comment;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.safeParse({ issueNumber: 7, body: 'not marked' }).success).toBe(false);
    expect(
      tool.inputSchema.safeParse({ issueNumber: 7, body: '<!-- mastra-factory-triage -->\nPending' }).success,
    ).toBe(true);
  });

  it('serializes concurrent publications so the second call observes the first result', async () => {
    let published = false;
    mocks.upsertTriageComment.mockImplementation(async () => {
      if (published)
        return {
          action: 'updated' as const,
          commentId: '42',
          url: 'https://github.com/mastra-ai/mastra/issues/7#issuecomment-42',
        };
      await new Promise(resolve => setTimeout(resolve, 5));
      published = true;
      return {
        action: 'created' as const,
        commentId: '42',
        url: 'https://github.com/mastra-ai/mastra/issues/7#issuecomment-42',
      };
    });

    await expect(
      Promise.all([
        upsertFactoryTriageComment(
          authenticatedRequestContext(),
          { issueNumber: 7, body: '<!-- mastra-factory-triage -->\nPending' },
          githubStub,
        ),
        upsertFactoryTriageComment(
          authenticatedRequestContext(),
          { issueNumber: 7, body: '<!-- mastra-factory-triage -->\nFinal' },
          githubStub,
        ),
      ]),
    ).resolves.toMatchObject([{ action: 'created' }, { action: 'updated' }]);
    expect(mocks.upsertTriageComment).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes only the current scoped thread target', async () => {
    const number = await unsubscribeCurrentSessionFromPullRequest(
      authenticatedRequestContext('/worktrees/a'),
      'https://github.com/mastra-ai/mastra/pull/123',
      githubStub,
    );

    expect(number).toBe(123);
    expect(mocks.unsubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: '123',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionScope: '/worktrees/a',
      }),
      integrationStorage,
    );
  });
});
