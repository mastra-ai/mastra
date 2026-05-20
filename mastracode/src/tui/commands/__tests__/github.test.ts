import { beforeEach, describe, expect, it, vi } from 'vitest';

const { defaultGithubCommandRunnerMock } = vi.hoisted(() => ({
  defaultGithubCommandRunnerMock: vi.fn(),
}));

vi.mock('../../../github-signals/index.js', () => ({
  defaultGithubCommandRunner: defaultGithubCommandRunnerMock,
  ghSignals: {
    prSubscribe: (input: { prNumber: number; repo?: string; summary?: string }) => ({
      type: 'system-reminder',
      contents: [`You are now subscribed to Github PR #${input.prNumber}.`, input.summary].filter(Boolean).join('\n\n'),
      attributes: { type: 'github-pr-subscribe', prNumber: input.prNumber, repo: input.repo },
      metadata: input,
    }),
  },
}));

import { handleGithubCommand } from '../github.js';
import type { SlashCommandContext } from '../types.js';

function createCtx(
  options: {
    threadId?: string | null;
    githubSignals?: any;
  } = {},
) {
  const infoMessages: string[] = [];
  const errorMessages: string[] = [];
  const memory = { getThreadById: vi.fn(), updateThread: vi.fn() };
  const harness = {
    getCurrentThreadId: vi.fn(() => (Object.hasOwn(options, 'threadId') ? options.threadId : 'thread-1')),
    getResourceId: vi.fn(() => 'resource-1'),
    getMastra: vi.fn(() => ({ getStorage: () => ({ getStore: vi.fn(async () => memory) }) })),
    sendSignal: vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) })),
  };
  const githubSignals = options.githubSignals ?? {
    subscribeThread: vi.fn(),
    unsubscribeThread: vi.fn(),
    init: vi.fn(),
    syncThread: vi.fn(),
  };
  const ctx = {
    state: { activeGithubPrSubscriptions: [], githubSyncingPrSubscriptions: [] },
    harness,
    githubSignals,
    showInfo: vi.fn((message: string) => infoMessages.push(message)),
    showError: vi.fn((message: string) => errorMessages.push(message)),
    updateStatusLine: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, infoMessages, errorMessages, memory, githubSignals };
}

describe('handleGithubCommand', () => {
  beforeEach(() => {
    defaultGithubCommandRunnerMock.mockReset();
    defaultGithubCommandRunnerMock.mockResolvedValue({ stdout: '' });
  });

  it('shows usage for invalid args', async () => {
    const { ctx, infoMessages } = createCtx();

    await handleGithubCommand(ctx, []);

    expect(infoMessages[0]).toContain('/github subscribe [prNumber] [repo]');
  });

  it('requires GitHub signals to be available', async () => {
    const { ctx, errorMessages } = createCtx({ githubSignals: undefined });
    ctx.githubSignals = undefined;

    await handleGithubCommand(ctx, ['subscribe', '123', 'mastra-ai/mastra']);

    expect(errorMessages[0]).toContain('Enable Experimental GitHub PR notifications in /settings');
  });

  it('requires a current thread', async () => {
    const { ctx, errorMessages } = createCtx({ threadId: null });

    await handleGithubCommand(ctx, ['subscribe', '123', 'mastra-ai/mastra']);

    expect(errorMessages[0]).toContain('No current thread');
  });

  it('subscribes the current thread and updates the PR badge', async () => {
    const subscribeThread = vi.fn(async () => ({ repo: 'mastra-ai/mastra', prNumber: 123 }));
    const { ctx, memory, infoMessages } = createCtx({ githubSignals: { subscribeThread } });

    await handleGithubCommand(ctx, ['subscribe', '123', 'mastra-ai/mastra']);

    expect(subscribeThread).toHaveBeenCalledWith({
      memory,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(ctx.state.activeGithubPrSubscriptions).toEqual([{ repo: 'mastra-ai/mastra', prNumber: 123 }]);
    expect(ctx.updateStatusLine).toHaveBeenCalled();
    expect(ctx.harness.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system-reminder',
        metadata: { repo: 'mastra-ai/mastra', prNumber: 123 },
      }),
    );
    expect(infoMessages[0]).toContain('Subscribed to GitHub PR #123');
  });

  it('includes latest review and CI status in the subscribe signal when available', async () => {
    defaultGithubCommandRunnerMock.mockResolvedValueOnce({ stdout: '' }).mockResolvedValueOnce({
      stdout: JSON.stringify({
        title: 'Fix task contrast',
        state: 'OPEN',
        reviewDecision: 'APPROVED',
        latestReviews: [
          {
            state: 'APPROVED',
            submittedAt: '2026-05-20T17:25:20Z',
            author: { login: 'TylerBarnes' },
          },
        ],
        statusCheckRollup: [
          { name: 'lint', conclusion: 'SUCCESS' },
          { name: 'e2e', conclusion: 'FAILURE' },
        ],
      }),
    });
    const subscribeThread = vi.fn(async () => ({ repo: 'mastra-ai/mastra', prNumber: 123 }));
    const { ctx } = createCtx({ githubSignals: { subscribeThread } });

    await handleGithubCommand(ctx, ['subscribe', '123', 'mastra-ai/mastra']);

    expect(defaultGithubCommandRunnerMock).toHaveBeenNthCalledWith(2, [
      'pr',
      'view',
      '123',
      '--json',
      'title,state,mergedAt,reviewDecision,latestReviews,statusCheckRollup,url',
      '--repo',
      'mastra-ai/mastra',
    ]);
    expect(ctx.harness.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.stringContaining('Latest review: APPROVED by TylerBarnes'),
        metadata: expect.objectContaining({ summary: expect.stringContaining('CI: 1 passed, 0 pending, 1 failed') }),
      }),
    );
  });

  it('discovers the current branch PR when subscribing without a PR number', async () => {
    defaultGithubCommandRunnerMock.mockResolvedValueOnce({ stdout: '' }).mockResolvedValueOnce({
      stdout: JSON.stringify({ number: 456, url: 'https://github.com/mastra-ai/mastra/pull/456' }),
    });
    const subscribeThread = vi.fn(async () => ({ repo: 'mastra-ai/mastra', prNumber: 456 }));
    const { ctx, memory, infoMessages } = createCtx({ githubSignals: { subscribeThread } });

    await handleGithubCommand(ctx, ['subscribe']);

    expect(defaultGithubCommandRunnerMock).toHaveBeenNthCalledWith(1, ['auth', 'status']);
    expect(defaultGithubCommandRunnerMock).toHaveBeenNthCalledWith(2, ['pr', 'view', '--json', 'number,url']);
    expect(subscribeThread).toHaveBeenCalledWith({
      memory,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 456,
    });
    expect(ctx.state.activeGithubPrSubscriptions).toEqual([{ repo: 'mastra-ai/mastra', prNumber: 456 }]);
    expect(infoMessages[0]).toContain('Subscribed to GitHub PR #456');
  });

  it('shows an error when subscribing without args and no current PR is found', async () => {
    defaultGithubCommandRunnerMock
      .mockResolvedValueOnce({ stdout: '' })
      .mockRejectedValueOnce(new Error('no pull requests found'));
    const subscribeThread = vi.fn();
    const { ctx, errorMessages } = createCtx({ githubSignals: { subscribeThread } });

    await handleGithubCommand(ctx, ['subscribe']);

    expect(subscribeThread).not.toHaveBeenCalled();
    expect(errorMessages[0]).toContain('Could not find a GitHub PR for the current branch');
  });

  it('requires gh to be installed before subscribing', async () => {
    defaultGithubCommandRunnerMock.mockRejectedValue(new Error('spawn gh ENOENT'));
    const subscribeThread = vi.fn();
    const { ctx, errorMessages } = createCtx({ githubSignals: { subscribeThread } });

    await handleGithubCommand(ctx, ['subscribe', '123', 'mastra-ai/mastra']);

    expect(subscribeThread).not.toHaveBeenCalled();
    expect(errorMessages[0]).toContain('require the GitHub CLI');
  });

  it('requires gh to be authenticated before subscribing', async () => {
    defaultGithubCommandRunnerMock.mockRejectedValue(
      new Error('You are not logged into any GitHub hosts. Run gh auth login'),
    );
    const subscribeThread = vi.fn();
    const { ctx, errorMessages } = createCtx({ githubSignals: { subscribeThread } });

    await handleGithubCommand(ctx, ['subscribe', '123', 'mastra-ai/mastra']);

    expect(subscribeThread).not.toHaveBeenCalled();
    expect(errorMessages[0]).toContain('Run `gh auth login`');
  });

  it('unsubscribes the current thread and removes the PR badge', async () => {
    const unsubscribeThread = vi.fn(async () => ({ repo: 'mastra-ai/mastra', prNumber: 123 }));
    const { ctx, memory, infoMessages } = createCtx({ githubSignals: { unsubscribeThread } });
    ctx.state.activeGithubPrSubscriptions = [{ repo: 'mastra-ai/mastra', prNumber: 123 }];

    await handleGithubCommand(ctx, ['unsubscribe', '123', 'mastra-ai/mastra']);

    expect(unsubscribeThread).toHaveBeenCalledWith({
      memory,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(ctx.state.activeGithubPrSubscriptions).toEqual([]);
    expect(ctx.updateStatusLine).toHaveBeenCalled();
    expect(infoMessages[0]).toContain('Unsubscribed from GitHub PR #123');
  });

  it('infers the repo from the active PR badge when unsubscribing by number', async () => {
    const unsubscribeThread = vi.fn(async () => ({ repo: 'mastra-ai/mastra', prNumber: 123 }));
    const { ctx, memory } = createCtx({ githubSignals: { unsubscribeThread } });
    ctx.state.activeGithubPrSubscriptions = [{ repo: 'mastra-ai/mastra', prNumber: 123 }];

    await handleGithubCommand(ctx, ['unsubscribe', '123']);

    expect(unsubscribeThread).toHaveBeenCalledWith({
      memory,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(ctx.state.activeGithubPrSubscriptions).toEqual([]);
  });

  it('infers the repo from the active PR badge when syncing by number', async () => {
    const init = vi.fn(async () => {});
    const syncThread = vi.fn(async () => ({ pendingDelivered: 0 }));
    const { ctx } = createCtx({ githubSignals: { init, syncThread } });
    ctx.state.activeGithubPrSubscriptions = [{ repo: 'mastra-ai/mastra', prNumber: 123 }];

    await handleGithubCommand(ctx, ['sync', '123']);

    expect(syncThread).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
  });

  it('requires an explicit repo when multiple active badges match the PR number', async () => {
    const unsubscribeThread = vi.fn();
    const { ctx, errorMessages } = createCtx({ githubSignals: { unsubscribeThread } });
    ctx.state.activeGithubPrSubscriptions = [
      { repo: 'mastra-ai/mastra', prNumber: 123 },
      { repo: 'other/repo', prNumber: 123 },
    ];

    await handleGithubCommand(ctx, ['unsubscribe', '123']);

    expect(unsubscribeThread).not.toHaveBeenCalled();
    expect(errorMessages[0]).toContain('Pass the repo explicitly');
  });

  it('syncs the current thread, animates the PR badge, and reports delivered pending notifications', async () => {
    let resolveSync: ((value: { pendingDelivered: number }) => void) | undefined;
    const init = vi.fn(async () => {});
    const syncThread = vi.fn(() => new Promise<{ pendingDelivered: number }>(resolve => (resolveSync = resolve)));
    const { ctx, memory, infoMessages } = createCtx({ githubSignals: { init, syncThread } });

    const pending = handleGithubCommand(ctx, ['sync', '123', 'mastra-ai/mastra']);
    await vi.waitFor(() => expect(syncThread).toHaveBeenCalled());

    expect(ctx.state.githubSyncingPrSubscriptions).toEqual([{ repo: 'mastra-ai/mastra', prNumber: 123 }]);
    resolveSync?.({ pendingDelivered: 2 });
    await pending;

    expect(init).toHaveBeenCalledWith({ memory, resourceId: 'resource-1', threadId: 'thread-1' });
    expect(syncThread).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(ctx.state.githubSyncingPrSubscriptions).toEqual([]);
    expect(ctx.updateStatusLine).toHaveBeenCalledTimes(2);
    expect(infoMessages[0]).toContain('Delivered 2 pending GitHub notifications');
  });

  it('clears the syncing PR badge when sync fails', async () => {
    const init = vi.fn(async () => {});
    const syncThread = vi.fn(async () => {
      throw new Error('sync failed');
    });
    const { ctx } = createCtx({ githubSignals: { init, syncThread } });

    await expect(handleGithubCommand(ctx, ['sync', '123', 'mastra-ai/mastra'])).rejects.toThrow('sync failed');

    expect(ctx.state.githubSyncingPrSubscriptions).toEqual([]);
    expect(ctx.updateStatusLine).toHaveBeenCalledTimes(2);
  });
});
