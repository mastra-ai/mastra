import { createSignal } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import type { IMastraLogger } from '@mastra/core/logger';
import type { StorageThreadType } from '@mastra/core/memory';
import { ProcessorRunner } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SLACK_SIGNALS_INCLUDE,
  SLACK_SIGNALS_METADATA_KEY,
  SLACK_SYNC_STATUS_TAG,
  SlackSignalsProvider,
  getSlackConversationTypes,
} from './index.js';
import type { SlackRtmClient, SlackRtmMessageEvent, SlackSignalsSyncClient, SlackSignalsThreadStore } from './index.js';

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

function createThreadStore(thread: StorageThreadType, allThreads: StorageThreadType[] = [thread]): SlackSignalsThreadStore {
  return {
    getThreadById: vi.fn(async () => thread),
    saveThread: vi.fn(async ({ thread: nextThread }: { thread: StorageThreadType }) => {
      thread = nextThread;
      return nextThread;
    }),
    listThreads: vi.fn(async () => ({ threads: allThreads })),
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

function createMockRtmClient() {
  let messageHandler: ((event: SlackRtmMessageEvent) => void) | undefined;
  let lifecycleHandler: ((state: string) => void) | undefined;
  return {
    onMessage: vi.fn((handler: (event: SlackRtmMessageEvent) => void) => { messageHandler = handler; }),
    onLifecycle: vi.fn((handler: (state: string) => void) => { lifecycleHandler = handler; }),
    connect: vi.fn(async () => { lifecycleHandler?.('connected'); }),
    disconnect: vi.fn(() => { lifecycleHandler?.('disconnected'); }),
    state: 'disconnected' as string,
    /** Test helper: simulate receiving an RTM message event */
    receive(event: Partial<SlackRtmMessageEvent> & { ts: string; channel: string }) {
      messageHandler?.({ type: 'message', eventTs: event.ts, ...event } as SlackRtmMessageEvent);
    },
    /** Test helper: simulate lifecycle state change */
    setLifecycle(state: string) {
      this.state = state;
      lifecycleHandler?.(state);
    },
  };
}

function createProviderWithRtm(options?: {
  thread?: StorageThreadType;
  allThreads?: StorageThreadType[];
  syncClient?: SlackSignalsSyncClient;
  filters?: Record<string, unknown>;
}) {
  const thread = options?.thread ?? createThread();
  const threadStore = createThreadStore(thread, options?.allThreads ?? [thread]);
  const syncClient = options?.syncClient ?? createSyncClient();
  const rtmClient = createMockRtmClient();
  const sendNotificationSignal = vi.fn(async () => undefined);
  const provider = new SlackSignalsProvider({
    token: 'xoxp-test',
    threadStore,
    syncClient,
    rtmClient: rtmClient as any as SlackRtmClient,
    ...(options?.filters ? { filters: options.filters as any } : {}),
  });
  provider.connect({ sendNotificationSignal } as any);
  return { provider, threadStore, syncClient, rtmClient, sendNotificationSignal, thread };
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

function createSubscribedThread(overrides: Partial<StorageThreadType> = {}) {
  return createThread({
    metadata: {
      mastra: {
        [SLACK_SIGNALS_METADATA_KEY]: {
          subscription: {
            workspaceId: 'T123',
            workspaceName: 'Mastra',
            userId: 'U123',
            botId: 'B123',
            conversationTypes: ['public_channel', 'private_channel', 'im', 'mpim'],
            subscribedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            lastSubscribeSignalId: 'signal-1',
            channels: {},
          },
        },
      },
    },
    ...overrides,
  });
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
    const provider = new SlackSignalsProvider({ token: 'xoxp-test' });

    expect(provider.include).toEqual(DEFAULT_SLACK_SIGNALS_INCLUDE);
    expect(provider.conversationTypes).toEqual(['public_channel', 'private_channel', 'im', 'mpim']);
  });

  it('supports disabling selected conversation types', () => {
    const provider = new SlackSignalsProvider({
      token: 'xoxp-test',
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
  });

  it('stores a workspace subscription in thread metadata', async () => {
    const thread = createThread();
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });

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
    const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });

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
    const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

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
    const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

    await expect(provider.unsubscribeThreadFromSlack({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toMatchObject({
      removed: false,
    });

    expect(threadStore.saveThread).not.toHaveBeenCalled();
  });

  it('returns Slack subscribe and unsubscribe tools from processInputStep', async () => {
    const thread = createThread({ id: 'thread-tools', resourceId: 'resource-tools' });

    const result = await runSlackSignalsProcessor({
      processor: new SlackSignalsProvider({ token: 'xoxp-test', threadStore: createThreadStore(thread), syncClient: createSyncClient() }),
      messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
      requestContext: createRequestContext(thread),
    });

    expect(Object.keys(result.tools ?? {})).toEqual(expect.arrayContaining(['slack_subscribe', 'slack_unsubscribe']));
  });

  it('subscribe and unsubscribe tools mutate the current thread subscription directly', async () => {
    const thread = createThread({ id: 'thread-tool-signal', resourceId: 'resource-tool-signal' });
    const threadStore = createThreadStore(thread);
    const processor = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

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

  // ── RTM tests ──────────────────────────────────────────────────────

  it('connects to RTM on connect() and tracks connection state', async () => {
    const { provider, rtmClient } = createProviderWithRtm();

    expect(rtmClient.connect).toHaveBeenCalled();
    expect(rtmClient.onMessage).toHaveBeenCalled();
    expect(rtmClient.onLifecycle).toHaveBeenCalled();
    expect(provider.rtmConnected).toBe(true);
  });

  it('emits notification for RTM message in a subscribed thread', async () => {
    const thread = createSubscribedThread({ id: 'thread-rtm', resourceId: 'resource-rtm' });
    const { provider, rtmClient, sendNotificationSignal } = createProviderWithRtm({ thread });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });

    rtmClient.receive({
      ts: '1525215129.000001',
      channel: 'C123',
      channelType: 'channel',
      user: 'U456',
      text: 'hello from slack',
    });

    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
    const call = (sendNotificationSignal.mock.calls as any[]).at(0)?.[0];
    expect(call.source).toBe('slack');
    expect(call.kind).toBe('slack-message');
    expect(call.summary).toContain('hello from slack');
  });

  it('skips message_changed and message_deleted subtypes', async () => {
    const thread = createSubscribedThread({ id: 'thread-skip', resourceId: 'resource-skip' });
    const { provider, rtmClient, sendNotificationSignal } = createProviderWithRtm({ thread });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });

    rtmClient.receive({ ts: '123.000', channel: 'C1', subtype: 'message_changed' });
    rtmClient.receive({ ts: '124.000', channel: 'C1', subtype: 'message_deleted' });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('allows bot_message subtype through', async () => {
    const thread = createSubscribedThread({ id: 'thread-bot', resourceId: 'resource-bot' });
    const { provider, rtmClient, sendNotificationSignal } = createProviderWithRtm({ thread });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });

    rtmClient.receive({ ts: '125.000', channel: 'C1', subtype: 'bot_message', botId: 'B1', text: 'bot says hi' });

    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
  });

  it('does not notify threads without subscription', async () => {
    const thread = createThread({ id: 'thread-nosub', resourceId: 'resource-nosub' });
    const { rtmClient, sendNotificationSignal } = createProviderWithRtm({ thread });

    rtmClient.receive({ ts: '126.000', channel: 'C1', user: 'U1', text: 'no one listening' });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('filters bot messages when ignoreBotMessages is true', async () => {
    const thread = createSubscribedThread({ id: 'thread-filter-bot', resourceId: 'resource-filter-bot' });
    const { provider, rtmClient, sendNotificationSignal } = createProviderWithRtm({
      thread,
      filters: { ignoreBotMessages: true },
    });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });

    rtmClient.receive({ ts: '127.000', channel: 'C1', subtype: 'bot_message', botId: 'B1', text: 'bot spam' });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('assigns DM priority for IM channel type', async () => {
    const thread = createSubscribedThread({ id: 'thread-dm', resourceId: 'resource-dm' });
    const { provider, rtmClient, sendNotificationSignal } = createProviderWithRtm({ thread });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });

    rtmClient.receive({ ts: '128.000', channel: 'D123', channelType: 'im', user: 'U1', text: 'private message' });

    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
    const call = (sendNotificationSignal.mock.calls as any[]).at(0)?.[0];
    expect(call.priority).toBe('high');
  });

  it('disconnect closes RTM client', async () => {
    const { provider, rtmClient } = createProviderWithRtm();

    provider.disconnect();

    expect(rtmClient.disconnect).toHaveBeenCalled();
    expect(provider.rtmConnected).toBe(false);
  });

  it('maps channel_type to SlackConversationType correctly', async () => {
    const thread = createSubscribedThread({ id: 'thread-map', resourceId: 'resource-map' });
    const { provider, rtmClient, sendNotificationSignal } = createProviderWithRtm({ thread });

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });

    // group → private_channel
    rtmClient.receive({ ts: '129.000', channel: 'G1', channelType: 'group', user: 'U1', text: 'private channel' });
    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
    expect((sendNotificationSignal.mock.calls as any[]).at(0)?.[0].priority).toBe('low');
  });

  it('restores subscribed threads from storage on connect', async () => {
    const subscribedThread = createSubscribedThread({ id: 'thread-restored', resourceId: 'resource-restored' });
    const unsubscribedThread = createThread({ id: 'thread-other', resourceId: 'resource-other' });
    const { rtmClient, sendNotificationSignal } = createProviderWithRtm({
      thread: subscribedThread,
      allThreads: [subscribedThread, unsubscribedThread],
    });

    // Wait for async #restoreSubscriptions to complete, then send RTM message
    await new Promise(resolve => setTimeout(resolve, 50));

    // RTM message should dispatch to the restored thread without calling subscribeThreadToSlack
    rtmClient.receive({ ts: '130.000', channel: 'C1', channelType: 'channel', user: 'U1', text: 'restored notification' });

    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
    expect((sendNotificationSignal.mock.calls as any[]).at(0)?.[0].summary).toContain('restored notification');
  });

  it('processes subscribe and unsubscribe signals and emits useful status', async () => {
    const thread = createThread({ id: 'thread-signal', resourceId: 'resource-signal' });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    const processor = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });
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
