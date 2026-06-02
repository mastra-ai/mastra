import { createSignal } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { IMastraLogger } from '@mastra/core/logger';
import type { StorageThreadType } from '@mastra/core/memory';
import { ProcessorRunner } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { GithubSignals, GITHUB_SIGNALS_METADATA_KEY, GITHUB_SYNC_STATUS_TAG } from './index.js';
import type { GithubRepositoryResolver, GithubSignalsSyncClient, GithubSignalsThreadStore } from './index.js';

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
  it('creates typed subscribe-to-PR signals', () => {
    expect(GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 })).toEqual(
      expect.objectContaining({
        type: 'user',
        tagName: 'github-subscribe-pr',
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
    };
    const signal = createSignal(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
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
});
