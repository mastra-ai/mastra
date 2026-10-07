import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubIntegration } from './integration.js';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(async (_input: { sessionScope: string }) => ({ created: true })),
  unsubscribe: vi.fn(async (_input: { sessionScope: string }) => ({ removed: true })),
  getPullRequest: vi.fn(async ({ repo }: { owner: string; repo: string; pull_number: number }) => ({
    data: { base: { repo: { id: repo === 'docs' ? 98 : 99 } }, head: { ref: 'feat/from-pr' } },
  })),
  upsertSessionRepository: vi.fn(async () => undefined),
  getRepositoryAccess: vi.fn(async () => ({
    cloneUrl: 'https://github.com/mastra-ai/mastra.git',
    authorization: { scheme: 'bearer' as const, token: 'fresh-gh-token' },
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
const createdAt = new Date('2026-10-07T00:00:00Z');
/** The factory environment: `mastra-ai/mastra` (the session's own link, position 1) and `mastra-ai/docs`. */
const links = [
  {
    id: 'project-repository-1',
    connectionId: 'connection-1',
    repositoryId: 'repository-1',
    position: 1,
    inEnvironment: true,
    createdAt,
  },
  {
    id: 'project-repository-2',
    connectionId: 'connection-1',
    repositoryId: 'repository-2',
    position: 2,
    inEnvironment: true,
    createdAt,
  },
];
const repositories = [
  { id: 'repository-1', installationId: 'installation-1', externalId: '99', slug: 'mastra-ai/mastra' },
  { id: 'repository-2', installationId: 'installation-1', externalId: '98', slug: 'mastra-ai/docs' },
];
const connection = {
  id: 'connection-1',
  factoryProjectId: 'resource-1',
  installationId: 'installation-1',
  integrationId: 'github',
};
const sessionRow = {
  id: 'row-1',
  sessionId: 'resource-1',
  orgId: 'org-1',
  factoryProjectId: 'resource-1',
  projectRepositoryId: 'project-repository-1',
  branch: 'factory/issue-1',
};
const storageState: { links: typeof links; session: typeof sessionRow | null } = { links, session: sessionRow };
const githubStub = {
  integrationStorage,
  sourceControlStorage: {
    integrationId: 'github',
    sessions: { getBySessionId: vi.fn(async () => storageState.session) },
    sessionRepositories: { upsert: mocks.upsertSessionRepository },
    projectRepositories: {
      get: vi.fn(async ({ id }: { id: string }) => storageState.links.find(link => link.id === id) ?? null),
      listByProject: vi.fn(async () => storageState.links),
    },
    connections: {
      get: vi.fn(async () => connection),
      list: vi.fn(async () => [connection]),
    },
    repositories: {
      get: vi.fn(async ({ id }: { id: string }) => repositories.find(repository => repository.id === id) ?? null),
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
import { registerGithubPatKind, registerGithubRefreshTarget, registerGithubTokenInjector } from './token-refresh.js';

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

/** A request the workspace resolver authorized for a GitHub-backed session. */
function refreshableRequestContext(
  inject: ((token: string) => void) | null = vi.fn(),
  state?: { factoryProjectId?: string; projectRepositoryId?: string },
) {
  const requestContext = authenticatedRequestContext('/worktrees/a', state);
  registerGithubRefreshTarget(requestContext, { orgId: 'org-1', repositoryId: 'repository-1' });
  if (inject) registerGithubTokenInjector(requestContext, inject);
  return requestContext;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete integrationStorage.settings;
  storageState.links = links;
  storageState.session = sessionRow;
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

  it('exposes only repository tools without a registered GitHub refresh target', () => {
    expect(Object.keys(createGithubSubscriptionTools(authenticatedRequestContext(), githubStub))).toEqual([
      'github_upsert_factory_triage_comment',
      'github_subscribe_pr',
      'github_unsubscribe_pr',
    ]);
  });

  it('does not expose refresh to chat-only or non-GitHub sessions', () => {
    const requestContext = authenticatedRequestContext('/worktrees/a', {});
    registerGithubTokenInjector(requestContext, vi.fn());
    expect(createGithubSubscriptionTools(requestContext, githubStub)).toEqual({});
  });

  it('exposes refresh for a GitHub-backed session without repository controller state', async () => {
    const inject = vi.fn();
    const requestContext = refreshableRequestContext(inject, {});
    const tools = createGithubSubscriptionTools(requestContext, githubStub);
    expect(Object.keys(tools)).toEqual(['github_refresh_token']);
    await expect(tools.github_refresh_token!.execute!({}, {} as never)).resolves.toEqual({ refreshed: true });
    expect(inject).toHaveBeenCalledWith('fresh-gh-token');
  });

  it('exposes refresh before sandbox start but refuses to read credentials without its injector', async () => {
    const requestContext = refreshableRequestContext(null);
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    const tool = createGithubSubscriptionTools(requestContext, githubStub).github_refresh_token!;
    await expect(tool.execute!({}, {} as never)).rejects.toThrow('active Factory sandbox workspace');
    expect(integrationStorage.settings.get).not.toHaveBeenCalled();
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('rejects direct refresh without a registered GitHub target before reading credentials', async () => {
    const requestContext = authenticatedRequestContext();
    const inject = vi.fn();
    registerGithubTokenInjector(requestContext, inject);
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    await expect(refreshGithubToken(requestContext, githubStub)).rejects.toThrow('not backed by a GitHub workspace');
    expect(integrationStorage.settings.get).not.toHaveBeenCalled();
    expect(inject).not.toHaveBeenCalled();
  });

  it('mints repository access and injects the fresh token into the active sandbox', async () => {
    const inject = vi.fn();
    await expect(refreshGithubToken(refreshableRequestContext(inject), githubStub)).resolves.toBeUndefined();

    expect(mocks.getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repository-1' });
    expect(inject).toHaveBeenCalledWith('fresh-gh-token');
  });

  it('re-injects a configured org PAT instead of minting an installation token', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_org_pat' })) };
    const inject = vi.fn();
    await expect(refreshGithubToken(refreshableRequestContext(inject), githubStub)).resolves.toBeUndefined();

    expect(inject).toHaveBeenCalledWith('ghp_org_pat');
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('re-injects the reviewer PAT when the sandbox was provisioned as a reviewer', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker', reviewerPat: 'ghp_reviewer' })) };
    const inject = vi.fn();
    const requestContext = refreshableRequestContext(inject);
    registerGithubPatKind(requestContext, 'reviewer');

    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();

    expect(inject).toHaveBeenCalledWith('ghp_reviewer');
  });

  it('falls back from an absent reviewer PAT to the worker PAT', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_worker' })) };
    const inject = vi.fn();
    const requestContext = refreshableRequestContext(inject);
    registerGithubPatKind(requestContext, 'reviewer');

    await expect(refreshGithubToken(requestContext, githubStub)).resolves.toBeUndefined();

    expect(inject).toHaveBeenCalledWith('ghp_worker');
    expect(mocks.getRepositoryAccess).not.toHaveBeenCalled();
  });

  it('refuses missing repository bearer tokens without claiming success', async () => {
    mocks.getRepositoryAccess.mockResolvedValueOnce({
      cloneUrl: 'https://github.com/mastra-ai/mastra.git',
      authorization: { scheme: 'bearer', token: '' },
    });
    const inject = vi.fn();
    const tool = createGithubSubscriptionTools(refreshableRequestContext(inject), githubStub).github_refresh_token!;
    await expect(tool.execute!({}, {} as never)).rejects.toThrow('did not include a bearer token');
    expect(inject).not.toHaveBeenCalled();
  });

  it('propagates injector failures without returning token material', async () => {
    integrationStorage.settings = { get: vi.fn(async () => ({ pat: 'ghp_secret' })) };
    const requestContext = refreshableRequestContext(() => {
      throw new Error('sandbox retired');
    });
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

  it('rejects a canonical URL outside the environment before subscription, and skips it on the auto path', async () => {
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/other/repo/pull/123',
        'explicit-tool',
        githubStub,
      ),
    ).rejects.toThrow('Pull request https://github.com/other/repo/pull/123 is not in a repository linked to this Factory.');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/other/repo/pull/123',
        'auto-gh-pr-create',
        githubStub,
      ),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not in this Factory'), {
      url: 'https://github.com/other/repo/pull/123',
    });
    expect(mocks.getPullRequest).not.toHaveBeenCalled();
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.upsertSessionRepository).not.toHaveBeenCalled();
  });

  it('exposes the subscription tools to a session that only carries factoryProjectId', () => {
    const tools = createGithubSubscriptionTools(
      authenticatedRequestContext('/worktrees/a', { factoryProjectId: 'resource-1' }),
      githubStub,
    );
    expect(Object.keys(tools)).toEqual([
      'github_upsert_factory_triage_comment',
      'github_subscribe_pr',
      'github_unsubscribe_pr',
    ]);
    expect(tools.github_subscribe_pr!.description).toContain('pass the URL when the Factory has more than one');
  });

  it('auto-subscribes a gh pr create URL in another environment repository and records the row', async () => {
    const requestContext = authenticatedRequestContext('/worktrees/a', { factoryProjectId: 'resource-1' });
    await expect(
      subscribeCurrentSessionToPullRequest(
        requestContext,
        'https://github.com/mastra-ai/docs/pull/7',
        'auto-gh-pr-create',
        githubStub,
      ),
    ).resolves.toBe(7);

    expect(mocks.getPullRequest).toHaveBeenCalledWith({ owner: 'mastra-ai', repo: 'docs', pull_number: 7 });
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRepositoryId: 'project-repository-2',
        repositoryExternalId: '98',
        repositorySlug: 'mastra-ai/docs',
        changeRequestId: '7',
        resourceId: 'resource-1',
        source: 'auto-gh-pr-create',
      }),
      integrationStorage,
    );
    // No `branch`: an existing row keeps what the session's push wrote; a
    // first row takes the pull request's head ref.
    expect(mocks.upsertSessionRepository).toHaveBeenCalledWith({
      sessionId: 'resource-1',
      projectRepositoryId: 'project-repository-2',
      changeRequestId: '7',
      changeRequestUrl: 'https://github.com/mastra-ai/docs/pull/7',
      fallbackBranch: 'feat/from-pr',
    });
  });

  it('resolves a bare number against the session own link, and demands a URL without one', async () => {
    await expect(
      subscribeCurrentSessionToPullRequest(authenticatedRequestContext(), '123', 'explicit-tool', githubStub),
    ).resolves.toBe(123);
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ projectRepositoryId: 'project-repository-1', repositorySlug: 'mastra-ai/mastra' }),
      integrationStorage,
    );

    storageState.session = null;
    await expect(
      subscribeCurrentSessionToPullRequest(authenticatedRequestContext(), 123, 'explicit-tool', githubStub),
    ).rejects.toThrow('Pass the full pull request URL: this session is not filed under a single repository.');
    // A URL still works for a session without a row, and writes no row.
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/mastra-ai/docs/pull/7',
        'explicit-tool',
        githubStub,
      ),
    ).resolves.toBe(7);
    expect(mocks.upsertSessionRepository).toHaveBeenCalledTimes(1);
  });

  it('accepts a pull request in the session own link after it left the environment', async () => {
    storageState.links = [{ ...links[0]!, inEnvironment: false }, links[1]!];
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/mastra-ai/mastra/pull/123',
        'explicit-tool',
        githubStub,
      ),
    ).resolves.toBe(123);
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ projectRepositoryId: 'project-repository-1', repositorySlug: 'mastra-ai/mastra' }),
      integrationStorage,
    );
  });

  it('rejects a pull request whose base repository is not the one its URL names', async () => {
    mocks.getPullRequest.mockResolvedValueOnce({
      data: { base: { repo: { id: 12345 } }, head: { ref: 'x' } },
    });
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/mastra-ai/docs/pull/7',
        'explicit-tool',
        githubStub,
      ),
    ).rejects.toThrow('Pull request repository does not match the active project repository.');
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.upsertSessionRepository).not.toHaveBeenCalled();
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
