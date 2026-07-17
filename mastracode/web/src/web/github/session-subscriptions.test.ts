import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(async (_input: { sessionScope: string }) => ({ created: true })),
  unsubscribe: vi.fn(async (_input: { sessionScope: string }) => ({ removed: true })),
  getPullRequest: vi.fn(async () => ({ data: { base: { repo: { id: 99 } } } })),
}));

vi.mock('./subscriptions', () => ({
  subscribeToPullRequest: mocks.subscribe,
  unsubscribeFromPullRequest: mocks.unsubscribe,
}));

vi.mock('./client', () => ({
  getInstallationOctokit: () => ({ pulls: { get: mocks.getPullRequest } }),
}));

vi.mock('./db', () => ({
  getAppDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [
          {
            id: 'project-1',
            orgId: 'org-1',
            installationId: 7,
            repoId: 99,
            repoFullName: 'mastra-ai/mastra',
          },
        ],
      }),
    }),
  }),
}));

import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
  unsubscribeCurrentSessionFromPullRequest,
} from './session-subscriptions';

function authenticatedRequestContext(scope = '/worktrees/a') {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  requestContext.set('controller', {
    resourceId: 'resource-1',
    threadId: 'thread-1',
    scope,
    session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
    getState: () => ({ githubProjectId: 'project-1' }),
  });
  return requestContext;
}

beforeEach(() => {
  vi.clearAllMocks();
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
  it('does not expose tools without authenticated GitHub-project context', () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { getState: () => ({ githubProjectId: 'project-1' }) });

    expect(createGithubSubscriptionTools(requestContext)).toEqual({});
  });

  it('silently skips auto-subscription outside GitHub-project sessions', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      resourceId: 'resource-1',
      threadId: 'thread-1',
      scope: '/worktrees/a',
      session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
      getState: () => ({}),
    });

    await expect(
      subscribeCurrentSessionToPullRequest(requestContext, 123, 'auto-gh-pr-create'),
    ).resolves.toBeUndefined();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('still rejects the explicit tool path outside GitHub-project sessions', async () => {
    await expect(subscribeCurrentSessionToPullRequest(new RequestContext(), 123, 'explicit-tool')).rejects.toThrow(
      'GitHub subscriptions require an authenticated GitHub-project session with an active thread.',
    );
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes the exact scoped session after verifying the active-project PR', async () => {
    const requestContext = authenticatedRequestContext('/worktrees/a');

    await subscribeCurrentSessionToPullRequest(requestContext, 123, 'auto-gh-pr-create');
    await subscribeCurrentSessionToPullRequest(requestContext, 123, 'auto-gh-pr-create');

    expect(mocks.getPullRequest).toHaveBeenCalledWith({ owner: 'mastra-ai', repo: 'mastra', pull_number: 123 });
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    expect(mocks.subscribe).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pullRequestNumber: 123,
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionScope: '/worktrees/a',
        source: 'auto-gh-pr-create',
      }),
    );
  });

  it('rejects a canonical URL for another repository before subscription', async () => {
    await expect(
      subscribeCurrentSessionToPullRequest(
        authenticatedRequestContext(),
        'https://github.com/other/repo/pull/123',
        'explicit-tool',
      ),
    ).rejects.toThrow('Pull request must belong to mastra-ai/mastra.');
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('keeps parallel worktree scopes isolated', async () => {
    await subscribeCurrentSessionToPullRequest(authenticatedRequestContext('/worktrees/a'), 123, 'explicit-tool');
    await subscribeCurrentSessionToPullRequest(authenticatedRequestContext('/worktrees/b'), 123, 'explicit-tool');

    expect(mocks.subscribe.mock.calls.map(([input]) => input.sessionScope)).toEqual(['/worktrees/a', '/worktrees/b']);
  });

  it('unsubscribes only the current scoped thread target', async () => {
    const number = await unsubscribeCurrentSessionFromPullRequest(
      authenticatedRequestContext('/worktrees/a'),
      'https://github.com/mastra-ai/mastra/pull/123',
    );

    expect(number).toBe(123);
    expect(mocks.unsubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequestNumber: 123,
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionScope: '/worktrees/a',
      }),
    );
  });
});
