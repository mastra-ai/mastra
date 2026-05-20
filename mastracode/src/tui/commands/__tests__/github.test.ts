import { describe, expect, it, vi } from 'vitest';

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
  };
  const githubSignals = options.githubSignals ?? {
    subscribeThread: vi.fn(),
    unsubscribeThread: vi.fn(),
    init: vi.fn(),
    syncThread: vi.fn(),
  };
  const ctx = {
    state: { activeGithubPrSubscriptions: [] },
    harness,
    githubSignals,
    showInfo: vi.fn((message: string) => infoMessages.push(message)),
    showError: vi.fn((message: string) => errorMessages.push(message)),
    updateStatusLine: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, infoMessages, errorMessages, memory, githubSignals };
}

describe('handleGithubCommand', () => {
  it('shows usage for invalid args', async () => {
    const { ctx, infoMessages } = createCtx();

    await handleGithubCommand(ctx, []);

    expect(infoMessages[0]).toContain('/github subscribe <prNumber> [repo]');
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
    expect(infoMessages[0]).toContain('Subscribed to GitHub PR #123');
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

  it('syncs the current thread and reports delivered pending notifications', async () => {
    const init = vi.fn(async () => {});
    const syncThread = vi.fn(async () => ({ pendingDelivered: 2 }));
    const { ctx, memory, infoMessages } = createCtx({ githubSignals: { init, syncThread } });

    await handleGithubCommand(ctx, ['sync', '123', 'mastra-ai/mastra']);

    expect(init).toHaveBeenCalledWith({ memory, resourceId: 'resource-1', threadId: 'thread-1' });
    expect(syncThread).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(ctx.updateStatusLine).toHaveBeenCalled();
    expect(infoMessages[0]).toContain('Delivered 2 pending GitHub notifications');
  });
});
