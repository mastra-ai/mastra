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
  GithubPRSubscription,
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

function createSubscribedThread(
  id: string,
  subscription: Partial<GithubPRSubscription> & Pick<GithubPRSubscription, 'number'>,
): StorageThreadType {
  return {
    id,
    resourceId: `resource-${id}`,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {
      mastra: {
        [GITHUB_SIGNALS_METADATA_KEY]: {
          subscriptions: [
            {
              owner: 'mastra-ai',
              repo: 'mastra',
              mode: 'working',
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: `signal-${subscription.number}`,
              ...subscription,
            },
          ],
        },
      },
    },
  };
}

function getSavedGithubSubscriptions(threadStore: GithubSignalsThreadStore): GithubPRSubscription[] {
  const savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
  return (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
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
        attributes: { owner: 'mastra-ai', repo: 'mastra', number: 123, mode: 'working' },
        metadata: {
          github: { action: 'subscribeToPR', owner: 'mastra-ai', repo: 'mastra', number: 123, mode: 'working' },
        },
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
        contents: expect.stringMatching(
          /--mode review.*new commits.*authorized latest PR comments.*review-thread-state changes including all threads resolved.*PR close or merge updates.*--mode working.*all actionable PR activity.*Do not subscribe for a one-off inspection\./,
        ),
        attributes: {
          type: 'github-subscription-hint',
          availableModes: 'review,working',
          defaultMode: null,
        },
        metadata: {
          github: {
            action: 'subscriptionHint',
            owner: 'mastra-ai',
            repo: 'mastra',
            number: 17439,
          },
        },
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
    const subscribeTool = (result.tools as any).github_subscribe_pr;
    expect(subscribeTool.description).toContain('Use review mode for new commits');
    expect(subscribeTool.description).toContain('review-thread-state changes including all threads resolved');
    expect(subscribeTool.description).toContain('PR close or merge updates');
    expect(subscribeTool.description).toContain('Use working mode for all actionable PR activity');
    expect(subscribeTool.description).toContain('Do not subscribe for a one-off inspection');
    expect(subscribeTool.inputSchema.safeParse({ number: 42, mode: 'review' }).success).toBe(true);
    expect(subscribeTool.inputSchema.safeParse({ number: 42, mode: 'working' }).success).toBe(true);
    expect(subscribeTool.inputSchema.safeParse({ number: 42, mode: 'other' }).success).toBe(false);
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
    ).resolves.toMatchObject({
      subscribed: true,
      mode: 'working',
      owner: 'mastra-ai',
      repo: 'mastra',
      number: 17439,
      message: 'Subscribed to mastra-ai/mastra#17439 in working mode.',
    });
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
          contents: 'Subscribed to mastra-ai/mastra#123 in working mode.',
          attributes: expect.objectContaining({
            status: 'subscribed',
            owner: 'mastra-ai',
            repo: 'mastra',
            number: 123,
            mode: 'working',
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
                lastObservedCommentUrl: 'https://github.com/mastra-ai/mastra/pull/123#issuecomment-1',
                lastObservedCommentAuthor: 'coderabbitai[bot]',
                lastObservedCommentIsBot: true,
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
      lastObservedCommentUrl: 'https://github.com/mastra-ai/mastra/pull/123#issuecomment-1',
      lastObservedCommentAuthor: 'coderabbitai[bot]',
      lastObservedCommentIsBot: true,
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

  it('stops per-thread polling on shutdown', async () => {
    vi.useFakeTimers();
    const thread: StorageThreadType = {
      id: 'thread-shutdown',
      resourceId: 'resource-shutdown',
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
    const threadStore = createThreadStore(thread);
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({ githubUpdatedAt: '2026-01-01T00:00:00.000Z' })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, pollIntervalMs: 1_000 });

    await processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId });
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    processor.stop();

    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(syncClient.syncPullRequest).not.toHaveBeenCalled();
  });

  it('abandons an in-flight poll when the provider stops mid-sync', async () => {
    const thread: StorageThreadType = {
      id: 'thread-inflight',
      resourceId: 'resource-inflight',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 7,
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
    // Sync pauses until we release it, so stop() lands while the poll is in flight.
    let releaseSync!: () => void;
    const syncStarted = new Promise<void>(resolve => {
      releaseSync = () => resolve();
    });
    const syncGate = new Promise<{ ok: true }>(resolve => {
      void syncStarted.then(() => resolve({ ok: true }));
    });
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(() => syncGate),
      getPullRequestSnapshot: vi.fn(async () => ({
        githubUpdatedAt: '2026-01-01T00:05:00.000Z',
        contentHash: 'new-hash',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal });

    const pollPromise = processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    // Let the poll reach the paused sync call before stopping the provider.
    await vi.waitFor(() => expect(syncClient.syncPullRequest).toHaveBeenCalled());

    processor.stop();
    releaseSync();
    await expect(pollPromise).resolves.toBe(0);

    expect(threadStore.saveThread).not.toHaveBeenCalled();
    expect(sendNotificationSignal).not.toHaveBeenCalled();
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
    const reviewActivity = await runPoll(
      createThreadWithCursor({ lastObservedReviewStateHash: 'reviews-1' }),
      {
        title: 'PR',
        state: 'open',
        contentHash: 'reviews-2',
        ciState: 'unknown',
        unresolvedReviewThreads: 2,
        reviewStateHash: 'reviews-2',
      },
      { permissionResolver: { getPermission: vi.fn(async () => 'none' as const) } },
    );
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

  it('ignores transient unknown mergeability recomputes', async () => {
    const thread: StorageThreadType = {
      id: 'thread-mergeability-noise',
      resourceId: 'resource-mergeability-noise',
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
                lastSubscribeSignalId: 'signal-mergeability-noise',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'blocked-hash',
                lastObservedThreadContentHash: 'thread-hash',
                lastObservedHeadSha: 'head-sha',
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
    const mergeableStates = ['unknown', 'blocked'];
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Test PR',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:00:00.000Z',
        contentHash: `${mergeableStates[0]}-hash`,
        threadContentHash: 'thread-hash',
        headSha: 'head-sha',
        mergeableState: mergeableStates.shift(),
        ciState: 'success' as const,
        reviewStateHash: 'reviews-0',
      })),
    };
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    const savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
    const [subscription] = (savedThread.metadata?.mastra as any)[GITHUB_SIGNALS_METADATA_KEY].subscriptions;
    expect(subscription.lastObservedMergeableState).toBe('blocked');
  });

  it('ignores observed bot comment edits without suppressing other thread activity', async () => {
    const firstCommentUrl = 'https://github.com/mastra-ai/mastra/pull/42#issuecomment-1';
    const secondCommentUrl = 'https://github.com/mastra-ai/mastra/pull/42#issuecomment-2';
    const thread: StorageThreadType = {
      id: 'thread-bot-edit',
      resourceId: 'resource-bot-edit',
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
                lastSubscribeSignalId: 'signal-bot-edit',
                lastObservedGithubUpdatedAt: '2026-01-01T00:01:00.000Z',
                lastObservedContentHash: 'content-hash',
                lastObservedThreadContentHash: 'thread-hash',
                lastObservedHeadSha: 'head-sha',
                lastObservedState: 'open',
                lastObservedMergeableState: 'blocked',
                lastObservedCiState: 'success',
                lastObservedReviewStateHash: 'reviews-0',
                lastObservedCommentUrl: firstCommentUrl,
                lastObservedCommentAuthor: 'coderabbitai[bot]',
                lastObservedCommentIsBot: true,
              },
            ],
          },
        },
      },
    };
    const comments = [
      {
        url: firstCommentUrl,
        body: 'Updated walkthrough for the same comment',
        updatedAt: '2026-01-01T00:02:00.000Z',
        threadContentHash: 'edited-bot-comment-hash',
      },
      {
        url: firstCommentUrl,
        body: 'Updated walkthrough for the same comment',
        githubUpdatedAt: '2026-01-01T00:03:00.000Z',
        updatedAt: '2026-01-01T00:02:00.000Z',
        threadContentHash: 'updated-pr-body-hash',
      },
      {
        url: secondCommentUrl,
        body: 'A new review comment',
        githubUpdatedAt: '2026-01-01T00:04:00.000Z',
        updatedAt: '2026-01-01T00:04:00.000Z',
        threadContentHash: 'new-bot-comment-hash',
      },
    ];
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => {
        const comment = comments.shift()!;
        return {
          title: 'Test PR',
          state: 'open',
          githubUpdatedAt: comment.githubUpdatedAt ?? comment.updatedAt,
          contentHash: `${comment.threadContentHash}-aggregate`,
          threadContentHash: comment.threadContentHash,
          headSha: 'head-sha',
          mergeableState: 'blocked',
          ciState: 'success' as const,
          reviewStateHash: 'reviews-0',
          latestCommentAuthor: 'coderabbitai[bot]',
          latestCommentAuthorType: 'Bot',
          latestCommentIsBot: true,
          latestCommentBody: comment.body,
          latestCommentUrl: comment.url,
          latestCommentUpdatedAt: comment.updatedAt,
        };
      }),
    };
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(sendNotificationSignal).not.toHaveBeenCalled();

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    expect(sendNotificationSignal).toHaveBeenCalledTimes(2);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'pull-request-activity', priority: 'high' })],
      expect.anything(),
    );
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

  it('stopAllPolling cancels side effects of an in-flight poll', async () => {
    // stopAllPolling() increments a generation counter so that an in-flight
    // #pollThread bails out before executing saveThread or
    // sendNotificationSignal.
    vi.useFakeTimers();

    const thread: StorageThreadType = {
      id: 'thread-stop-inflight',
      resourceId: 'resource-stop-inflight',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 999,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-stop',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);

    // Use a deferred promise so we can control exactly when the poll completes.
    let resolveSync!: () => void;
    const syncBlocked = new Promise<void>(resolve => {
      resolveSync = resolve;
    });

    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => {
        await syncBlocked;
        return { ok: true };
      }),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Stop in-flight poll test',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: 'new-hash',
        latestCommentAuthor: 'contributor',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const permissionResolver = { getPermission: vi.fn(async () => 'write' as const) };
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      pollIntervalMs: 1_000,
      agentId: 'code-agent',
      permissionResolver,
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    // Start polling. The first poll is not immediate; it fires on the interval.
    await processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId });
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    // Advance past the interval to trigger a poll. The poll blocks on syncBlocked.
    await vi.advanceTimersByTimeAsync(1_000);
    // syncPullRequest was called but is awaiting the deferred promise.
    expect(syncClient.syncPullRequest).toHaveBeenCalledTimes(1);

    // While the poll is in-flight, stop all polling.
    processor.stopAllPolling();
    // After stopAllPolling, the polling map is cleared.
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(false);

    // Now unblock the in-flight poll. It should bail out early because the
    // generation counter was incremented by stopAllPolling().
    resolveSync();
    // Wait for the async poll to settle.
    await vi.advanceTimersByTimeAsync(0);

    // The in-flight poll must NOT execute side effects after stopAllPolling().
    // The authorized author above would produce a notification without the
    // generation guard, so this assertion exercises cancellation directly.
    expect(permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(sendNotificationSignal).not.toHaveBeenCalled();
    // The poll should NOT have saved thread metadata after the stop.
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('stop-then-restart polling uses fresh generation so the new poll proceeds normally', async () => {
    vi.useFakeTimers();
    const thread: StorageThreadType = {
      id: 'thread-stop-restart',
      resourceId: 'resource-stop-restart',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 100,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-restart',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);

    let resolveSync!: () => void;
    const syncBlocked = new Promise<void>(resolve => {
      resolveSync = resolve;
    });

    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => {
        await syncBlocked;
        return { ok: true };
      }),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Restart test',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: 'new-hash',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      pollIntervalMs: 1_000,
      agentId: 'code-agent',
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    // Start polling.
    await processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId });

    // Trigger a poll that blocks.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(syncClient.syncPullRequest).toHaveBeenCalledTimes(1);

    // Stop all polling while poll is in-flight.
    processor.stopAllPolling();
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(false);

    // Restart polling with a fresh sync mock that resolves immediately.
    let resolveRestartedSync!: () => void;
    const restartedSyncBlocked = new Promise<void>(resolve => {
      resolveRestartedSync = resolve;
    });
    const restartedSyncPullRequest = vi.mocked(syncClient.syncPullRequest);
    restartedSyncPullRequest.mockReset();
    restartedSyncPullRequest.mockImplementation(async () => {
      await restartedSyncBlocked;
      return { ok: true };
    });
    await processor.startPollingForThread({ threadId: thread.id, resourceId: thread.resourceId });
    expect(processor.isPollingThread({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    // Start the new poll and keep it in flight.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(processor.isPollingThreadRunning({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    // Unblock the old poll. It should bail out without clearing the new
    // generation's running flag or saving stale metadata.
    resolveSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(threadStore.saveThread).not.toHaveBeenCalled();
    expect(processor.isPollingThreadRunning({ threadId: thread.id, resourceId: thread.resourceId })).toBe(true);

    // The restarted poll should proceed normally once released.
    resolveRestartedSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(threadStore.saveThread).toHaveBeenCalled();
    expect(processor.isPollingThreadRunning({ threadId: thread.id, resourceId: thread.resourceId })).toBe(false);

    processor.stopAllPolling();
  });

  it('stopping while author permission is pending prevents notification and persistence', async () => {
    const thread: StorageThreadType = {
      id: 'thread-stop-permission',
      resourceId: 'resource-stop-permission',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 101,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-permission',
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
    let resolvePermission!: () => void;
    const permissionBlocked = new Promise<void>(resolve => {
      resolvePermission = resolve;
    });
    const permissionResolver = {
      getPermission: vi.fn(async () => {
        await permissionBlocked;
        return 'write' as const;
      }),
    };
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Permission race',
        state: 'open',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: 'new-hash',
        latestCommentAuthor: 'contributor',
        latestCommentBody: 'A new comment',
        latestCommentUpdatedAt: '2026-01-01T00:10:00.000Z',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient, permissionResolver, agentId: 'code-agent' });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    const poll = processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    await vi.waitFor(() => expect(permissionResolver.getPermission).toHaveBeenCalledTimes(1));

    processor.stopAllPolling();
    resolvePermission();
    await poll;

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('stopping while notification options are pending prevents notification dispatch', async () => {
    const thread: StorageThreadType = {
      id: 'thread-stop-notification',
      resourceId: 'resource-stop-notification',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 102,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-notification',
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
    let resolveStreamOptions!: () => void;
    const streamOptionsBlocked = new Promise<void>(resolve => {
      resolveStreamOptions = resolve;
    });
    const getNotificationStreamOptions = vi.fn(async () => {
      await streamOptionsBlocked;
      return { stream: 'test' };
    });
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Notification race',
        state: 'closed',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: 'new-hash',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({
      threadStore,
      syncClient,
      agentId: 'code-agent',
      getNotificationStreamOptions,
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    const poll = processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    await vi.waitFor(() => expect(getNotificationStreamOptions).toHaveBeenCalledTimes(1));

    processor.stopAllPolling();
    resolveStreamOptions();
    await poll;

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('stopping after saveThread starts suppresses the completion callback', async () => {
    const thread: StorageThreadType = {
      id: 'thread-stop-save',
      resourceId: 'resource-stop-save',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 103,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-save',
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
    let resolveSave!: () => void;
    const saveBlocked = new Promise<void>(resolve => {
      resolveSave = resolve;
    });
    vi.mocked(threadStore.saveThread).mockImplementation(async ({ thread: nextThread }) => {
      await saveBlocked;
      return nextThread;
    });
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Save race',
        state: 'closed',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: 'new-hash',
      })),
    };
    const onSubscriptionsChanged = vi.fn();
    const processor = new GithubSignals({ threadStore, syncClient });
    processor.onSubscriptionsChanged(onSubscriptionsChanged);

    const poll = processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });
    await vi.waitFor(() => expect(threadStore.saveThread).toHaveBeenCalledTimes(1));

    processor.stopAllPolling();
    resolveSave();
    await poll;

    expect(threadStore.saveThread).toHaveBeenCalledTimes(1);
    expect(onSubscriptionsChanged).not.toHaveBeenCalled();
  });

  it('stopPollingForThread cancels an in-flight poll for that thread', async () => {
    vi.useFakeTimers();
    const thread: StorageThreadType = {
      id: 'thread-stop-single',
      resourceId: 'resource-stop-single',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number: 104,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: 'signal-stop-single',
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
              },
            ],
          },
        },
      },
    };
    const threadStore = createThreadStore(thread);
    let resolveSync!: () => void;
    const syncBlocked = new Promise<void>(resolve => {
      resolveSync = resolve;
    });
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => {
        await syncBlocked;
        return { ok: true };
      }),
      getPullRequestSnapshot: vi.fn(async () => ({
        title: 'Single-thread stop race',
        state: 'closed',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: 'new-hash',
      })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, pollIntervalMs: 1_000 });
    const polling = { threadId: thread.id, resourceId: thread.resourceId };

    await processor.startPollingForThread(polling);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(syncClient.syncPullRequest).toHaveBeenCalledTimes(1);

    processor.stopPollingForThread(polling);
    expect(processor.isPollingThread(polling)).toBe(false);
    resolveSync();
    await vi.advanceTimersByTimeAsync(0);

    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('evicting a thread polling entry cancels its in-flight poll', async () => {
    vi.useFakeTimers();
    const createThread = (id: string, resourceId: string, number: number): StorageThreadType => ({
      id,
      resourceId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: {
            subscriptions: [
              {
                owner: 'mastra-ai',
                repo: 'mastra',
                number,
                subscribedAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                lastSubscribeSignalId: `signal-evict-${number}`,
                lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
                lastObservedContentHash: 'old-hash',
              },
            ],
          },
        },
      },
    });
    const firstThread = createThread('thread-evict-first', 'resource-evict-first', 105);
    const secondThread = createThread('thread-evict-second', 'resource-evict-second', 106);
    const threadStore: GithubSignalsThreadStore = {
      getThreadById: vi.fn(async ({ threadId }) => (threadId === firstThread.id ? firstThread : secondThread)),
      saveThread: vi.fn(async ({ thread: nextThread }) => nextThread),
    };
    let resolveFirstSync!: () => void;
    const firstSyncBlocked = new Promise<void>(resolve => {
      resolveFirstSync = resolve;
    });
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async input => {
        if (input.number === 105) {
          await firstSyncBlocked;
        }
        return { ok: true };
      }),
      getPullRequestSnapshot: vi.fn(async input => ({
        title: `Eviction race ${input.number}`,
        state: 'closed',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: `new-hash-${input.number}`,
      })),
    };
    const processor = new GithubSignals({ threadStore, syncClient, pollIntervalMs: 1_000 });
    const firstPolling = { threadId: firstThread.id, resourceId: firstThread.resourceId };
    const secondPolling = { threadId: secondThread.id, resourceId: secondThread.resourceId };

    await processor.startPollingForThread(firstPolling);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(syncClient.syncPullRequest).toHaveBeenCalledTimes(1);

    await processor.startPollingForThread(secondPolling);
    expect(processor.isPollingThread(firstPolling)).toBe(false);
    expect(processor.isPollingThread(secondPolling)).toBe(true);

    resolveFirstSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('defaults omitted and legacy subscription modes to working and preserves cursors when changing mode', async () => {
    const legacyThread = createSubscribedThread('thread-legacy-mode', {
      number: 201,
      mode: 'invalid' as any,
      lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastObservedContentHash: 'legacy-hash',
      lastObservedHeadSha: 'legacy-head',
    });
    const legacyStore = createThreadStore(legacyThread);
    const legacyProcessor = new GithubSignals({
      threadStore: legacyStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => ({
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:00:00.000Z',
          contentHash: 'legacy-hash',
          headSha: 'legacy-head',
        })),
      },
    });

    await legacyProcessor.pollThreadNow({ threadId: legacyThread.id, resourceId: legacyThread.resourceId });
    expect(getSavedGithubSubscriptions(legacyStore)[0]).toMatchObject({ mode: 'working' });

    const omittedThread: StorageThreadType = {
      id: 'thread-omitted-mode',
      resourceId: 'resource-omitted-mode',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const omittedStore = createThreadStore(omittedThread);
    const omittedProcessor = new GithubSignals({ threadStore: omittedStore, syncOnSubscribe: false });
    const omittedResult = await omittedProcessor.subscribeThreadToPR({
      threadId: omittedThread.id,
      resourceId: omittedThread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 202 },
    });
    expect(omittedResult).toMatchObject({ mode: 'working', subscription: { mode: 'working' } });
    expect(getSavedGithubSubscriptions(omittedStore)[0]).toMatchObject({ mode: 'working' });

    const changedResult = await legacyProcessor.subscribeThreadToPR({
      threadId: legacyThread.id,
      resourceId: legacyThread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 201 },
      mode: 'review',
    });
    expect(changedResult).toMatchObject({
      mode: 'review',
      subscription: {
        mode: 'review',
        lastObservedContentHash: 'legacy-hash',
        lastObservedHeadSha: 'legacy-head',
      },
    });
    legacyProcessor.stopAllPolling();
    omittedProcessor.stopAllPolling();
  });

  it('round-trips review mode through reactive signals, direct subscriptions, tools, and storage', async () => {
    expect(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 203, mode: 'review' }),
    ).toEqual(
      expect.objectContaining({
        attributes: { owner: 'mastra-ai', repo: 'mastra', number: 203, mode: 'review' },
        metadata: {
          github: { action: 'subscribeToPR', owner: 'mastra-ai', repo: 'mastra', number: 203, mode: 'review' },
        },
      }),
    );

    const thread: StorageThreadType = {
      id: 'thread-review-roundtrip',
      resourceId: 'resource-review-roundtrip',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    const processor = new GithubSignals({ threadStore, syncOnSubscribe: false });
    const directResult = await processor.subscribeThreadToPR({
      threadId: thread.id,
      resourceId: thread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 203 },
      mode: 'review',
    });
    expect(directResult).toMatchObject({ mode: 'review', subscription: { mode: 'review' } });

    const toolResult = await runGithubSignalsProcessor({
      processor,
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });
    const tools = toolResult.tools as Record<string, { execute: (input: unknown) => Promise<unknown> }>;
    await expect(
      tools.github_subscribe_pr!.execute({ owner: 'mastra-ai', repo: 'mastra', number: 203, mode: 'review' }),
    ).resolves.toMatchObject({
      subscribed: true,
      mode: 'review',
      message: 'Subscribed to mastra-ai/mastra#203 in review mode.',
    });
    expect(getSavedGithubSubscriptions(threadStore)[0]).toMatchObject({ mode: 'review' });
    processor.stopAllPolling();
  });

  it('silently checkpoints review baselines during subscribe and the first later poll', async () => {
    const snapshot: GithubPullRequestSnapshot = {
      title: 'Review baseline',
      state: 'open',
      githubUpdatedAt: '2026-01-01T00:05:00.000Z',
      contentHash: 'baseline-content',
      threadContentHash: 'baseline-thread',
      headSha: 'baseline-head',
      ciState: 'failure',
      mergeableState: 'dirty',
      reviewStateHash: 'review-1',
      unresolvedReviewThreads: 1,
    };
    const subscribeThread: StorageThreadType = {
      id: 'thread-review-baseline-subscribe',
      resourceId: 'resource-review-baseline-subscribe',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const subscribeStore = createThreadStore(subscribeThread);
    const subscribeNotification = vi.fn(async () => ({ accepted: true }));
    const subscribeProcessor = new GithubSignals({
      threadStore: subscribeStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => snapshot),
      },
      agentId: 'code-agent',
    });
    subscribeProcessor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal: subscribeNotification })),
    } as any);

    await subscribeProcessor.subscribeThreadToPR({
      threadId: subscribeThread.id,
      resourceId: subscribeThread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 204 },
      mode: 'review',
    });
    expect(subscribeNotification).not.toHaveBeenCalled();
    expect(getSavedGithubSubscriptions(subscribeStore)[0]).toMatchObject({
      mode: 'review',
      lastObservedContentHash: 'baseline-content',
      lastObservedHeadSha: 'baseline-head',
      lastObservedCiState: 'failure',
    });

    const laterThread: StorageThreadType = {
      id: 'thread-review-baseline-poll',
      resourceId: 'resource-review-baseline-poll',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const laterStore = createThreadStore(laterThread);
    const laterNotification = vi.fn(async () => ({ accepted: true }));
    const laterProcessor = new GithubSignals({
      threadStore: laterStore,
      syncOnSubscribe: false,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => snapshot),
      },
      agentId: 'code-agent',
    });
    laterProcessor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal: laterNotification })),
    } as any);
    await laterProcessor.subscribeThreadToPR({
      threadId: laterThread.id,
      resourceId: laterThread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 205 },
      mode: 'review',
    });
    vi.mocked(laterStore.saveThread).mockClear();
    await laterProcessor.pollThreadNow({ threadId: laterThread.id, resourceId: laterThread.resourceId });
    expect(laterNotification).not.toHaveBeenCalled();
    expect(getSavedGithubSubscriptions(laterStore)[0]).toMatchObject({
      mode: 'review',
      lastObservedContentHash: 'baseline-content',
      lastObservedHeadSha: 'baseline-head',
    });
    subscribeProcessor.stopAllPolling();
    laterProcessor.stopAllPolling();
  });

  it('silently checkpoints the first review snapshot after an initial snapshot error', async () => {
    const thread: StorageThreadType = {
      id: 'thread-review-recovery',
      resourceId: 'resource-review-recovery',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const threadStore = createThreadStore(thread);
    let snapshotAttempt = 0;
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => {
        snapshotAttempt++;
        if (snapshotAttempt === 1) throw new Error('snapshot unavailable');
        return {
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:05:00.000Z',
          contentHash: 'recovered-content',
          headSha: 'recovered-head',
          ciState: 'failure' as const,
        };
      }),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.subscribeThreadToPR({
      threadId: thread.id,
      resourceId: thread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 206 },
      mode: 'review',
    });
    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(getSavedGithubSubscriptions(threadStore)[0]).toMatchObject({
      mode: 'review',
      lastObservedContentHash: 'recovered-content',
      lastObservedHeadSha: 'recovered-head',
    });
    expect(getSavedGithubSubscriptions(threadStore)[0]!.lastSnapshotError).toBeUndefined();
    processor.stopAllPolling();
  });

  it('emits independently ranked review comment, head, and unresolved-review notifications', async () => {
    const thread = createSubscribedThread('thread-review-dedicated', {
      number: 207,
      mode: 'review',
      lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastObservedContentHash: 'old-content',
      lastObservedThreadContentHash: 'old-thread',
      lastObservedHeadSha: 'old-head',
      lastObservedState: 'open',
      lastObservedMergeableState: 'clean',
      lastObservedCiState: 'success',
      lastObservedReviewStateHash: 'review-1',
    });
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({
      threadStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => ({
          title: 'Review dedicated changes',
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:10:00.000Z',
          contentHash: 'new-content',
          threadContentHash: 'new-thread',
          headSha: 'new-head',
          mergeableState: 'dirty',
          ciState: 'failure' as const,
          reviewStateHash: 'review-2',
          unresolvedReviewThreads: 2,
          latestCommentAuthor: 'reviewer',
          latestCommentBody: 'I addressed the review.',
          latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/207#issuecomment-2',
          latestCommentUpdatedAt: '2026-01-01T00:09:00.000Z',
        })),
      },
      permissionResolver: { getPermission: vi.fn(async () => 'write' as const) },
      agentId: 'code-agent',
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    const notifications = (sendNotificationSignal.mock.calls as unknown[][])[0]![0] as Array<{ kind: string }>;
    expect(notifications.map(notification => notification.kind)).toEqual([
      'pull-request-activity',
      'pull-request-code-activity',
      'pull-request-review-activity',
    ]);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'pull-request-code-activity',
          summary: 'New head revision for mastra-ai/mastra#207: Review dedicated changes.',
          attributes: expect.objectContaining({ mode: 'review' }),
          metadata: expect.objectContaining({ github: expect.objectContaining({ mode: 'review' }) }),
        }),
      ]),
    );
    expect(getSavedGithubSubscriptions(threadStore)[0]).toMatchObject({
      lastNotificationKind: 'pull-request-activity',
      lastNotificationPriority: 'high',
      lastNotificationSummary: 'reviewer commented on mastra-ai/mastra#207: I addressed the review.',
    });
  });

  it('suppresses aggregate review noise while advancing every cursor and retaining notification history', async () => {
    const thread = createSubscribedThread('thread-review-suppressed', {
      number: 208,
      mode: 'review',
      lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastObservedContentHash: 'old-content',
      lastObservedThreadContentHash: 'old-thread',
      lastObservedHeadSha: 'same-head',
      lastObservedState: 'open',
      lastObservedMergeableState: 'clean',
      lastObservedCiState: 'success',
      lastObservedReviewStateHash: 'review-1',
      lastNotificationAt: '2026-01-01T00:01:00.000Z',
      lastNotificationKind: 'pull-request-code-activity',
      lastNotificationPriority: 'medium',
      lastNotificationSummary: 'Earlier code activity',
    });
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({
      threadStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => ({
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:10:00.000Z',
          contentHash: 'new-content',
          threadContentHash: 'new-thread',
          headSha: 'same-head',
          mergeableState: 'dirty',
          ciState: 'failure' as const,
          reviewStateHash: 'review-1',
          unresolvedReviewThreads: 1,
        })),
      },
      agentId: 'code-agent',
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(getSavedGithubSubscriptions(threadStore)[0]).toMatchObject({
      lastObservedGithubUpdatedAt: '2026-01-01T00:10:00.000Z',
      lastObservedContentHash: 'new-content',
      lastObservedThreadContentHash: 'new-thread',
      lastObservedMergeableState: 'dirty',
      lastObservedCiState: 'failure',
      lastNotificationAt: '2026-01-01T00:01:00.000Z',
      lastNotificationKind: 'pull-request-code-activity',
      lastNotificationSummary: 'Earlier code activity',
    });
  });

  it('does not author-gate head or review-state changes while suppressing unauthorized comments', async () => {
    const thread = createSubscribedThread('thread-review-author-gates', {
      number: 209,
      mode: 'review',
      lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastObservedContentHash: 'old-content',
      lastObservedHeadSha: 'old-head',
      lastObservedReviewStateHash: 'review-1',
    });
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({
      threadStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => ({
          title: 'No review actor',
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:10:00.000Z',
          contentHash: 'new-content',
          headSha: 'new-head',
          reviewStateHash: 'review-2',
          unresolvedReviewThreads: 2,
          latestCommentAuthor: 'read-only-user',
          latestCommentBody: 'Unauthorized review comment',
          latestCommentUrl: 'https://github.com/mastra-ai/mastra/pull/209#issuecomment-2',
          latestCommentUpdatedAt: '2026-01-01T00:09:00.000Z',
        })),
      },
      permissionResolver: { getPermission: vi.fn(async () => 'read' as const) },
      agentId: 'code-agent',
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    const notifications = (sendNotificationSignal.mock.calls as unknown[][])[0]![0] as Array<{ kind: string }>;
    expect(notifications.map(notification => notification.kind)).toEqual([
      'pull-request-code-activity',
      'pull-request-review-activity',
    ]);
  });

  it('notifies when the final observable review thread is resolved without requiring a comment author', async () => {
    const thread = createSubscribedThread('thread-review-all-resolved', {
      number: 210,
      mode: 'review',
      lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastObservedContentHash: 'old-content',
      lastObservedState: 'open',
      lastObservedReviewStateHash: 'review-1',
    });
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const permissionResolver = { getPermission: vi.fn(async () => 'none' as const) };
    const processor = new GithubSignals({
      threadStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => ({
          title: 'Resolve final review thread',
          state: 'open',
          githubUpdatedAt: '2026-01-01T00:10:00.000Z',
          contentHash: 'resolved-content',
          reviewStateHash: 'review-0',
          unresolvedReviewThreads: 0,
        })),
      },
      permissionResolver,
      agentId: 'code-agent',
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(permissionResolver.getPermission).not.toHaveBeenCalled();
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-review-activity',
          summary: 'All review threads are resolved for mastra-ai/mastra#210: Resolve final review thread.',
        }),
      ],
      expect.objectContaining({ threadId: thread.id, resourceId: thread.resourceId }),
    );
  });

  it('refuses terminal review subscriptions across direct, tool, and reactive contracts', async () => {
    vi.useFakeTimers();
    const directThread = createSubscribedThread('thread-review-terminal-direct', {
      number: 210,
      mode: 'review',
      lastObservedGithubUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastObservedContentHash: 'old-content',
    });
    const directStore = createThreadStore(directThread);
    const terminalSyncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async input => ({
        state: input.number === 211 ? 'merged' : 'closed',
        githubUpdatedAt: '2026-01-01T00:10:00.000Z',
        contentHash: input.number === 211 ? 'merged-content' : 'closed-content',
      })),
    };
    const directProcessor = new GithubSignals({ threadStore: directStore, syncClient: terminalSyncClient });
    await directProcessor.startPollingForThread({ threadId: directThread.id, resourceId: directThread.resourceId });
    const directResult = await directProcessor.subscribeThreadToPR({
      threadId: directThread.id,
      resourceId: directThread.resourceId,
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 210 },
      mode: 'review',
    });
    expect(directResult).toMatchObject({ mode: 'review', terminalState: 'closed' });
    expect(directResult.subscription).toBeUndefined();
    expect(getSavedGithubSubscriptions(directStore)).toEqual([]);
    expect(directProcessor.isPollingThread({ threadId: directThread.id, resourceId: directThread.resourceId })).toBe(
      false,
    );

    const toolThread: StorageThreadType = {
      id: 'thread-review-terminal-tool',
      resourceId: 'resource-review-terminal-tool',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const toolProcessor = new GithubSignals({
      threadStore: createThreadStore(toolThread),
      syncClient: terminalSyncClient,
    });
    const toolStep = await runGithubSignalsProcessor({
      processor: toolProcessor,
      messageList: new MessageList({ threadId: toolThread.id, resourceId: toolThread.resourceId }),
      requestContext: createRequestContext(toolThread),
    });
    const tools = toolStep.tools as Record<string, { execute: (input: unknown) => Promise<unknown> }>;
    await expect(
      tools.github_subscribe_pr!.execute({ owner: 'mastra-ai', repo: 'mastra', number: 211, mode: 'review' }),
    ).resolves.toMatchObject({ subscribed: false, mode: 'review', terminalState: 'merged', reason: 'terminal' });

    const reactiveThread: StorageThreadType = {
      id: 'thread-review-terminal-reactive',
      resourceId: 'resource-review-terminal-reactive',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      metadata: {},
    };
    const signal = createSignal(
      GithubSignals.signals.subscribeToPR({ owner: 'mastra-ai', repo: 'mastra', number: 212, mode: 'review' }),
    );
    const messageList = new MessageList({ threadId: reactiveThread.id, resourceId: reactiveThread.resourceId });
    messageList.add(
      [signal.toDBMessage({ threadId: reactiveThread.id, resourceId: reactiveThread.resourceId })],
      'input',
    );
    const chunks: unknown[] = [];
    await runGithubSignalsProcessor({
      processor: new GithubSignals({ threadStore: createThreadStore(reactiveThread), syncClient: terminalSyncClient }),
      messageList,
      requestContext: createRequestContext(reactiveThread),
      chunks,
    });
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: 'data-signal',
        data: expect.objectContaining({
          contents: 'Not subscribed to mastra-ai/mastra#212 in review mode because it is already closed.',
          attributes: expect.objectContaining({
            status: 'not_subscribed_terminal',
            mode: 'review',
            terminalState: 'closed',
          }),
        }),
      }),
    );
    toolProcessor.stopAllPolling();
  });

  it('notifies before retiring a review subscription whose first available snapshot is closed', async () => {
    const thread = createSubscribedThread('thread-review-terminal-poll', {
      number: 213,
      mode: 'review',
    });
    const threadStore = createThreadStore(thread);
    let state: 'closed' | 'open' = 'closed';
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(async () => ({
        state,
        githubUpdatedAt: state === 'closed' ? '2026-01-01T00:10:00.000Z' : '2026-01-01T00:20:00.000Z',
        contentHash: state === 'closed' ? 'closed-content' : 'reopened-content',
      })),
    };
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({ threadStore, syncClient, agentId: 'code-agent' });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await expect(processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(0);
    expect(getSavedGithubSubscriptions(threadStore)).toEqual([]);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-closed',
          summary:
            'mastra-ai/mastra#213 was closed. This thread has been automatically unsubscribed from this PR. Resubscribe if you still need updates.',
        }),
      ],
      expect.objectContaining({ threadId: thread.id, resourceId: thread.resourceId }),
    );

    state = 'open';
    await expect(processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(0);
    expect(syncClient.syncPullRequest).toHaveBeenCalledTimes(1);
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
  });

  it('notifies before retiring a review subscription even when the terminal state was already observed', async () => {
    const thread = createSubscribedThread('thread-review-terminal-merged', {
      number: 214,
      mode: 'review',
      lastObservedGithubUpdatedAt: '2026-01-01T00:10:00.000Z',
      lastObservedContentHash: 'merged-content',
      lastObservedState: 'merged',
    });
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => ({ accepted: true }));
    const processor = new GithubSignals({
      threadStore,
      syncClient: {
        syncPullRequest: vi.fn(async () => ({ ok: true })),
        getPullRequestSnapshot: vi.fn(async () => ({
          state: 'merged',
          mergedAt: '2026-01-01T00:10:00.000Z',
          githubUpdatedAt: '2026-01-01T00:10:00.000Z',
          contentHash: 'merged-content',
        })),
      },
      agentId: 'code-agent',
    });
    processor.__registerMastra({
      getAgentById: vi.fn(() => ({ sendSignal: vi.fn(), sendNotificationSignal })),
    } as any);

    await expect(processor.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toBe(0);

    expect(getSavedGithubSubscriptions(threadStore)).toEqual([]);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'pull-request-merged',
          summary:
            'mastra-ai/mastra#214 was merged. This thread has been automatically unsubscribed from this PR. Resubscribe if you still need updates.',
        }),
      ],
      expect.objectContaining({ threadId: thread.id, resourceId: thread.resourceId }),
    );
  });
});
