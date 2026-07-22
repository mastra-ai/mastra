import { createSignal } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { IMastraLogger } from '@mastra/core/logger';
import type { StorageThreadType } from '@mastra/core/memory';
import { ProcessorRunner } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GithubSignals,
  GITHUB_SIGNALS_METADATA_KEY,
  GITHUB_SYNC_STATUS_TAG,
  normalizeGithubChecksForSnapshot,
  sanitizeCommentText,
} from './index.js';
import type {
  GithubPullRequestSnapshot,
  GithubRepositoryResolver,
  GithubSignalsOptions,
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

describe('normalizeGithubChecksForSnapshot', () => {
  it('drops old failing workflow rows when newer current check rows supersede them', () => {
    const checks = normalizeGithubChecksForSnapshot({
      checkRows: [
        {
          source: 'check',
          name: 'Prebuild',
          status: 'completed',
          conclusion: 'success',
          detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/current',
          updatedAt: '2026-06-02T22:00:00.000Z',
        },
      ],
      workflowRows: [
        {
          source: 'workflow',
          name: 'Prebuild',
          status: 'completed',
          conclusion: 'failure',
          detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/old',
          updatedAt: '2026-06-02T21:00:00.000Z',
        },
      ],
    });

    expect(checks).toEqual([expect.objectContaining({ name: 'Prebuild', status: 'completed', conclusion: 'success' })]);
  });

  it('keeps rerun pending checks when they are the current state', () => {
    const checks = normalizeGithubChecksForSnapshot({
      checkRows: [
        {
          source: 'check',
          name: 'E2E Tests / E2E kitchen-sink (1/3)',
          status: 'queued',
          conclusion: undefined,
          detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/current',
          updatedAt: '2026-06-02T22:10:00.000Z',
        },
      ],
      workflowRows: [],
    });

    expect(checks).toEqual([expect.objectContaining({ name: 'E2E Tests / E2E kitchen-sink (1/3)', status: 'queued' })]);
  });

  it('collapses duplicate workflow and check rows to the latest current row', () => {
    const checks = normalizeGithubChecksForSnapshot({
      checkRows: [
        {
          source: 'check',
          name: 'Changed Test Gate',
          status: 'completed',
          conclusion: 'success',
          detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/1',
          updatedAt: '2026-06-02T22:00:00.000Z',
        },
        {
          source: 'check',
          name: 'Changed Test Gate',
          status: 'completed',
          conclusion: 'failure',
          detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/1',
          updatedAt: '2026-06-02T21:00:00.000Z',
        },
      ],
      workflowRows: [
        {
          source: 'workflow',
          name: 'Changed Test Gate',
          status: 'completed',
          conclusion: 'failure',
          detailsUrl: 'https://github.com/mastra-ai/mastra/actions/runs/1',
          updatedAt: '2026-06-02T21:30:00.000Z',
        },
      ],
    });

    expect(checks).toEqual([
      expect.objectContaining({ name: 'Changed Test Gate', status: 'completed', conclusion: 'success' }),
    ]);
  });
});

describe('GithubSignals', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates typed subscribe and unsubscribe PR signals', () => {
    expect(GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 })).toEqual(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'github-subscribe-pr',
        attributes: { owner: 'mastra-ai', repo: 'mastra', number: 123 },
      }),
    );
    expect(GithubSignals.signals.unsubscribeFromPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 })).toEqual(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'github-unsubscribe-pr',
        attributes: { owner: 'mastra-ai', repo: 'mastra', number: 123 },
      }),
    );
  });

  it('emits a subscription hint after PR work evidence', async () => {
    const thread: StorageThreadType = {
      id: 'thread-hint',
      resourceId: 'resource-hint',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const sendSignal = vi.fn(async () => ({ id: 'hint-signal' }));

    await new GithubSignals({ threadStore }).processOutputStep({
      messages: [],
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
      stepNumber: 0,
      steps: [],
      text: 'I checked https://github.com/mastra-ai/mastra/pull/17439 and CI is failing.',
      toolCalls: [],
      usage: {} as any,
      systemMessages: [],
      state: {},
      sendSignal,
    } as any);

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'system-reminder',
        contents: expect.stringContaining('/github subscribe 17439'),
        attributes: { type: 'github-subscription-hint' },
      }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptionHintShown).toBe(true);
  });

  it('does not duplicate subscription hints once shown', async () => {
    const thread: StorageThreadType = {
      id: 'thread-hint-shown',
      resourceId: 'resource-hint-shown',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: { mastra: { [GITHUB_SIGNALS_METADATA_KEY]: { subscriptions: [], subscriptionHintShown: true } } },
    };
    const threadStore = createThreadStore(thread);
    const sendSignal = vi.fn();

    await new GithubSignals({ threadStore }).processOutputStep({
      messages: [],
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
      stepNumber: 0,
      steps: [],
      text: 'gh pr checks 17439',
      toolCalls: [],
      usage: {} as any,
      systemMessages: [],
      state: {},
      sendSignal,
    } as any);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('does not emit subscription hints when the thread is already subscribed', async () => {
    const thread: StorageThreadType = {
      id: 'thread-hint-subscribed',
      resourceId: 'resource-hint-subscribed',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 17439,
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
    const sendSignal = vi.fn();

    await new GithubSignals({ threadStore }).processOutputStep({
      messages: [],
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
      stepNumber: 0,
      steps: [],
      text: 'gh pr view 17439',
      toolCalls: [],
      usage: {} as any,
      systemMessages: [],
      state: {},
      sendSignal,
    } as any);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('returns GitHub subscribe and unsubscribe tools from processInputStep', async () => {
    const thread: StorageThreadType = {
      id: 'thread-tools',
      resourceId: 'resource-tools',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };

    const result = await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore: createThreadStore(thread) }),
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });

    expect(Object.keys(result.tools ?? {})).toEqual(
      expect.arrayContaining(['github_subscribe_pr', 'github_unsubscribe_pr']),
    );
  });

  it('subscribe and unsubscribe tools mutate the current thread subscription directly', async () => {
    const thread: StorageThreadType = {
      id: 'thread-tool-signal',
      resourceId: 'resource-tool-signal',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({ githubUpdatedAt: '2026-01-01T00:00:00.000Z', contentHash: 'hash' })),
    };
    const processor = new GithubSignals({ threadStore, syncClient });

    const result = await runGithubSignalsProcessor({
      processor,
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });
    const tools = result.tools as Record<string, { execute: (input: unknown, context?: unknown) => Promise<unknown> }>;

    await expect(
      tools.github_subscribe_pr!.execute(
        { owner: 'mastra-ai', repo: 'mastra', number: 17439 },
        {
          agentId: 'code-agent',
          threadId: thread.id,
          resourceId: thread.resourceId,
          toolCallId: 'tool-call-1',
          messages: [],
        },
      ),
    ).resolves.toMatchObject({ subscribed: true, owner: 'mastra-ai', repo: 'mastra', number: 17439 });
    let savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 17439 }),
    ]);

    await expect(
      tools.github_unsubscribe_pr!.execute(
        { owner: 'mastra-ai', repo: 'mastra', number: 17439 },
        {
          agentId: 'code-agent',
          threadId: thread.id,
          resourceId: thread.resourceId,
          toolCallId: 'tool-call-2',
          messages: [],
        },
      ),
    ).resolves.toMatchObject({ unsubscribed: true, owner: 'mastra-ai', repo: 'mastra', number: 17439 });
    savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([]);
    processor.stopAllPolling();
  });

  it('subscribe tool falls back to processor thread context when execution context omits agent details', async () => {
    const thread: StorageThreadType = {
      id: 'thread-tool-context-fallback',
      resourceId: 'resource-tool-context-fallback',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const processor = new GithubSignals({ threadStore, syncOnSubscribe: false });

    const result = await runGithubSignalsProcessor({
      processor,
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });
    const tools = result.tools as Record<string, { execute: (input: unknown, context?: unknown) => Promise<unknown> }>;

    await tools.github_subscribe_pr!.execute({ owner: 'mastra-ai', repo: 'mastra', number: 17439 }, {});

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 17439, lastSyncStatus: 'skipped' }),
    ]);
    processor.stopAllPolling();
  });

  it('subscribe and unsubscribe tools use the explicit tool execution thread context when present', async () => {
    let capturedThread: StorageThreadType = {
      id: 'thread-from-request-context',
      resourceId: 'resource-from-request-context',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const explicitThread: StorageThreadType = {
      id: 'thread-from-tool-context',
      resourceId: 'resource-from-tool-context',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore: GithubSignalsThreadStore = {
      getThreadById: vi.fn(async ({ threadId }) => (threadId === explicitThread.id ? explicitThread : capturedThread)),
      saveThread: vi.fn(async ({ thread: nextThread }) => {
        if (nextThread.id === explicitThread.id) explicitThread.metadata = nextThread.metadata;
        if (nextThread.id === capturedThread.id) capturedThread = nextThread;
        return nextThread;
      }),
    };
    const processor = new GithubSignals({ threadStore, syncOnSubscribe: false });

    const result = await runGithubSignalsProcessor({
      processor,
      messageList: new MessageList({ threadId: capturedThread.id, resourceId: capturedThread.resourceId }),
      requestContext: createRequestContext(capturedThread),
    });
    const tools = result.tools as Record<string, { execute: (input: unknown, context?: unknown) => Promise<unknown> }>;
    const toolContext = { agent: { threadId: explicitThread.id, resourceId: explicitThread.resourceId } };

    await tools.github_subscribe_pr!.execute({ owner: 'mastra-ai', repo: 'mastra', number: 17439 }, toolContext);
    await tools.github_unsubscribe_pr!.execute({ owner: 'mastra-ai', repo: 'mastra', number: 17439 }, toolContext);

    expect(threadStore.getThreadById).toHaveBeenCalledWith({
      threadId: explicitThread.id,
      resourceId: explicitThread.resourceId,
    });
    expect(threadStore.saveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        thread: expect.objectContaining({ id: explicitThread.id, resourceId: explicitThread.resourceId }),
      }),
    );
    expect((explicitThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([]);
    expect((capturedThread.metadata?.mastra as any)?.[GITHUB_SIGNALS_METADATA_KEY]?.subscriptions).toBeUndefined();
    processor.stopAllPolling();
  });

  it('tool-emitted subscribe signals are handled by the same subscription logic', async () => {
    const thread: StorageThreadType = {
      id: 'thread-tool-shared-path',
      resourceId: 'resource-tool-shared-path',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({ githubUpdatedAt: '2026-01-01T00:00:00.000Z', contentHash: 'hash' })),
    };
    const signal = createSignal({
      ...GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 17439 }),
      type: 'reactive',
    });
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncClient }),
      messageList,
      requestContext: createRequestContext(thread),
    });

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const subscriptions = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscriptions).toEqual([expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 17439 })]);
  });

  it('does not replay historical subscribe signals when they are not the latest message', async () => {
    const thread: StorageThreadType = {
      id: 'thread-historical-subscribe',
      resourceId: 'resource-historical-subscribe',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({ githubUpdatedAt: '2026-01-01T00:00:00.000Z', contentHash: 'hash' })),
    };
    const signal = createSignal({
      ...GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 17449 }),
      type: 'reactive',
    });
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add(
      [
        signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
        {
          id: 'assistant-after-merge',
          role: 'assistant',
          type: 'text',
          thread_id: thread.id,
          resourceId: thread.resourceId,
          content: { format: 2, parts: [{ type: 'text', text: 'PR merged and auto-unsubscribed.' }] },
          createdAt: new Date(),
        } as any,
      ],
      'input',
    );

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncClient }),
      messageList,
      requestContext: createRequestContext(thread),
    });

    expect(syncClient.syncPullRequest).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('does not emit subscription hints for unrelated tool calls', async () => {
    const thread: StorageThreadType = {
      id: 'thread-no-hint',
      resourceId: 'resource-no-hint',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const sendSignal = vi.fn();

    await new GithubSignals({ threadStore }).processOutputStep({
      messages: [],
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
      stepNumber: 0,
      steps: [],
      text: 'pnpm test -- --bail 1',
      toolCalls: [{ toolName: 'execute_command', toolCallId: 'tool-1', args: { command: 'pnpm test' } }],
      usage: {} as any,
      systemMessages: [],
      state: {},
      sendSignal,
    } as any);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
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

  it('still subscribes when the baseline snapshot read fails and records the error', async () => {
    const thread: StorageThreadType = {
      id: 'thread-subscribe-snapshot-error',
      resourceId: 'resource-subscribe-snapshot-error',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true, stdout: '{"ok":true}' })),
      getPullRequestSnapshot: vi.fn(async () => {
        throw new Error('gitcrawl database query failed (db: /missing/gitcrawl.db): unable to open database file');
      }),
    };
    const signal = createSignal({
      ...GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
      type: 'reactive',
    });
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');
    const chunks: unknown[] = [];

    // The subscribe itself must not fail when only the snapshot read fails.
    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncClient }),
      messageList,
      requestContext: createRequestContext(thread),
      chunks,
    });

    expect(threadStore.saveThread).toHaveBeenCalledTimes(1);
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      owner: 'mastra-ai',
      repo: 'mastra',
      number: 123,
      lastSyncStatus: 'success',
      lastSnapshotError: 'gitcrawl database query failed (db: /missing/gitcrawl.db): unable to open database file',
    });
    // No baseline cursor and no baseline notification without a snapshot.
    expect(subscription.lastObservedContentHash).toBeUndefined();
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: 'data-signal',
        data: expect.objectContaining({
          tagName: GITHUB_SYNC_STATUS_TAG,
          attributes: expect.objectContaining({ status: 'subscribed', number: 123 }),
        }),
      }),
    );
  });

  it('preserves one-time hint state and granular cursors when resubscribing', async () => {
    const thread: StorageThreadType = {
      id: 'thread-resubscribe',
      resourceId: 'resource-resubscribe',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptionHintShown: true,
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 123,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'aggregate-hash',
                lastObservedThreadContentHash: 'thread-hash',
                lastObservedHeadSha: 'head-sha',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const signal = createSignal(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore, syncOnSubscribe: false }),
      messageList,
      requestContext: createRequestContext(thread),
    });

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const savedGithubMetadata = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY];
    expect(savedGithubMetadata.subscriptionHintShown).toBe(true);
    expect(savedGithubMetadata.subscriptions[0]).toMatchObject({
      lastSubscribeSignalId: signal.id,
      lastObservedContentHash: 'aggregate-hash',
      lastObservedThreadContentHash: 'thread-hash',
      lastObservedHeadSha: 'head-sha',
      lastSyncStatus: 'skipped',
    });
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

  it('returns processor-owned tools that persist subscribe and unsubscribe operations immediately', async () => {
    const thread: StorageThreadType = {
      id: 'thread-5',
      resourceId: 'resource-5',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    const processor = new GithubSignals({ threadStore, syncOnSubscribe: false });
    const onSubscriptionsChanged = vi.fn();
    processor.onSubscriptionsChanged(onSubscriptionsChanged);

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
    ).resolves.toMatchObject({ subscribed: true, owner: 'mastra-ai', repo: 'mastra', number: 123 });
    let savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123, lastSyncStatus: 'skipped' }),
    ]);
    expect(onSubscriptionsChanged).toHaveBeenLastCalledWith({
      threadId: thread.id,
      resourceId: thread.resourceId,
      subscriptions: [expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123 })],
    });

    await expect(
      tools.github_subscribe_pr.execute(
        { owner: 'mastra-ai', repo: 'mastra', number: 456 },
        { agent: { agentId: 'code-agent', threadId: thread.id, resourceId: thread.resourceId } },
      ),
    ).resolves.toMatchObject({ subscribed: true, owner: 'mastra-ai', repo: 'mastra', number: 456 });
    savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 456, lastSyncStatus: 'skipped' }),
    ]);
    expect(onSubscriptionsChanged).toHaveBeenLastCalledWith({
      threadId: thread.id,
      resourceId: thread.resourceId,
      subscriptions: [expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 456 })],
    });

    await expect(
      tools.github_unsubscribe_pr.execute(
        { owner: 'mastra-ai', repo: 'mastra', number: 456 },
        { agent: { agentId: 'code-agent', threadId: thread.id, resourceId: thread.resourceId } },
      ),
    ).resolves.toMatchObject({ unsubscribed: true, owner: 'mastra-ai', repo: 'mastra', number: 456 });
    savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([]);
    expect(onSubscriptionsChanged).toHaveBeenLastCalledWith({
      threadId: thread.id,
      resourceId: thread.resourceId,
      subscriptions: [],
    });
    processor.stopAllPolling();
  });

  it('syncs subscribed PRs immediately on request', async () => {
    const thread: StorageThreadType = {
      id: 'thread-sync-now',
      resourceId: 'resource-sync-now',
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
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Add GitHub signals',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:05:00.000Z',
        contentHash: 'sync-now-hash',
        latestCommentAuthor: 'contributor',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const permissionResolver = { getPermission: vi.fn(async () => 'write' as const) };
    const processor = new GithubSignals({ threadStore, syncClient, permissionResolver });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await expect(processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(1);

    expect(syncClient.syncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          source: 'github',
          kind: 'pull-request-activity',
          summary: 'mastra-ai/mastra#123 has new activity: Add GitHub signals',
        }),
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions[0]).toMatchObject({
      lastSyncStatus: 'success',
      lastObservedContentHash: 'sync-now-hash',
    });
  });

  it('surfaces snapshot read failures on the subscription and clears them after recovery', async () => {
    const thread: StorageThreadType = {
      id: 'thread-snapshot-error',
      resourceId: 'resource-snapshot-error',
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
    let snapshotCalls = 0;
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          throw new Error('gitcrawl database query failed (db: /missing/gitcrawl.db): unable to open database file');
        }
        return {
          title: 'Add GitHub signals',
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:05:00.000Z',
          contentHash: 'recovered-hash',
          latestCommentAuthor: 'contributor',
        };
      }),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const permissionResolver = { getPermission: vi.fn(async () => 'write' as const) };
    const processor = new GithubSignals({ threadStore, syncClient, permissionResolver });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    // First sync: the snapshot read fails, so the failure must be recorded on
    // the subscription instead of silently reporting a healthy poll.
    await expect(processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(1);
    expect(sendNotificationSignal).not.toHaveBeenCalled();
    const failedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [failedSubscription] = (failedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(failedSubscription).toMatchObject({
      lastSyncStatus: 'success',
      lastSnapshotError: 'gitcrawl database query failed (db: /missing/gitcrawl.db): unable to open database file',
    });
    expect(failedSubscription.lastObservedContentHash).toBeUndefined();

    // Second sync: the snapshot read recovers, the error clears, and the
    // baseline observation notifies as usual.
    await expect(processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(1);
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    const recoveredThread = vi.mocked(threadStore.saveThread).mock.calls[1]![0].thread;
    const [recoveredSubscription] = (recoveredThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY]
      .subscriptions;
    expect(recoveredSubscription.lastSnapshotError).toBeUndefined();
    expect(recoveredSubscription).toMatchObject({
      lastSyncStatus: 'success',
      lastObservedContentHash: 'recovered-hash',
    });
  });

  it('expires cached author permissions and reloads them after the TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const thread: StorageThreadType = {
      id: 'thread-permission-cache-ttl',
      resourceId: 'resource-permission-cache-ttl',
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
    let snapshotIndex = 0;
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => {
        snapshotIndex += 1;
        return {
          title: 'Add GitHub signals',
          state: 'open',
          githubUpdatedAt: `2026-01-01T00:0${snapshotIndex}:00.000Z`,
          contentHash: `cache-ttl-hash-${snapshotIndex}`,
          latestCommentAuthor: 'contributor',
        };
      }),
    };
    const permissionResolver = { getPermission: vi.fn(async () => 'write' as const) };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient, permissionResolver });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    await processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(permissionResolver.getPermission).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-01-01T00:05:01.000Z'));
    await processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(permissionResolver.getPermission).toHaveBeenCalledTimes(2);
  });

  it('does not cache transient author permission lookup failures', async () => {
    const thread: StorageThreadType = {
      id: 'thread-permission-cache-failure',
      resourceId: 'resource-permission-cache-failure',
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
    let snapshotIndex = 0;
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => {
        snapshotIndex += 1;
        return {
          title: 'Add GitHub signals',
          state: 'open',
          githubUpdatedAt: `2026-01-01T00:0${snapshotIndex}:00.000Z`,
          contentHash: `cache-failure-hash-${snapshotIndex}`,
          latestCommentAuthor: 'contributor',
        };
      }),
    };
    const permissionResolver = {
      getPermission: vi.fn(async () => {
        if (permissionResolver.getPermission.mock.calls.length === 1) throw new Error('temporary failure');
        return 'write' as const;
      }),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient, permissionResolver });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(sendNotificationSignal).not.toHaveBeenCalled();

    await processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(permissionResolver.getPermission).toHaveBeenCalledTimes(2);
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
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
            subscriptionHintShown: true,
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
                lastObservedThreadContentHash: 'old-thread-hash',
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
        threadContentHash: 'new-thread-hash',
        latestCommentAuthor: 'contributor',
      })),
    };
    const permissionResolver = { getPermission: vi.fn(async () => 'write' as const) };
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      pollIntervalMs: 1_000,
      agentId: 'code-agent',
      permissionResolver,
    });
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })) } as any);
    const onPollingChanged = vi.fn();
    processor.onPollingChanged(onPollingChanged);

    await expect(processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(
      true,
    );
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(syncClient.syncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123 }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const savedGithubMetadata = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY];
    expect(savedGithubMetadata.subscriptionHintShown).toBe(true);
    const [subscription] = savedGithubMetadata.subscriptions;
    expect(subscription).toMatchObject({
      lastSyncStatus: 'success',
      lastObservedGithubUpdatedAt: '2026-01-01T00:05:00.000Z',
      lastObservedContentHash: 'new-hash',
      lastObservedThreadContentHash: 'new-thread-hash',
      lastNotificationKind: 'pull-request-activity',
      lastNotificationPriority: 'medium',
      lastNotificationSummary: 'mastra-ai/mastra#123 has new activity: Add GitHub signals',
    });
    expect(subscription.lastNotificationAt).toEqual(expect.any(String));
    expect(subscription.lastSyncError).toBeUndefined();
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
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
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    expect(syncClient.syncPullRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123, includeComments: true }),
    );
    expect(onPollingChanged.mock.calls.map(([event]) => event)).toEqual([
      { threadId: thread.id, resourceId: thread.resourceId, running: true },
      { threadId: thread.id, resourceId: thread.resourceId, running: false },
    ]);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(syncClient.syncPullRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ owner: 'mastra-ai', repo: 'mastra', number: 123, includeComments: true }),
    );
    expect(onPollingChanged.mock.calls.map(([event]) => event)).toEqual([
      { threadId: thread.id, resourceId: thread.resourceId, running: true },
      { threadId: thread.id, resourceId: thread.resourceId, running: false },
      { threadId: thread.id, resourceId: thread.resourceId, running: true },
      { threadId: thread.id, resourceId: thread.resourceId, running: false },
    ]);
    processor.stopAllPolling();
  });

  it('updates the GitHub cursor without notifying when only githubUpdatedAt changes', async () => {
    const thread: StorageThreadType = {
      id: 'thread-timestamp-only',
      resourceId: 'resource-timestamp-only',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 17447,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-06-03T03:51:10.000Z',
                lastObservedContentHash: 'same-semantic-hash',
                lastObservedState: 'open',
                lastObservedMergeableState: 'unstable',
                lastObservedCiState: 'pending',
                lastObservedReviewStateHash: 'reviews-0',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(
        async () =>
          ({
            title: '07 feat(mastracode): add GitHub signal subscriptions',
            state: 'open',
            githubUpdatedAt: '2026-06-03T04:02:44.000Z',
            contentHash: 'same-semantic-hash',
            ciState: 'pending',
            mergeableState: 'unstable',
            unresolvedReviewThreads: 0,
            reviewStateHash: 'reviews-0',
            checks: [{ name: 'changed-tests', status: 'queued', conclusion: undefined }],
          }) satisfies GithubPullRequestSnapshot,
      ),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastObservedGithubUpdatedAt: '2026-06-03T04:02:44.000Z',
      lastObservedContentHash: 'same-semantic-hash',
      lastObservedMergeableState: 'unstable',
      lastObservedCiState: 'pending',
      lastObservedReviewStateHash: 'reviews-0',
    });
    expect(subscription.lastNotificationKind).toBeUndefined();
  });

  it('notifies when the latest comment changes even if the thread content hash does not', async () => {
    const thread: StorageThreadType = {
      id: 'thread-comment-timestamp',
      resourceId: 'resource-comment-timestamp',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 17590,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-06-05T19:43:21.000Z',
                lastObservedContentHash: 'same-content-hash',
                lastObservedThreadContentHash: 'same-thread-hash',
                lastObservedHeadSha: 'same-head-sha',
                lastObservedState: 'open',
                lastObservedMergeableState: 'blocked',
                lastObservedCiState: 'success',
                lastObservedReviewStateHash: 'reviews-0',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(
        async () =>
          ({
            title: 'fix(github-signals): gate notifications behind author permission checks',
            state: 'open',
            githubUpdatedAt: '2026-06-05T21:28:12.000Z',
            contentHash: 'same-content-hash',
            threadContentHash: 'same-thread-hash',
            headSha: 'same-head-sha',
            ciState: 'success',
            mergeableState: 'blocked',
            unresolvedReviewThreads: 0,
            reviewStateHash: 'reviews-0',
            latestCommentAuthor: 'devin-ai-integration[bot]',
            latestCommentAuthorType: 'Bot',
            latestCommentIsBot: true,
            latestCommentBody:
              'Acknowledged! Fourth test comment received. Rendered GitHub comment notifications with author and excerpt are working.',
            latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-4635660157',
            latestCommentUpdatedAt: '2026-06-05T21:28:12.000Z',
          }) satisfies GithubPullRequestSnapshot,
      ),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-activity',
          priority: 'high',
          summary:
            'devin-ai-integration[bot] commented on mastra-ai/mastra#17590: Acknowledged! Fourth test comment received. Rendered GitHub comment notifications with author and excerpt are working.',
          dedupeKey:
            'github:mastra-ai/mastra#17590:comment:https://github.com/mastra-ai/mastra/pull/17590#issuecomment-4635660157:2026-06-05T21:28:12.000Z',
        }),
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastObservedGithubUpdatedAt: '2026-06-05T21:28:12.000Z',
      lastObservedContentHash: 'same-content-hash',
      lastObservedThreadContentHash: 'same-thread-hash',
      lastObservedHeadSha: 'same-head-sha',
      lastNotificationKind: 'pull-request-activity',
      lastNotificationPriority: 'high',
      lastNotificationSummary:
        'devin-ai-integration[bot] commented on mastra-ai/mastra#17590: Acknowledged! Fourth test comment received. Rendered GitHub comment notifications with author and excerpt are working.',
    });
  });

  it('uses the latest authorized comment when a newer unauthorized bot comment exists', async () => {
    const thread: StorageThreadType = {
      id: 'thread-authorized-comment-fallback',
      resourceId: 'resource-authorized-comment-fallback',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 17590,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-06-05T22:00:00.000Z',
                lastObservedContentHash: 'same-content-hash',
                lastObservedThreadContentHash: 'same-thread-hash',
                lastObservedHeadSha: 'same-head-sha',
                lastObservedState: 'open',
                lastObservedMergeableState: 'blocked',
                lastObservedCiState: 'success',
                lastObservedReviewStateHash: 'reviews-0',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(
        async () =>
          ({
            title: 'fix(github-signals): gate notifications behind author permission checks',
            state: 'open',
            githubUpdatedAt: '2026-06-05T22:06:00.000Z',
            contentHash: 'same-content-hash',
            threadContentHash: 'same-thread-hash',
            headSha: 'same-head-sha',
            ciState: 'success',
            mergeableState: 'blocked',
            unresolvedReviewThreads: 0,
            reviewStateHash: 'reviews-0',
            latestCommentAuthor: 'vercel[bot]',
            latestCommentAuthorType: 'Bot',
            latestCommentIsBot: true,
            latestCommentBody: '[vc]: deployment status payload',
            latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-vercel',
            latestCommentUpdatedAt: '2026-06-05T22:06:00.000Z',
            latestComments: [
              {
                author: 'vercel[bot]',
                authorType: 'Bot',
                isBot: true,
                body: '[vc]: deployment status payload',
                url: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-vercel',
                updatedAt: '2026-06-05T22:06:00.000Z',
              },
              {
                author: 'devin-ai-integration',
                authorType: 'Bot',
                isBot: true,
                body: 'Acknowledged! The authorized comment should still be delivered.',
                url: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-devin',
                updatedAt: '2026-06-05T22:05:00.000Z',
              },
            ],
          }) satisfies GithubPullRequestSnapshot,
      ),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const permissionResolver = { getPermission: vi.fn(async () => 'none' as const) };
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      permissionResolver,
      authorizedBots: ['devin-ai-integration'],
    });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-activity',
          priority: 'high',
          summary:
            'devin-ai-integration commented on mastra-ai/mastra#17590: Acknowledged! The authorized comment should still be delivered.',
          dedupeKey:
            'github:mastra-ai/mastra#17590:comment:https://github.com/mastra-ai/mastra/pull/17590#issuecomment-devin:2026-06-05T22:05:00.000Z',
          attributes: expect.objectContaining({
            latestCommentAuthor: 'devin-ai-integration',
            latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-devin',
            latestCommentUpdatedAt: '2026-06-05T22:05:00.000Z',
          }),
          metadata: expect.objectContaining({
            github: expect.objectContaining({
              latestCommentAuthor: 'devin-ai-integration',
              // Full comment body is no longer persisted in notification metadata; only the excerpt.
              latestCommentExcerpt: 'Acknowledged! The authorized comment should still be delivered.',
              latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-devin',
              latestCommentUpdatedAt: '2026-06-05T22:05:00.000Z',
            }),
          }),
        }),
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastObservedGithubUpdatedAt: '2026-06-05T22:06:00.000Z',
      lastNotificationKind: 'pull-request-activity',
      lastNotificationPriority: 'high',
    });
    expect(permissionResolver.getPermission).not.toHaveBeenCalled();
  });

  it('emits separate notifications when a new comment and CI state change in the same poll', async () => {
    const thread: StorageThreadType = {
      id: 'thread-comment-and-ci',
      resourceId: 'resource-comment-and-ci',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 17590,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-06-05T22:05:20.000Z',
                lastObservedContentHash: 'previous-content-hash',
                lastObservedThreadContentHash: 'previous-thread-hash',
                lastObservedHeadSha: 'same-head-sha',
                lastObservedState: 'open',
                lastObservedMergeableState: 'blocked',
                lastObservedCiState: 'success',
                lastObservedReviewStateHash: 'reviews-0',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(
        async () =>
          ({
            title: 'fix(github-signals): gate notifications behind author permission checks',
            state: 'open',
            githubUpdatedAt: '2026-06-05T22:13:47.000Z',
            contentHash: 'new-content-hash',
            threadContentHash: 'new-thread-hash',
            headSha: 'same-head-sha',
            ciState: 'failure',
            mergeableState: 'blocked',
            unresolvedReviewThreads: 0,
            reviewStateHash: 'reviews-0',
            checks: [
              {
                name: 'Lint',
                status: 'completed',
                conclusion: 'failure',
                updatedAt: '2026-06-05T22:13:47.000Z',
              },
            ],
            latestCommentAuthor: 'devin-ai-integration[bot]',
            latestCommentAuthorType: 'Bot',
            latestCommentIsBot: true,
            latestCommentBody: 'Nice follow-up! Thanks for the summary — those are solid improvements.',
            latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/17590#issuecomment-4635974623',
            latestCommentUpdatedAt: '2026-06-05T22:11:28.000Z',
          }) satisfies GithubPullRequestSnapshot,
      ),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-activity',
          priority: 'high',
          summary:
            'devin-ai-integration[bot] commented on mastra-ai/mastra#17590: Nice follow-up! Thanks for the summary — those are solid improvements.',
          dedupeKey:
            'github:mastra-ai/mastra#17590:comment:https://github.com/mastra-ai/mastra/pull/17590#issuecomment-4635974623:2026-06-05T22:11:28.000Z',
        }),
        expect.objectContaining({
          kind: 'pull-request-ci-failure',
          summary: 'mastra-ai/mastra#17590 has failing CI: Lint',
        }),
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastObservedGithubUpdatedAt: '2026-06-05T22:13:47.000Z',
      lastObservedCiState: 'failure',
      lastNotificationKind: 'pull-request-activity',
      lastNotificationPriority: 'high',
      lastNotificationSummary:
        'devin-ai-integration[bot] commented on mastra-ai/mastra#17590: Nice follow-up! Thanks for the summary — those are solid improvements.',
    });
  });

  it('updates the GitHub cursor without notifying when only pending check details change', async () => {
    const thread: StorageThreadType = {
      id: 'thread-check-churn',
      resourceId: 'resource-check-churn',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 17447,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
                lastObservedGithubUpdatedAt: '2026-06-03T05:06:31.000Z',
                lastObservedContentHash: 'old-check-hash',
                lastObservedState: 'open',
                lastObservedMergeableState: 'unstable',
                lastObservedCiState: 'pending',
                lastObservedReviewStateHash: 'reviews-0',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(
        async () =>
          ({
            title: '07 feat(mastracode): add GitHub signal subscriptions',
            state: 'open',
            githubUpdatedAt: '2026-06-03T05:11:30.000Z',
            contentHash: 'new-check-hash',
            threadContentHash: 'same-thread-hash',
            headSha: 'same-head-sha',
            ciState: 'pending',
            mergeableState: 'unstable',
            unresolvedReviewThreads: 0,
            reviewStateHash: 'reviews-0',
            checks: [{ name: 'changed-tests', status: 'queued', conclusion: undefined }],
          }) satisfies GithubPullRequestSnapshot,
      ),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription).toMatchObject({
      lastObservedGithubUpdatedAt: '2026-06-03T05:11:30.000Z',
      lastObservedContentHash: 'new-check-hash',
      lastObservedThreadContentHash: 'same-thread-hash',
      lastObservedHeadSha: 'same-head-sha',
      lastObservedCiState: 'pending',
    });
    expect(subscription.lastNotificationKind).toBeUndefined();
  });

  it('includes comments on every scheduled PR poll', async () => {
    vi.useFakeTimers();
    const thread: StorageThreadType = {
      id: 'thread-comment-refresh',
      resourceId: 'resource-comment-refresh',
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
                lastObservedContentHash: 'old-hash',
                lastObservedThreadContentHash: 'old-thread-hash',
                lastObservedHeadSha: 'head-sha',
                lastObservedState: 'open',
                lastObservedMergeableState: 'unstable',
                lastObservedCiState: 'success',
                lastObservedReviewStateHash: 'reviews-0',
              },
            ],
          },
        },
      },
    };
    let snapshotCount = 0;
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => {
        snapshotCount += 1;
        if (snapshotCount === 1) {
          return {
            title: 'Add GitHub signals',
            state: 'open',
            githubUpdatedAt: '2026-01-01T00:00:00.000Z',
            contentHash: 'old-hash',
            threadContentHash: 'old-thread-hash',
            headSha: 'head-sha',
            mergeableState: 'unstable',
            ciState: 'success' as const,
            reviewStateHash: 'reviews-0',
            latestCommentAuthor: 'previous-author',
          };
        }
        return {
          title: 'Add GitHub signals',
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:05:00.000Z',
          contentHash: 'new-hash',
          threadContentHash: 'new-thread-hash',
          headSha: 'head-sha',
          mergeableState: 'unstable',
          ciState: 'success' as const,
          reviewStateHash: 'reviews-0',
          latestCommentAuthor: 'devin-ai-integration[bot]',
          latestCommentAuthorType: 'Bot',
          latestCommentIsBot: true,
          latestCommentBody:
            'Acknowledged! Third test comment received. Bot notification delivery is working after the rebuild/reload.',
          latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/123#issuecomment-1',
          latestCommentUpdatedAt: '2026-01-01T00:05:00.000Z',
        };
      }),
    };
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient, pollIntervalMs: 1_000 });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    await processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendNotificationSignal).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(syncClient.syncPullRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({ includeComments: true }));
    expect(syncClient.syncPullRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({ includeComments: true }));
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          source: 'github',
          kind: 'pull-request-activity',
          priority: 'high',
          summary:
            'devin-ai-integration[bot] commented on mastra-ai/mastra#123: Acknowledged! Third test comment received. Bot notification delivery is working after the rebuild/reload.',
          attributes: expect.objectContaining({
            latestCommentAuthor: 'devin-ai-integration[bot]',
            latestCommentExcerpt:
              'Acknowledged! Third test comment received. Bot notification delivery is working after the rebuild/reload.',
            latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/123#issuecomment-1',
            latestCommentUpdatedAt: '2026-01-01T00:05:00.000Z',
          }),
          metadata: expect.objectContaining({
            github: expect.objectContaining({
              latestCommentAuthor: 'devin-ai-integration[bot]',
              // Full comment body is no longer persisted in notification metadata; only the excerpt.
              latestCommentExcerpt:
                'Acknowledged! Third test comment received. Bot notification delivery is working after the rebuild/reload.',
              latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/123#issuecomment-1',
              latestCommentUpdatedAt: '2026-01-01T00:05:00.000Z',
            }),
          }),
        }),
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription.lastObservedGithubUpdatedAt).toBe('2026-01-01T00:05:00.000Z');
    processor.stopAllPolling();
  });

  it('sends GitHub notifications through the registered agent with polling target stream options', async () => {
    const thread: StorageThreadType = {
      id: 'thread-sender',
      resourceId: 'resource-sender',
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
                lastObservedContentHash: 'old-hash',
              },
            ],
          },
        },
      },
    };
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Add GitHub signals',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:05:00.000Z',
        contentHash: 'new-hash',
        latestCommentAuthor: 'contributor',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const permissionResolver = { getPermission: vi.fn(async () => 'write' as const) };
    const processor = new GithubSignals({
      threadStore: createThreadStore(thread),
      syncClient,
      permissionResolver,
    });
    processor.addAgent(
      { sendSignal: vi.fn(), sendNotificationSignal },
      {
        getNotificationStreamOptions: async target => ({
          memory: { resource: target.resourceId, thread: target.threadId },
        }),
      },
    );

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          source: 'github',
          kind: 'pull-request-activity',
          coalesceKey: 'github:mastra-ai/mastra#123:pull-request-activity',
        }),
      ],
      expect.objectContaining({
        resourceId: thread.resourceId,
        threadId: thread.id,
        ifIdle: { streamOptions: { memory: { resource: thread.resourceId, thread: thread.id } } },
      }),
    );
  });

  it('only keeps one active polling thread at a time', async () => {
    vi.useFakeTimers();
    const firstThread: StorageThreadType = {
      id: 'thread-one',
      resourceId: 'resource-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 1,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-1',
              },
            ],
          },
        },
      },
    };
    const secondThread: StorageThreadType = {
      id: 'thread-two',
      resourceId: 'resource-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 2,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-2',
              },
            ],
          },
        },
      },
    };
    const threads = new Map([
      [firstThread.id, firstThread],
      [secondThread.id, secondThread],
    ]);
    const threadStore: GithubSignalsThreadStore = {
      getThreadById: vi.fn(async ({ threadId }: { threadId: string }) => threads.get(threadId) ?? null),
      saveThread: vi.fn(async ({ thread }: { thread: StorageThreadType }) => thread),
    };
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({ githubUpdatedAt: '2026-01-01T00:00:00.000Z' })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, pollIntervalMs: 1_000 });

    await expect(
      processor.startPollingForThread({ threadId: firstThread.id, resourceId: firstThread.resourceId }),
    ).resolves.toBe(true);
    expect(processor.isPollingThread({ threadId: firstThread.id, resourceId: firstThread.resourceId })).toBe(true);

    await expect(
      processor.startPollingForThread({ threadId: secondThread.id, resourceId: secondThread.resourceId }),
    ).resolves.toBe(true);

    expect(processor.isPollingThread({ threadId: firstThread.id, resourceId: firstThread.resourceId })).toBe(false);
    expect(processor.isPollingThread({ threadId: secondThread.id, resourceId: secondThread.resourceId })).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(syncClient.syncPullRequest).toHaveBeenCalledTimes(1);
    expect(syncClient.syncPullRequest).toHaveBeenCalledWith(expect.objectContaining({ number: 2 }));
    processor.stopAllPolling();
  });

  it('emits a high-priority notification when a legacy subscribed PR is first observed as merged', async () => {
    const thread: StorageThreadType = {
      id: 'thread-merged',
      resourceId: 'resource-merged',
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
        title: 'Fix duplicate reasoning IDs',
        state: 'merged',
        mergedAt: '2026-06-02T18:42:32Z',
        githubUpdatedAt: '2026-06-02T18:43:57Z',
        contentHash: 'merged-hash',
        ciState: 'success' as const,
      })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })) } as any);

    await expect(processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(0);

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([]);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          source: 'github',
          kind: 'pull-request-merged',
          priority: 'high',
          summary:
            'mastra-ai/mastra#123: Fix duplicate reasoning IDs was merged. This thread has been automatically unsubscribed from this PR. Resubscribe if you still need updates.',
          attributes: expect.objectContaining({
            state: 'merged',
          }),
          metadata: expect.objectContaining({
            github: expect.objectContaining({ mergedAt: '2026-06-02T18:42:32Z' }),
          }),
        }),
      ],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
  });

  it('stops polling after a merged PR was the only subscription', async () => {
    vi.useFakeTimers();
    const thread: StorageThreadType = {
      id: 'thread-merged-polling',
      resourceId: 'resource-merged-polling',
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
        title: 'Fix duplicate reasoning IDs',
        state: 'merged',
        mergedAt: '2026-06-02T18:42:32Z',
        githubUpdatedAt: '2026-06-02T18:43:57Z',
        contentHash: 'merged-hash',
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

    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(false);
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    expect((savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions).toEqual([]);
  });

  it('does not unsubscribe after a closed-unmerged PR notification', async () => {
    const thread: StorageThreadType = {
      id: 'thread-closed',
      resourceId: 'resource-closed',
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
                lastObservedContentHash: 'old-hash',
                lastObservedState: 'open',
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
        title: 'Close stale PR',
        state: 'closed',
        closedAt: '2026-06-02T18:42:32Z',
        githubUpdatedAt: '2026-06-02T18:43:57Z',
        contentHash: 'closed-hash',
      })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    processor.__registerMastra({ getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })) } as any);

    await expect(processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(1);

    const savedThread = vi.mocked(threadStore.saveThread).mock.calls[0]![0].thread;
    const subscriptions = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      number: 123,
      lastObservedState: 'closed',
      lastNotificationKind: 'pull-request-closed',
    });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-closed' })],
      expect.objectContaining({ resourceId: thread.resourceId, threadId: thread.id }),
    );
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
      [
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
      ],
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
    const runPoll = async (
      thread: StorageThreadType,
      snapshot: GithubPullRequestSnapshot,
      opts?: { permissionResolver?: GithubSignalsOptions['permissionResolver'] },
    ) => {
      const threadStore = createThreadStore(thread);
      const syncClient: GithubSignalsSyncClient = {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => snapshot),
      };
      const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
      const permissionResolver = opts?.permissionResolver ?? { getPermission: vi.fn(async () => 'write' as const) };
      const processor = new GithubSignals({
        threadStore,
        syncClient,
        agentId: 'code-agent',
        permissionResolver,
      });
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
      [expect.objectContaining({ kind: 'pull-request-ci-recovered', priority: 'medium' })],
      expect.anything(),
    );
    const conflictBeatsRecovery = await runPoll(
      createThreadWithCursor({ lastObservedCiState: 'pending', lastObservedMergeableState: 'unknown' }),
      {
        title: 'PR',
        state: 'open',
        contentHash: 'dirty-ci-ok',
        ciState: 'success',
        mergeableState: 'dirty',
      },
    );
    expect(conflictBeatsRecovery).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-conflict', priority: 'high' })],
      expect.anything(),
    );
    const dirtySuppressesCiPending = await runPoll(
      createThreadWithCursor({ lastObservedCiState: 'success', lastObservedMergeableState: 'dirty' }),
      {
        title: 'PR',
        state: 'open',
        contentHash: 'dirty-ci-pending',
        ciState: 'pending',
        mergeableState: 'dirty',
        checks: [
          { name: 'PR Triage', status: 'queued', conclusion: undefined },
          { name: 'summarize', status: 'queued', conclusion: undefined },
        ],
      },
    );
    expect(dirtySuppressesCiPending).not.toHaveBeenCalled();
    const reviewActivity = await runPoll(createThreadWithCursor({ lastObservedReviewStateHash: 'reviews-1' }), {
      title: 'PR',
      state: 'open',
      contentHash: 'reviews-2',
      ciState: 'unknown',
      unresolvedReviewThreads: 2,
      reviewStateHash: 'reviews-2',
      latestCommentAuthor: 'reviewer',
    });
    expect(reviewActivity).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-review-activity', priority: 'medium' })],
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
      [expect.objectContaining({ kind: 'pull-request-conflict-resolved', priority: 'medium' })],
      expect.anything(),
    );
    const merged = await runPoll(createThreadWithCursor({ lastObservedState: 'open' }), {
      title: 'PR',
      state: 'merged',
      contentHash: 'merged',
      ciState: 'success',
    });
    expect(merged).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-merged', priority: 'high' })],
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

  it('suppresses activity notifications from unauthorized commenters', async () => {
    const baseThread: StorageThreadType = {
      id: 'thread-perm',
      resourceId: 'resource-perm',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 42,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-perm',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
                lastObservedThreadContentHash: 'old-thread-hash',
              },
            ],
          },
        },
      },
    };
    const snapshot: GithubPullRequestSnapshot = {
      title: 'Test PR',
      state: 'open',
      contentHash: 'new-hash',
      threadContentHash: 'new-thread-hash',
      ciState: 'unknown',
      latestCommentAuthor: 'random-user',
    };

    const readPermission = { getPermission: vi.fn(async () => 'read' as const) };
    const threadStore = createThreadStore(baseThread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => snapshot),
    };
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      agentId: 'code-agent',
      permissionResolver: readPermission,
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);
    await processor.pollThreadNow({ threadId: baseThread.id, resourceId: baseThread.resourceId });
    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(readPermission.getPermission).toHaveBeenCalledWith('mastra-ai', 'mastra', 'random-user');
  });

  it('allows activity notifications from authorized commenters', async () => {
    const baseThread: StorageThreadType = {
      id: 'thread-perm-ok',
      resourceId: 'resource-perm-ok',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 42,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-perm-ok',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
                lastObservedThreadContentHash: 'old-thread-hash',
              },
            ],
          },
        },
      },
    };
    const snapshot: GithubPullRequestSnapshot = {
      title: 'Test PR',
      state: 'open',
      contentHash: 'new-hash',
      threadContentHash: 'new-thread-hash',
      ciState: 'unknown',
      latestCommentAuthor: 'maintainer',
    };

    const writePermission = { getPermission: vi.fn(async () => 'write' as const) };
    const threadStore = createThreadStore(baseThread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => snapshot),
    };
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      agentId: 'code-agent',
      permissionResolver: writePermission,
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);
    await processor.pollThreadNow({ threadId: baseThread.id, resourceId: baseThread.resourceId });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-activity' })],
      expect.anything(),
    );
  });

  it('allows configured bot notifications and blocks unlisted or ignored bots', async () => {
    const baseThread: StorageThreadType = {
      id: 'thread-bot',
      resourceId: 'resource-bot',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 42,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-bot',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
                lastObservedThreadContentHash: 'old-thread-hash',
              },
            ],
          },
        },
      },
    };

    // Allowed bot (not in ignoredBots list) — should notify
    const allowedBotSnapshot: GithubPullRequestSnapshot = {
      title: 'Test PR',
      state: 'open',
      contentHash: 'coderabbit-hash',
      threadContentHash: 'new-thread-hash',
      ciState: 'success',
      latestCommentAuthor: 'coderabbitai[bot]',
      latestCommentIsBot: true,
    };
    const allowedThreadStore = createThreadStore(baseThread);
    const allowedSyncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => allowedBotSnapshot),
    };
    const allowedNotify = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const allowedProcessor = new GithubSignals({
      threadStore: allowedThreadStore,
      syncClient: allowedSyncClient,
      agentId: 'code-agent',
      permissionResolver: { getPermission: vi.fn(async () => 'read' as const) },
    });
    allowedProcessor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal: allowedNotify })),
    } as any);
    await allowedProcessor.pollThreadNow({ threadId: baseThread.id, resourceId: baseThread.resourceId });
    expect(allowedNotify).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-activity' })],
      expect.anything(),
    );

    // Unlisted bot — should NOT notify
    const unlistedBotSnapshot: GithubPullRequestSnapshot = {
      title: 'Test PR',
      state: 'open',
      contentHash: 'vercel-hash',
      threadContentHash: 'vercel-thread-hash',
      ciState: 'success',
      latestCommentAuthor: 'vercel[bot]',
      latestCommentIsBot: true,
    };
    const unlistedThreadStore = createThreadStore({ ...baseThread, id: 'thread-bot-unlisted' });
    const unlistedSyncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => unlistedBotSnapshot),
    };
    const unlistedNotify = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const unlistedProcessor = new GithubSignals({
      threadStore: unlistedThreadStore,
      syncClient: unlistedSyncClient,
      agentId: 'code-agent',
      permissionResolver: { getPermission: vi.fn(async () => 'read' as const) },
    });
    unlistedProcessor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal: unlistedNotify })),
    } as any);
    await unlistedProcessor.pollThreadNow({ threadId: 'thread-bot-unlisted', resourceId: baseThread.resourceId });
    expect(unlistedNotify).not.toHaveBeenCalled();

    // Ignored bot — should NOT notify even when authorized
    const ignoredBotSnapshot: GithubPullRequestSnapshot = {
      title: 'Test PR',
      state: 'open',
      contentHash: 'renovate-hash',
      threadContentHash: 'renovate-thread-hash',
      ciState: 'success',
      latestCommentAuthor: 'renovate[bot]',
      latestCommentIsBot: true,
    };
    const ignoredThreadStore = createThreadStore({ ...baseThread, id: 'thread-bot-ignored' });
    const ignoredSyncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ignoredBotSnapshot),
    };
    const ignoredNotify = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const ignoredProcessor = new GithubSignals({
      threadStore: ignoredThreadStore,
      syncClient: ignoredSyncClient,
      agentId: 'code-agent',
      authorizedBots: ['renovate[bot]'],
      ignoredBots: ['renovate[bot]'],
      permissionResolver: { getPermission: vi.fn(async () => 'read' as const) },
    });
    ignoredProcessor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal: ignoredNotify })),
    } as any);
    await ignoredProcessor.pollThreadNow({ threadId: 'thread-bot-ignored', resourceId: baseThread.resourceId });
    expect(ignoredNotify).not.toHaveBeenCalled();
  });

  it('always sends CI and state-change notifications regardless of author permission', async () => {
    const baseThread: StorageThreadType = {
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
                number: 42,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-ci',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
                lastObservedCiState: 'success',
              },
            ],
          },
        },
      },
    };
    const ciFailSnapshot: GithubPullRequestSnapshot = {
      title: 'Test PR',
      state: 'open',
      contentHash: 'ci-fail-hash',
      ciState: 'failure',
      checks: [{ name: 'build', status: 'completed', conclusion: 'failure' }],
      latestCommentAuthor: 'vercel[bot]',
      latestCommentIsBot: true,
      latestCommentBody: '[vc]: deployment status payload',
      latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/42#issuecomment-vercel',
      latestCommentUpdatedAt: '2026-01-01T00:01:00.000Z',
    };
    // Vercel is not in the default bot allowlist, but CI notifications should still fire
    const noPermission = { getPermission: vi.fn(async () => 'none' as const) };
    const threadStore = createThreadStore(baseThread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ciFailSnapshot),
    };
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      agentId: 'code-agent',
      permissionResolver: noPermission,
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);
    await processor.pollThreadNow({ threadId: baseThread.id, resourceId: baseThread.resourceId });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-ci-failure',
          priority: 'high',
          attributes: expect.not.objectContaining({
            latestCommentAuthor: expect.any(String),
            latestCommentExcerpt: expect.any(String),
            latestCommentUrl: expect.any(String),
          }),
          metadata: expect.objectContaining({
            github: expect.not.objectContaining({
              latestCommentAuthor: expect.any(String),
              latestCommentBody: expect.any(String),
              latestCommentUrl: expect.any(String),
            }),
          }),
        }),
      ],
      expect.anything(),
    );
  });

  describe('sanitizeCommentText', () => {
    it('removes large HTML-comment state blobs while keeping human-readable text', () => {
      const body = [
        'Nice work on the refactor!',
        '',
        '<!-- internal state start',
        'eyJzdGF0ZSI6ImxhcmdlLWJhc2U2NC1ibG9iLXRoYXQtaXMtaHVnZSJ9',
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        'internal state end -->',
      ].join('\n');
      const sanitized = sanitizeCommentText(body);
      expect(sanitized).toContain('Nice work on the refactor!');
      expect(sanitized).not.toContain('internal state');
      expect(sanitized).not.toContain('eyJzdGF0ZSI');
    });

    it('removes <details> blocks including their collapsed inner content', () => {
      const body = [
        'Top-level walkthrough.',
        '<details open>',
        '<summary>Walkthrough</summary>',
        'collapsed detail content',
        '</details>',
        'After the section.',
      ].join('\n');
      const sanitized = sanitizeCommentText(body);
      expect(sanitized).toContain('Top-level walkthrough.');
      expect(sanitized).toContain('After the section.');
      // The collapsed block content is dropped, not just its tags.
      expect(sanitized).not.toContain('collapsed detail content');
      expect(sanitized).not.toContain('Walkthrough');
      expect(sanitized).not.toContain('<details');
      expect(sanitized).not.toContain('<summary');
    });

    it('strips standalone tags while keeping surrounding prose', () => {
      const body = 'Looks good.<br/> Ship it.';
      const sanitized = sanitizeCommentText(body);
      expect(sanitized).toContain('Looks good.');
      expect(sanitized).toContain('Ship it.');
      expect(sanitized).not.toContain('<br');
    });

    it('removes an unterminated comment and its payload through end-of-string', () => {
      const body = 'before <!-- large-hidden-state-payload-with-no-closing-marker';
      const sanitized = sanitizeCommentText(body);
      expect(sanitized).toContain('before');
      expect(sanitized).not.toContain('<!--');
      expect(sanitized).not.toContain('large-hidden-state');
    });

    it('leaves no stray < behind so no partial markup can survive', () => {
      const sanitized = sanitizeCommentText('before <unterminated tag payload');
      expect(sanitized).toContain('before');
      expect(sanitized).not.toContain('<');
    });

    it('handles adversarial repeated comment openers without catastrophic backtracking', () => {
      const body = `${'<!-- internal state start -->'.repeat(5000)}tail`;
      const start = Date.now();
      const sanitized = sanitizeCommentText(body);
      expect(Date.now() - start).toBeLessThan(1000);
      expect(sanitized).toContain('tail');
      expect(sanitized).not.toContain('<!--');
    });

    it('handles adversarial leading <!--- repetitions without catastrophic backtracking', () => {
      const body = `${'<!---'.repeat(20000)}tail`;
      const start = Date.now();
      const sanitized = sanitizeCommentText(body);
      expect(Date.now() - start).toBeLessThan(1000);
      expect(sanitized).not.toContain('<!--');
    });

    it('leaves an ordinary comment untouched aside from whitespace normalization', () => {
      const body = 'Thanks for the fix — looks good to me.';
      expect(sanitizeCommentText(body)).toBe(body);
    });

    it('preserves angle-bracket code inside an inline code span', () => {
      const sanitized = sanitizeCommentText('Use `<Component>` here');
      expect(sanitized).toBe('Use `<Component>` here');
    });

    it('preserves JSX/TSX inside fenced code blocks while stripping markup outside', () => {
      const body = ['Before <br/> the block.', '```tsx', 'const x = <Component prop="a" />;', '```', 'After.'].join(
        '\n',
      );
      const sanitized = sanitizeCommentText(body);
      expect(sanitized).toContain('const x = <Component prop="a" />;');
      expect(sanitized).toContain('```tsx');
      expect(sanitized).toContain('Before  the block.');
      expect(sanitized).toContain('After.');
      expect(sanitized).not.toContain('<br');
    });

    it('still strips real markup that appears outside code spans', () => {
      const body = 'See `<Component>` but not <details open>secret</details> here.';
      const sanitized = sanitizeCommentText(body);
      expect(sanitized).toContain('`<Component>`');
      expect(sanitized).not.toContain('secret');
      expect(sanitized).not.toContain('<details');
    });

    it('preserves angle-bracket code inside a multi-backtick inline span', () => {
      const sanitized = sanitizeCommentText('Use ``<Component prop="`a`" />`` here');
      expect(sanitized).toBe('Use ``<Component prop="`a`" />`` here');
    });

    it('keeps ordinary prose containing a lone "<" (e.g. comparisons)', () => {
      const sanitized = sanitizeCommentText('coverage < 80% but tests pass');
      expect(sanitized).toBe('coverage  80% but tests pass');
    });

    it('leaves no "<script" or lone "<" in the output even when unterminated', () => {
      const sanitized = sanitizeCommentText('hello <script>alert(1) and a dangling <scr');
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('<');
      expect(sanitized).toContain('hello');
    });

    it('does not collapse blank lines inside a preserved fenced code block', () => {
      const body = ['intro', '```ts', 'const a = 1;', '', '', '', 'const b = 2;', '```'].join('\n');
      const sanitized = sanitizeCommentText(body);
      // The 3+ blank lines inside the fence are restored verbatim, not normalized to one.
      expect(sanitized).toContain('const a = 1;\n\n\n\nconst b = 2;');
    });
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
