import { createSignal } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { IMastraLogger } from '@mastra/core/logger';
import type { StorageThreadType } from '@mastra/core/memory';
import { ProcessorRunner } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GithubSignals, GITHUB_SIGNALS_METADATA_KEY, GITHUB_SYNC_STATUS_TAG } from './index.js';
import type {
  GithubPullRequestSnapshot,
  GithubRepositoryResolver,
  GithubSignalsSyncClient,
  GithubSignalsThreadStore,
} from './index.js';

const mockLogger: IMastraLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => []),
  listLogs: vi.fn(() => []),
  listLogsByRunId: vi.fn(() => []),
} as any;

function createThreadStore(thread: StorageThreadType): GithubSignalsThreadStore {
  return {
    getThreadById: vi.fn(async () => thread),
    saveThread: vi.fn(async ({ thread: nextThread }: { thread: StorageThreadType }) => {
      thread = nextThread;
      return nextThread;
    }),
  };
}

function createRequestContext(thread: StorageThreadType) {
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', {
    thread: { id: thread.id },
    resourceId: thread.resourceId,
  });
  return requestContext;
}

async function runGithubSignalsProcessor(args: {
  processor: GithubSignals;
  messageList: MessageList;
  requestContext: RequestContext;
  chunks?: unknown[];
}) {
  const runner = new ProcessorRunner({
    inputProcessors: [args.processor],
    outputProcessors: [],
    logger: mockLogger,
    agentName: 'github-agent',
  });

  return runner.runProcessInputStep({
    messageList: args.messageList,
    stepNumber: 0,
    steps: [],
    model: {} as any,
    tools: {},
    retryCount: 0,
    requestContext: args.requestContext,
    messageId: 'response-1',
    writer: {
      custom: vi.fn(async (chunk: unknown) => {
        args.chunks?.push(chunk);
      }),
    },
  });
}

describe('GithubSignals', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates typed subscribe and unsubscribe PR signals', () => {
    expect(GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 })).toEqual(
      expect.objectContaining({
        type: 'user',
        tagName: 'github-subscribe-pr',
        attributes: { owner: 'mastra-ai', repo: 'mastra', number: 123 },
      }),
    );
    expect(GithubSignals.signals.unsubscribeFromPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 })).toEqual(
      expect.objectContaining({
        type: 'user',
        tagName: 'github-unsubscribe-pr',
        attributes: { owner: 'mastra-ai', repo: 'mastra', number: 123 },
      }),
    );
  });

  it('persists a thread-scoped PR subscription and syncs only that PR', async () => {
    const thread: StorageThreadType = {
      id: 'thread-1',
      resourceId: 'resource-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: { existing: true },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true, stdout: '{"ok":true}' })),
      getPullRequestSnapshot: vi.fn(async () => ({
        githubUpdatedAt: '2026-01-01T00:00:00.000Z',
        contentHash: 'initial-hash',
      })),
    };
    const signal = createSignal({
      ...GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
      type: 'reactive',
    });
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');
    const chunks: unknown[] = [];

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncClient }),
      messageList,
      requestContext: createRequestContext(thread),
      chunks,
    });

    expect(syncClient.syncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    expect(threadStore.saveThread).toHaveBeenCalledTimes(1);
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    expect(savedThread.metadata).toEqual(
      expect.objectContaining({
        existing: true,
        mastra: expect.objectContaining({
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              expect.objectContaining({
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                lastSubscribeSignalId: signal.id,
                lastSyncStatus: 'success',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'initial-hash',
              }),
            ],
          },
        }),
      }),
    );
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: 'data-signal',
        data: expect.objectContaining({
          type: 'reactive',
          tagName: GITHUB_SYNC_STATUS_TAG,
          attributes: expect.objectContaining({
            status: 'subscribed',
            owner: 'mastra-ai',
            repo: 'mastra',
            number: 123,
          }),
        }),
      }),
    );
  });

  it('emits an initial PR baseline notification on subscribe', async () => {
    const thread: StorageThreadType = {
      id: 'thread-baseline',
      resourceId: 'resource-baseline',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const threadStore = createThreadStore(thread);
    const snapshot: GithubPullRequestSnapshot = {
      title: 'Add GitHub signals',
      state: 'open',
      githubUpdatedAt: '2026-01-01T00:00:00.000Z',
      contentHash: 'baseline-hash',
      ciState: 'failure',
      mergeableState: 'clean',
      unresolvedReviewThreads: 2,
      reviewStateHash: 'reviews-2',
      checks: [{ name: 'Quality assurance', status: 'completed', conclusion: 'failure' }],
    };
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => snapshot),
    };
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })) } as any);
    const signal = createSignal(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

    await runGithubSignalsProcessor({
      processor,
      messageList,
      requestContext: createRequestContext(thread),
    });

    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'github',
        kind: 'pull-request-baseline',
        priority: 'high',
        summary:
          'mastra-ai/mastra#123 subscribed: Add GitHub signals (state: open; CI: failure; mergeability: clean; 2 unresolved review threads; failing: Quality assurance)',
        attributes: expect.objectContaining({
          owner: 'mastra-ai',
          repo: 'mastra',
          number: 123,
          ciState: 'failure',
          unresolvedReviewThreads: 2,
        }),
      }),
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastObservedCiState: 'failure',
      lastObservedReviewStateHash: 'reviews-2',
      lastObservedState: 'open',
      lastObservedMergeableState: 'clean',
    });
  });

  it('resolves owner and repo from the project when the signal only carries a PR number', async () => {
    const thread: StorageThreadType = {
      id: 'thread-2',
      resourceId: 'resource-2',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = { syncPullRequest: vi.fn(async () => ({ ok: true })) };
    const repositoryResolver: GithubRepositoryResolver = {
      resolveRepository: vi.fn(async () => ({ owner: 'mastra-ai', repo: 'mastra' })),
    };
    const signal = createSignal(GithubSignals.signals.subscribeToPR(456));
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ cwd: '/repo', threadStore, syncClient, repositoryResolver }),
      messageList,
      requestContext: createRequestContext(thread),
    });

    expect(repositoryResolver.resolveRepository).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/repo' }));
    expect(syncClient.syncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 456, cwd: '/repo' }),
    );
  });

  it('does not reprocess the same subscribe signal twice', async () => {
    const signal = createSignal(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const thread: StorageThreadType = {
      id: 'thread-3',
      resourceId: 'resource-3',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: signal.id,
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = { syncPullRequest: vi.fn(async () => ({ ok: true })) };
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncClient }),
      messageList,
      requestContext: createRequestContext(thread),
    });

    expect(syncClient.syncPullRequest).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('removes a subscription from thread metadata when an unsubscribe signal is processed', async () => {
    const signal = createSignal(
      GithubSignals.signals.unsubscribeFromPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const thread: StorageThreadType = {
      id: 'thread-4',
      resourceId: 'resource-4',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');
    const chunks: unknown[] = [];

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncOnSubscribe: false }),
      messageList,
      requestContext: createRequestContext(thread),
      chunks,
    });

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([]);
    expect(chunks).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          tagName: GITHUB_SYNC_STATUS_TAG,
          attributes: expect.objectContaining({
            status: 'unsubscribed',
            owner: 'mastra-ai',
            repo: 'mastra',
            number: 123,
          }),
        }),
      }),
    );
  });

  it('returns processor-owned tools that send subscribe and unsubscribe signals to the current agent', async () => {
    const thread: StorageThreadType = {
      id: 'thread-5',
      resourceId: 'resource-5',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    const processor = new GithubSignals({ syncOnSubscribe: false });
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal })) } as any);

    const result = await runGithubSignalsProcessor({
      processor,
      messageList,
      requestContext: createRequestContext(thread),
    });

    const tools = result.tools as Record<string, { execute: (input: any, context: any) => Promise<any> }>;
    await expect(
      tools.github_subscribe_pr.execute(
        { owner: 'mastra-ai', repo: 'mastra', number: 123 },
        { agent: { agentId: 'code-agent', threadId: thread.id, resourceId: thread.resourceId } },
      ),
    ).resolves.toMatchObject({ subscribed: true, number: 123 });
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'github-subscribe-pr' }),
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );

    await expect(
      tools.github_unsubscribe_pr.execute(
        { owner: 'mastra-ai', repo: 'mastra', number: 123 },
        { agent: { agentId: 'code-agent', threadId: thread.id, resourceId: thread.resourceId } },
      ),
    ).resolves.toMatchObject({ unsubscribed: true, number: 123 });
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'github-unsubscribe-pr' }),
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
  });

  it('polls subscribed PRs on the configured interval and updates thread metadata', async () => {
    vi.useFakeTimers();
    const thread: StorageThreadType = {
      id: 'thread-6',
      resourceId: 'resource-6',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastSyncError: 'old-error',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Add GitHub signals',
        state: 'open',
        htmlUrl: 'https://github.com/mastra-ai/mastra/pull/123',
        githubUpdatedAt: '2026-01-01T00:05:00.000Z',
        contentHash: 'new-hash',
      })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, pollIntervalMs: 1_000, agentId: 'code-agent' });
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })) } as any);

    await expect(processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(
      true,
    );
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(syncClient.syncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastSyncStatus: 'success',
      lastObservedGithubUpdatedAt: '2026-01-01T00:05:00.000Z',
      lastObservedContentHash: 'new-hash',
      lastNotificationKind: 'pull-request-activity',
      lastNotificationPriority: 'medium',
      lastNotificationSummary: 'mastra-ai/mastra#123 has new activity: Add GitHub signals',
    });
    expect(subscription.lastNotificationAt).toEqual(expect.any(String));
    expect(subscription.lastSyncError).toBeUndefined();
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'github',
        kind: 'pull-request-activity',
        priority: 'medium',
        summary: 'mastra-ai/mastra#123 has new activity: Add GitHub signals',
        attributes: expect.objectContaining({
          owner: 'mastra-ai',
          repo: 'mastra',
          number: 123,
          previousGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
          githubUpdatedAt: '2026-01-01T00:05:00.000Z',
        }),
      }),
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    processor.stopAllPolling();
  });

  it('emits a high-priority notification when CI fails between polls', async () => {
    const thread: StorageThreadType = {
      id: 'thread-ci',
      resourceId: 'resource-ci',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'ci-pending-hash',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Add GitHub signals',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:00:00.000Z',
        contentHash: 'ci-failed-hash',
        ciState: 'failure' as const,
        checks: [
          {
            name: 'Quality assurance',
            status: 'completed',
            conclusion: 'failure',
            detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/1',
          },
        ],
      })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })) } as any);

    await expect(processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(1);

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription.lastObservedContentHash).toBe('ci-failed-hash');
    expect(subscription).toMatchObject({
      lastNotificationKind: 'pull-request-ci-failure',
      lastNotificationPriority: 'high',
      lastNotificationSummary: 'mastra-ai/mastra#123 has failing CI: Quality assurance',
    });
    expect(subscription.lastNotificationAt).toEqual(expect.any(String));
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'github',
        kind: 'pull-request-ci-failure',
        priority: 'high',
        summary: 'mastra-ai/mastra#123 has failing CI: Quality assurance',
        attributes: expect.objectContaining({
          ciState: 'failure',
          failingChecks: 'Quality assurance',
        }),
      }),
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
  });

  it('classifies CI recovery, review activity, terminal states, and bot-only noise', async () => {
    const baseThread: StorageThreadType = {
      id: 'thread-classify',
      resourceId: 'resource-classify',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const createThreadWithCursor = (cursor: Record<string, unknown>): StorageThreadType => ({
      ...baseThread,
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
                ...cursor,
              },
            ],
          },
        },
      },
    });
    const runPoll = async (thread: StorageThreadType, snapshot: GithubPullRequestSnapshot) => {
      const threadStore = createThreadStore(thread);
      const syncClient: GithubSignalsSyncClient = {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => snapshot),
      };
      const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
      const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
      processor.__registerMastra({
        getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
      } as any);
      await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
      return sendNotificationSignal;
    };

    const ciRecovered = await runPoll(createThreadWithCursor({ lastObservedCiState: 'failure' }), {
      title: 'PR',
      state: 'open',
      contentHash: 'ci-ok',
      ciState: 'success',
    });
    expect(ciRecovered).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pull-request-ci-recovered', priority: 'medium' }),
      expect.anything(),
    );
    const reviewActivity = await runPoll(createThreadWithCursor({ lastObservedReviewStateHash: 'reviews-1' }), {
      title: 'PR',
      state: 'open',
      contentHash: 'reviews-2',
      ciState: 'unknown',
      unresolvedReviewThreads: 2,
      reviewStateHash: 'reviews-2',
    });
    expect(reviewActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pull-request-review-activity', priority: 'medium' }),
      expect.anything(),
    );
    const conflictsResolved = await runPoll(createThreadWithCursor({ lastObservedMergeableState: 'dirty' }), {
      title: 'PR',
      state: 'open',
      contentHash: 'clean',
      ciState: 'success',
      mergeableState: 'clean',
    });
    expect(conflictsResolved).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pull-request-conflict-resolved', priority: 'medium' }),
      expect.anything(),
    );
    const merged = await runPoll(createThreadWithCursor({ lastObservedState: 'open' }), {
      title: 'PR',
      state: 'merged',
      contentHash: 'merged',
      ciState: 'success',
    });
    expect(merged).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pull-request-merged', priority: 'high' }),
      expect.anything(),
    );
    const botNoise = await runPoll(createThreadWithCursor({ lastObservedContentHash: 'old-hash' }), {
      title: 'PR',
      state: 'open',
      contentHash: 'bot-hash',
      ciState: 'unknown',
      latestCommentAuthor: 'github-actions[bot]',
      latestCommentIsBot: true,
    });
    expect(botNoise).not.toHaveBeenCalled();
  });

  it('starts polling after subscribe and stops after the last subscription is removed', async () => {
    const subscribeSignal = createSignal(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const thread: StorageThreadType = {
      id: 'thread-7',
      resourceId: 'resource-7',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = { syncPullRequest: vi.fn(async () => ({ ok: true })) };
    const processor = new GithubSignals({ threadStore, syncClient });
    const subscribeMessageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    subscribeMessageList.add(
      [subscribeSignal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })],
      'input',
    );

    await runGithubSignalsProcessor({
      processor,
      messageList: subscribeMessageList,
      requestContext: createRequestContext(thread),
    });

    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    const unsubscribeSignal = createSignal(
      GithubSignals.signals.unsubscribeFromPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const unsubscribeMessageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    unsubscribeMessageList.add(
      [unsubscribeSignal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })],
      'input',
    );

    await runGithubSignalsProcessor({
      processor,
      messageList: unsubscribeMessageList,
      requestContext: createRequestContext(thread),
    });

    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(false);
  });
});
