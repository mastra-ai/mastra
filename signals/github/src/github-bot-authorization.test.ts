import type { StorageThreadType } from '@mastra/core/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GithubAppOwnerResolver } from './github-app-owner.js';
import { GITHUB_SIGNALS_METADATA_KEY, GithubSignals } from './index.js';
import type {
  GithubPermission,
  GithubSignalsOptions,
  GithubSignalsSyncClient,
  GithubSignalsThreadStore,
} from './index.js';

let caseNumber = 0;

function createThreadStore(thread: StorageThreadType): GithubSignalsThreadStore {
  return {
    getThreadById: vi.fn(async () => thread),
    saveThread: vi.fn(async ({ thread: nextThread }) => {
      thread = nextThread;
      return nextThread;
    }),
  };
}

function createBotPoll(options: {
  botLogin?: string;
  repositoryOwner?: string;
  permission?: GithubPermission;
  permissionError?: Error;
  authorizedPermissions?: GithubPermission[];
  authorizedBots?: string[];
  ignoredBots?: string[];
  pollIntervalMs?: number;
}) {
  const id = ++caseNumber;
  const thread: StorageThreadType = {
    id: `bot-owner-thread-${id}`,
    resourceId: `bot-owner-resource-${id}`,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {
      mastra: {
        [GITHUB_SIGNALS_METADATA_KEY]: {
          subscriptions: [
            {
              owner: options.repositoryOwner ?? 'mastra-ai',
              repo: 'mastra',
              number: 42,
              mode: 'working',
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: `signal-${id}`,
              lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
              lastObservedContentHash: 'same-content-hash',
              lastObservedThreadContentHash: 'same-thread-hash',
              lastObservedHeadSha: 'same-head-sha',
              lastObservedState: 'open',
              lastObservedMergeableState: 'clean',
              lastObservedCiState: 'success',
              lastObservedReviewStateHash: 'reviews-0',
            },
          ],
        },
      },
    },
  };
  const botLogin = options.botLogin ?? 'review-app[bot]';
  const syncClient: GithubSignalsSyncClient = {
    syncPullRequest: vi.fn(async () => ({ ok: true })),
    getPullRequestSnapshot: vi.fn(async () => ({
      title: 'Bot owner authorization test',
      state: 'open',
      githubUpdatedAt: '2026-01-01T00:01:00.000Z',
      contentHash: 'same-content-hash',
      threadContentHash: 'same-thread-hash',
      headSha: 'same-head-sha',
      mergeableState: 'clean',
      ciState: 'success' as const,
      reviewStateHash: 'reviews-0',
      latestCommentAuthor: botLogin,
      latestCommentAuthorType: 'Bot',
      latestCommentIsBot: true,
      latestCommentBody: 'Review complete.',
      latestCommentUrl: `https://github.com/mastra-ai/mastra/pull/42#issuecomment-${id}`,
      latestCommentUpdatedAt: '2026-01-01T00:01:00.000Z',
    })),
  };
  const permissionResolver = {
    getPermission: vi.fn(async () => {
      if (options.permissionError) throw options.permissionError;
      return options.permission;
    }),
  };
  const threadStore = createThreadStore(thread);
  const processorOptions: GithubSignalsOptions = {
    threadStore,
    syncClient,
    permissionResolver,
    pollIntervalMs: options.pollIntervalMs,
    ...(options.authorizedPermissions ? { authorizedPermissions: options.authorizedPermissions } : {}),
    ...(options.authorizedBots ? { authorizedBots: options.authorizedBots } : {}),
    ...(options.ignoredBots ? { ignoredBots: options.ignoredBots } : {}),
  };
  const processor = new GithubSignals(processorOptions);
  const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
  processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

  return { processor, thread, threadStore, permissionResolver, sendNotificationSignal };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('GithubSignals bot authorization by app ownership', () => {
  it.each(['write', 'maintain', 'admin'] as const)(
    'allows a user-owned app when the owner has %s permission',
    async permission => {
      const getOwner = vi
        .spyOn(GithubAppOwnerResolver.prototype, 'getOwner')
        .mockResolvedValue({ login: 'AppCreator', type: 'User' });
      const test = createBotPoll({ permission, authorizedBots: [] });

      await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

      expect(getOwner).toHaveBeenCalledWith('review-app[bot]', expect.any(Function));
      expect(test.permissionResolver.getPermission).toHaveBeenCalledWith('mastra-ai', 'mastra', 'AppCreator');
      expect(test.sendNotificationSignal).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['read', 'triage', 'none', undefined] as const)(
    'denies a user-owned app with default-disallowed permission %s',
    async permission => {
      vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockResolvedValue({ login: 'AppCreator', type: 'User' });
      const test = createBotPoll({ permission, authorizedBots: [] });

      await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

      expect(test.sendNotificationSignal).not.toHaveBeenCalled();
    },
  );

  it('denies a user-owned app when permission lookup fails', async () => {
    vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockResolvedValue({ login: 'AppCreator', type: 'User' });
    const test = createBotPoll({ permissionError: new Error('permission unavailable'), authorizedBots: [] });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(test.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('reuses configured authorized permissions for user app owners', async () => {
    vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockResolvedValue({ login: 'AppCreator', type: 'User' });
    const test = createBotPoll({ permission: 'read', authorizedPermissions: ['read'], authorizedBots: [] });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(test.sendNotificationSignal).toHaveBeenCalledTimes(1);
  });

  it('allows an app owned by the repository organization without a permission lookup', async () => {
    vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockResolvedValue({
      login: 'MASTRA-AI',
      type: 'Organization',
    });
    const test = createBotPoll({ repositoryOwner: 'mastra-ai', authorizedBots: [] });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(test.permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(test.sendNotificationSignal).toHaveBeenCalledTimes(1);
  });

  it('denies an app owned by a different organization', async () => {
    vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockResolvedValue({ login: 'vercel', type: 'Organization' });
    const test = createBotPoll({ repositoryOwner: 'mastra-ai', authorizedBots: [] });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(test.permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(test.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('denies ignored bots before owner or permission lookup', async () => {
    const getOwner = vi
      .spyOn(GithubAppOwnerResolver.prototype, 'getOwner')
      .mockResolvedValue({ login: 'mastra-ai', type: 'Organization' });
    const test = createBotPoll({
      botLogin: 'Review-App[BOT]',
      ignoredBots: ['review-app[bot]'],
      authorizedBots: ['REVIEW-APP[BOT]'],
    });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(getOwner).not.toHaveBeenCalled();
    expect(test.permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(test.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it.each([
    ['configured', 'custom-review[bot]', ['CUSTOM-REVIEW[BOT]'] as string[]],
    ['default', 'CodeRabbitAI[BOT]', undefined],
  ])('allows a %s authorized bot before owner lookup', async (_kind, botLogin, authorizedBots) => {
    const getOwner = vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner');
    const test = createBotPoll({ botLogin, authorizedBots });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(getOwner).not.toHaveBeenCalled();
    expect(test.permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(test.sendNotificationSignal).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing owner', undefined],
    ['unsupported owner type', { login: 'enterprise-owner', type: 'Enterprise' }],
  ])('fails closed for %s', async (_kind, owner) => {
    vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockResolvedValue(owner as never);
    const test = createBotPoll({ authorizedBots: [] });

    await test.processor.pollThreadNow({ threadId: test.thread.id, resourceId: test.thread.resourceId });

    expect(test.permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(test.sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('stops an in-flight poll during app-owner resolution without notification or cursor save', async () => {
    vi.useFakeTimers();
    let resolveOwner!: (owner: { login: string; type: 'Organization' }) => void;
    const getOwner = vi.spyOn(GithubAppOwnerResolver.prototype, 'getOwner').mockImplementation(
      () =>
        new Promise(resolve => {
          resolveOwner = resolve;
        }),
    );
    const test = createBotPoll({ authorizedBots: [], pollIntervalMs: 1_000 });
    const pendingPoll = test.processor.pollThreadNow({
      threadId: test.thread.id,
      resourceId: test.thread.resourceId,
    });
    await vi.waitFor(() => expect(getOwner).toHaveBeenCalledTimes(1));

    test.processor.stopAllPolling();
    resolveOwner({ login: 'mastra-ai', type: 'Organization' });
    await pendingPoll;

    expect(test.sendNotificationSignal).not.toHaveBeenCalled();
    expect(test.threadStore.saveThread).not.toHaveBeenCalled();
  });
});
