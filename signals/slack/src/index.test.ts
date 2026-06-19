import { createSignal } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { IMastraLogger } from '@mastra/core/logger';
import type { StorageThreadType } from '@mastra/core/memory';
import { ProcessorRunner } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SLACK_SIGNALS_INCLUDE,
  DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS,
  SLACK_SIGNALS_METADATA_KEY,
  SLACK_SYNC_STATUS_TAG,
  SlackSignalsProvider,
  getSlackConversationTypes,
} from './index.js';
import type { SlackSignalsSyncClient, SlackSignalsThreadStore } from './index.js';

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

function createThreadStore(thread: StorageThreadType): SlackSignalsThreadStore {
  return {
    getThreadById: vi.fn(async () => thread),
    saveThread: vi.fn(async ({ thread: nextThread }: { thread: StorageThreadType }) => {
      thread = nextThread;
      return nextThread;
    }),
  };
}

function createThread(overrides: Partial<StorageThreadType> = {}): StorageThreadType {
  return {
    id: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {},
    ...overrides,
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

function createSyncClient(): SlackSignalsSyncClient {
  return {
    getWorkspace: vi.fn(async () => ({
      teamId: 'T123',
      teamName: 'Mastra',
      userId: 'U123',
      botId: 'B123',
      url: 'https://mastra.slack.com/',
    })),
    listConversations: vi.fn(async () => ({ conversations: [] })),
    listMessages: vi.fn(async () => ({ messages: [] })),
  };
}

async function runSlackSignalsProcessor(args: {
  processor: SlackSignalsProvider;
  messageList: MessageList;
  requestContext: RequestContext;
}) {
  const runner = new ProcessorRunner({
    inputProcessors: [args.processor],
    outputProcessors: [],
    logger: mockLogger,
    agentName: 'slack-agent',
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
  });
}

function getSavedSlackMetadata(threadStore: SlackSignalsThreadStore) {
  const savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
  return (savedThread.metadata?.mastra as any)[SLACK_SIGNALS_METADATA_KEY];
}

describe('SlackSignalsProvider', () => {
  it('creates typed subscribe and unsubscribe signals', () => {
    expect(SlackSignalsProvider.signals.subscribe()).toEqual(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'slack-subscribe',
        contents: 'Subscribe to Slack',
        metadata: { slack: { action: 'subscribe' } },
      }),
    );

    expect(SlackSignalsProvider.signals.unsubscribe()).toEqual(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'slack-unsubscribe',
        contents: 'Unsubscribe from Slack',
        metadata: { slack: { action: 'unsubscribe' } },
      }),
    );
  });

  it('defaults to watching all reachable Slack conversation types', () => {
    const provider = new SlackSignalsProvider({ token: 'xoxb-test' });

    expect(provider.include).toEqual(DEFAULT_SLACK_SIGNALS_INCLUDE);
    expect(provider.conversationTypes).toEqual(['public_channel', 'private_channel', 'im', 'mpim']);
    expect(provider.pollInterval).toBe(DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS);
  });

  it('supports disabling selected conversation types', () => {
    const provider = new SlackSignalsProvider({
      token: 'xoxb-test',
      pollIntervalMs: 30_000,
      include: {
        privateChannels: false,
        groupDms: false,
      },
    });

    expect(provider.include).toEqual({
      publicChannels: true,
      privateChannels: false,
      dms: true,
      groupDms: false,
    });
    expect(provider.conversationTypes).toEqual(['public_channel', 'im']);
    expect(provider.pollInterval).toBe(30_000);
  });

  it('stores a workspace subscription in thread metadata', async () => {
    const thread = createThread();
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient });

    await expect(provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toMatchObject({
      subscribed: true,
      alreadySubscribed: false,
      workspaceId: 'T123',
      workspaceName: 'Mastra',
    });

    const slackMetadata = getSavedSlackMetadata(threadStore);
    expect(slackMetadata.subscription).toEqual(
      expect.objectContaining({
        workspaceId: 'T123',
        workspaceName: 'Mastra',
        workspaceUrl: 'https://mastra.slack.com/',
        userId: 'U123',
        botId: 'B123',
        conversationTypes: ['public_channel', 'private_channel', 'im', 'mpim'],
        channels: {},
      }),
    );
  });

  it('keeps subscribe idempotent with one workspace-wide subscription', async () => {
    const thread = createThread();
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });
    await expect(provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toMatchObject({
      subscribed: true,
      alreadySubscribed: true,
      workspaceId: 'T123',
    });

    const slackMetadata = getSavedSlackMetadata(threadStore);
    expect(slackMetadata.subscription.workspaceId).toBe('T123');
    expect(Array.isArray(slackMetadata.subscription)).toBe(false);
  });

  it('removes a workspace subscription on unsubscribe', async () => {
    const thread = createThread({
      metadata: {
        mastra: {
          [SLACK_SIGNALS_METADATA_KEY]: {
            subscription: {
              workspaceId: 'T123',
              workspaceName: 'Mastra',
              conversationTypes: ['public_channel', 'private_channel', 'im', 'mpim'],
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'signal-1',
              channels: {},
            },
          },
        },
      },
    });
    const threadStore = createThreadStore(thread);
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient: createSyncClient() });

    await expect(provider.unsubscribeThreadFromSlack({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toMatchObject({
      removed: true,
      workspaceId: 'T123',
      workspaceName: 'Mastra',
    });

    expect(getSavedSlackMetadata(threadStore).subscription).toBeUndefined();
  });

  it('does not save when unsubscribing a thread without a subscription', async () => {
    const thread = createThread();
    const threadStore = createThreadStore(thread);
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient: createSyncClient() });

    await expect(provider.unsubscribeThreadFromSlack({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toMatchObject({
      removed: false,
    });

    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('returns Slack subscribe and unsubscribe tools from processInputStep', async () => {
    const thread = createThread({ id: 'thread-tools', resourceId: 'resource-tools' });

    const result = await runSlackSignalsProcessor({
      processor: new SlackSignalsProvider({ token: 'xoxb-test', threadStore: createThreadStore(thread), syncClient: createSyncClient() }),
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });

    expect(Object.keys(result.tools ?? {})).toEqual(expect.arrayContaining(['slack_subscribe', 'slack_unsubscribe']));
  });

  it('subscribe and unsubscribe tools mutate the current thread subscription directly', async () => {
    const thread = createThread({ id: 'thread-tool-signal', resourceId: 'resource-tool-signal' });
    const threadStore = createThreadStore(thread);
    const processor = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient: createSyncClient() });

    const result = await runSlackSignalsProcessor({
      processor,
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });
    const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

    await expect(
      tools.slack_subscribe!.execute(
        {},
        {
          agent: {
            agentId: 'code-agent',
            threadId: thread.id,
            resourceId: thread.resourceId,
            toolCallId: 'tool-call-1',
            messages: [],
          },
        },
      ),
    ).resolves.toMatchObject({ subscribed: true, workspaceId: 'T123', message: expect.stringContaining('Subscribed') });
    expect(getSavedSlackMetadata(threadStore).subscription).toEqual(expect.objectContaining({ workspaceId: 'T123' }));

    await expect(
      tools.slack_unsubscribe!.execute(
        {},
        {
          agent: {
            agentId: 'code-agent',
            threadId: thread.id,
            resourceId: thread.resourceId,
            toolCallId: 'tool-call-2',
            messages: [],
          },
        },
      ),
    ).resolves.toMatchObject({ unsubscribed: true, workspaceId: 'T123', message: expect.stringContaining('Unsubscribed') });
    expect(getSavedSlackMetadata(threadStore).subscription).toBeUndefined();
  });

  it('processes subscribe and unsubscribe signals and emits useful status', async () => {
    const thread = createThread({ id: 'thread-signal', resourceId: 'resource-signal' });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    const processor = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient });
    const sendSignal = vi.fn(async () => ({ id: 'status-signal' }));
    const subscribeSignal = createSignal(SlackSignalsProvider.signals.subscribe());
    const subscribeMessage = subscribeSignal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });
    const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    messageList.add([subscribeMessage], 'input');

    await processor.processInputStep({
      messages: [subscribeMessage],
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      requestContext: createRequestContext(thread),
      systemMessages: [],
      state: {},
      abort: () => {
        throw new Error('aborted');
      },
      sendSignal,
    } as any);

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        tagName: SLACK_SYNC_STATUS_TAG,
        contents: 'Subscribed this thread to Slack workspace Mastra.',
        attributes: expect.objectContaining({ status: 'subscribed', workspaceId: 'T123' }),
      }),
    );

    sendSignal.mockClear();
    const unsubscribeSignal = createSignal(SlackSignalsProvider.signals.unsubscribe());
    const unsubscribeMessage = unsubscribeSignal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });
    const unsubscribeMessageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
    unsubscribeMessageList.add([unsubscribeMessage], 'input');

    await processor.processInputStep({
      messages: [unsubscribeMessage],
      messageList: unsubscribeMessageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      requestContext: createRequestContext(thread),
      systemMessages: [],
      state: {},
      abort: () => {
        throw new Error('aborted');
      },
      sendSignal,
    } as any);

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        tagName: SLACK_SYNC_STATUS_TAG,
        contents: 'Unsubscribed this thread from Slack workspace Mastra.',
        attributes: expect.objectContaining({ status: 'unsubscribed', workspaceId: 'T123' }),
      }),
    );
  });
});

describe('getSlackConversationTypes', () => {
  it('maps include config to Slack Web API conversation type names', () => {
    expect(getSlackConversationTypes({ publicChannels: false, dms: false })).toEqual(['private_channel', 'mpim']);
  });
});
