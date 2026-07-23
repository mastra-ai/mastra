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
} as unknown as GithubIntegration;

import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  refreshGithubToken,
  subscribeCurrentSessionToPullRequest,
  unsubscribeCurrentSessionFromPullRequest,
} from './session-subscriptions.js';
import { registerGithubPatKind, registerGithubTokenInjector } from './token-refresh.js';

function authenticatedRequestContext(scope = '/worktrees/a') {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  requestContext.set('controller', {
    resourceId: 'resource-1',
    threadId: 'thread-1',
    scope,
    session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
    getState: () => ({ factoryProjectId: 'resource-1', projectRepositoryId: 'project-repository-1' }),
  });
  return requestContext;
}

beforeEach(() => {
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
});

describe('GitHub subscription entry points', () => {
  it('does not expose tools without authenticated repository context', () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { getState: () => ({ projectRepositoryId: 'project-repository-1' }) });

    expect(createGithubSubscriptionTools(requestContext, githubStub)).toEqual({});
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
