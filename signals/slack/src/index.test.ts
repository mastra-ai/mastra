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

function createThreadWithChannelState(input: {
  channels: Record<string, unknown>;
  conversationTypes?: string[];
  id?: string;
  resourceId?: string;
}) {
  return createSubscribedThread({
    ...(input.id ? { id: input.id } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    metadata: {
      mastra: {
        [SLACK_SIGNALS_METADATA_KEY]: {
          subscription: {
            workspaceId: 'T123',
            workspaceName: 'Mastra',
            userId: 'U123',
            botId: 'B123',
            conversationTypes: input.conversationTypes ?? ['public_channel'],
            subscribedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            lastSubscribeSignalId: 'signal-1',
            channels: input.channels,
          },
        },
      },
    },
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

  it('does no sync work when no subscriptions are passed to poll', async () => {
    const syncClient = createSyncClient();
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore: createThreadStore(createThread()), syncClient });

    await provider.poll([]);

    expect(syncClient.listConversations).not.toHaveBeenCalled();
    expect(syncClient.listMessages).not.toHaveBeenCalled();
  });

  it('baselines newly discovered channels without emitting historical notifications', async () => {
    const thread = createSubscribedThread({ id: 'thread-baseline', resourceId: 'resource-baseline' });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [{ id: 'C1', name: 'general', type: 'public_channel' }],
    });
    vi.mocked(syncClient.listMessages).mockResolvedValueOnce({
      latestTs: '1710000002.000000',
      messages: [
        { channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1', text: 'old' },
      ],
    });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient });
    provider.connect({ sendNotificationSignal } as any);

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 0,
      channelsSynced: 1,
      channelsFailed: 0,
    });

    expect(sendNotificationSignal).not.toHaveBeenCalled();
    expect(syncClient.listConversations).toHaveBeenCalledWith({ types: ['public_channel', 'private_channel', 'im', 'mpim'] });
    expect(syncClient.listMessages).toHaveBeenCalledWith({
      conversation: { id: 'C1', name: 'general', type: 'public_channel' },
      oldest: undefined,
      inclusive: false,
      limit: undefined,
    });
    expect(getSavedSlackMetadata(threadStore).subscription.channels.C1).toEqual(
      expect.objectContaining({ latestTs: '1710000002.000000', lastSyncStatus: 'success' }),
    );
  });

  it('emits notifications for messages newer than the channel high-water timestamp', async () => {
    const thread = createSubscribedThread({
      id: 'thread-new-message',
      resourceId: 'resource-new-message',
      metadata: {
        mastra: {
          [SLACK_SIGNALS_METADATA_KEY]: {
            subscription: {
              workspaceId: 'T123',
              workspaceName: 'Mastra',
              conversationTypes: ['public_channel'],
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'signal-1',
              channels: {
                C1: { id: 'C1', name: 'general', type: 'public_channel', latestTs: '1710000001.000000' },
              },
            },
          },
        },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [{ id: 'C1', name: 'general', type: 'public_channel' }],
    });
    vi.mocked(syncClient.listMessages).mockResolvedValueOnce({
      latestTs: '1710000002.000000',
      messages: [
        { channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000001.000000', user: 'U0', text: 'old' },
        { channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1', text: 'new' },
      ],
    });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient, maxMessagesPerChannel: 25 });
    provider.connect({ sendNotificationSignal } as any);

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 1,
      channelsSynced: 1,
      channelsFailed: 0,
    });

    expect(syncClient.listMessages).toHaveBeenCalledWith({
      conversation: { id: 'C1', name: 'general', type: 'public_channel' },
      oldest: '1710000001.000000',
      inclusive: false,
      limit: 25,
    });
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'slack',
        kind: 'slack-message',
        summary: 'U1 in #general: new',
        sourceId: 'T123:C1:1710000002.000000',
        dedupeKey: 'T123:C1:1710000002.000000',
        coalesceKey: 'T123:C1',
        payload: expect.objectContaining({ channelId: 'C1', messageTs: '1710000002.000000', text: 'new' }),
      }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );
    const slackMetadata = getSavedSlackMetadata(threadStore);
    expect(slackMetadata.subscription.channels.C1).toEqual(
      expect.objectContaining({ latestTs: '1710000002.000000', lastSyncStatus: 'success' }),
    );
    expect(JSON.stringify(slackMetadata)).not.toContain('next_cursor');

    sendNotificationSignal.mockClear();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [{ id: 'C1', name: 'general', type: 'public_channel' }],
    });
    vi.mocked(syncClient.listMessages).mockResolvedValueOnce({
      latestTs: '1710000002.000000',
      messages: [
        { channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1', text: 'new' },
      ],
    });

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 0,
      channelsSynced: 1,
      channelsFailed: 0,
    });
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('does not advance latestTs when notification delivery fails', async () => {
    const thread = createSubscribedThread({
      id: 'thread-notify-fail',
      resourceId: 'resource-notify-fail',
      metadata: {
        mastra: {
          [SLACK_SIGNALS_METADATA_KEY]: {
            subscription: {
              workspaceId: 'T123',
              workspaceName: 'Mastra',
              conversationTypes: ['public_channel'],
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'signal-1',
              channels: {
                C1: { id: 'C1', name: 'general', type: 'public_channel', latestTs: '1710000001.000000' },
              },
            },
          },
        },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [{ id: 'C1', name: 'general', type: 'public_channel' }],
    });
    vi.mocked(syncClient.listMessages).mockResolvedValueOnce({
      latestTs: '1710000002.000000',
      messages: [{ channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1' }],
    });
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient });
    provider.connect({ sendNotificationSignal: vi.fn(async () => { throw new Error('delivery failed'); }) } as any);

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 0,
      channelsSynced: 0,
      channelsFailed: 1,
    });

    expect(getSavedSlackMetadata(threadStore).subscription.channels.C1).toEqual(
      expect.objectContaining({
        latestTs: '1710000001.000000',
        lastSyncStatus: 'error',
        lastSyncError: 'delivery failed',
      }),
    );
  });

  it('continues syncing other channels when one channel fails', async () => {
    const thread = createSubscribedThread({
      id: 'thread-partial-fail',
      resourceId: 'resource-partial-fail',
      metadata: {
        mastra: {
          [SLACK_SIGNALS_METADATA_KEY]: {
            subscription: {
              workspaceId: 'T123',
              workspaceName: 'Mastra',
              conversationTypes: ['public_channel'],
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'signal-1',
              channels: {
                C1: { id: 'C1', name: 'general', type: 'public_channel', latestTs: '1710000001.000000' },
                C2: { id: 'C2', name: 'random', type: 'public_channel', latestTs: '1710000001.000000' },
              },
            },
          },
        },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [
        { id: 'C1', name: 'general', type: 'public_channel' },
        { id: 'C2', name: 'random', type: 'public_channel' },
      ],
    });
    vi.mocked(syncClient.listMessages)
      .mockRejectedValueOnce(new Error('history failed'))
      .mockResolvedValueOnce({
        latestTs: '1710000002.000000',
        messages: [{ channelId: 'C2', channelName: 'random', channelType: 'public_channel', ts: '1710000002.000000', user: 'U2' }],
      });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({ token: 'xoxb-test', threadStore, syncClient });
    provider.connect({ sendNotificationSignal } as any);

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 1,
      channelsSynced: 1,
      channelsFailed: 1,
    });

    const channels = getSavedSlackMetadata(threadStore).subscription.channels;
    expect(channels.C1).toEqual(expect.objectContaining({ latestTs: '1710000001.000000', lastSyncStatus: 'error' }));
    expect(channels.C2).toEqual(expect.objectContaining({ latestTs: '1710000002.000000', lastSyncStatus: 'success' }));
  });

  it('filters notifications by included channel ids while still advancing high-water state', async () => {
    const thread = createThreadWithChannelState({
      id: 'thread-include-filter',
      resourceId: 'resource-include-filter',
      channels: {
        C1: { id: 'C1', name: 'general', type: 'public_channel', latestTs: '1710000001.000000' },
        C2: { id: 'C2', name: 'alerts', type: 'public_channel', latestTs: '1710000001.000000' },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [
        { id: 'C1', name: 'general', type: 'public_channel' },
        { id: 'C2', name: 'alerts', type: 'public_channel' },
      ],
    });
    vi.mocked(syncClient.listMessages)
      .mockResolvedValueOnce({
        latestTs: '1710000002.000000',
        messages: [{ channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1', text: 'skip me' }],
      })
      .mockResolvedValueOnce({
        latestTs: '1710000003.000000',
        messages: [{ channelId: 'C2', channelName: 'alerts', channelType: 'public_channel', ts: '1710000003.000000', user: 'U2', text: 'notify me' }],
      });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({
      token: 'xoxb-test',
      threadStore,
      syncClient,
      filters: { includeChannelIds: ['C2'] },
    });
    provider.connect({ sendNotificationSignal } as any);

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 1,
      channelsSynced: 2,
      channelsFailed: 0,
    });

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ channelId: 'C2' }) }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );
    const channels = getSavedSlackMetadata(threadStore).subscription.channels;
    expect(channels.C1).toEqual(expect.objectContaining({ latestTs: '1710000002.000000' }));
    expect(channels.C2).toEqual(expect.objectContaining({ latestTs: '1710000003.000000' }));
  });

  it('filters notifications by excluded channel names', async () => {
    const thread = createThreadWithChannelState({
      id: 'thread-exclude-filter',
      resourceId: 'resource-exclude-filter',
      channels: {
        C1: { id: 'C1', name: 'general', type: 'public_channel', latestTs: '1710000001.000000' },
        C2: { id: 'C2', name: 'random', type: 'public_channel', latestTs: '1710000001.000000' },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [
        { id: 'C1', name: 'general', type: 'public_channel' },
        { id: 'C2', name: 'random', type: 'public_channel' },
      ],
    });
    vi.mocked(syncClient.listMessages)
      .mockResolvedValueOnce({
        latestTs: '1710000002.000000',
        messages: [{ channelId: 'C1', channelName: 'general', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1', text: 'keep' }],
      })
      .mockResolvedValueOnce({
        latestTs: '1710000002.000000',
        messages: [{ channelId: 'C2', channelName: 'random', channelType: 'public_channel', ts: '1710000002.000000', user: 'U2', text: 'drop' }],
      });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({
      token: 'xoxb-test',
      threadStore,
      syncClient,
      filters: { excludeChannelNames: ['random'] },
    });
    provider.connect({ sendNotificationSignal } as any);

    await provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ channelId: 'C1' }) }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );
  });

  it('filters notifications by keyword allowlist and ignored bots', async () => {
    const thread = createThreadWithChannelState({
      id: 'thread-keyword-filter',
      resourceId: 'resource-keyword-filter',
      channels: {
        C1: { id: 'C1', name: 'alerts', type: 'public_channel', latestTs: '1710000001.000000' },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [{ id: 'C1', name: 'alerts', type: 'public_channel' }],
    });
    vi.mocked(syncClient.listMessages).mockResolvedValueOnce({
      latestTs: '1710000004.000000',
      messages: [
        { channelId: 'C1', channelName: 'alerts', channelType: 'public_channel', ts: '1710000002.000000', user: 'U1', text: 'ordinary update' },
        { channelId: 'C1', channelName: 'alerts', channelType: 'public_channel', ts: '1710000003.000000', botId: 'B999', text: 'mastra alert from bot' },
        { channelId: 'C1', channelName: 'alerts', channelType: 'public_channel', ts: '1710000004.000000', user: 'U2', text: 'Mastra alert from user' },
      ],
    });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({
      token: 'xoxb-test',
      threadStore,
      syncClient,
      filters: { keywords: ['mastra'], ignoredBotIds: ['B999'] },
    });
    provider.connect({ sendNotificationSignal } as any);

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual({
      notificationsSent: 1,
      channelsSynced: 1,
      channelsFailed: 0,
    });

    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ user: 'U2', text: 'Mastra alert from user' }) }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );
    expect(getSavedSlackMetadata(threadStore).subscription.channels.C1).toEqual(
      expect.objectContaining({ latestTs: '1710000004.000000' }),
    );
  });

  it('assigns DM and mention priorities and truncates long previews', async () => {
    const thread = createThreadWithChannelState({
      id: 'thread-priority-filter',
      resourceId: 'resource-priority-filter',
      conversationTypes: ['im'],
      channels: {
        D1: { id: 'D1', type: 'im', latestTs: '1710000001.000000' },
      },
    });
    const threadStore = createThreadStore(thread);
    const syncClient = createSyncClient();
    vi.mocked(syncClient.listConversations).mockResolvedValueOnce({
      conversations: [{ id: 'D1', type: 'im' }],
    });
    vi.mocked(syncClient.listMessages).mockResolvedValueOnce({
      latestTs: '1710000003.000000',
      messages: [
        { channelId: 'D1', channelType: 'im', ts: '1710000002.000000', user: 'U1', text: 'direct message' },
        { channelId: 'D1', channelType: 'im', ts: '1710000003.000000', user: 'U1', text: '<@B123> this is a very long urgent direct message' },
      ],
    });
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({
      token: 'xoxb-test',
      threadStore,
      syncClient,
      filters: { maxPreviewLength: 18, priority: { dms: 'high', mentions: 'urgent' } },
    });
    provider.connect({ sendNotificationSignal } as any);

    await provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    expect(sendNotificationSignal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ priority: 'high', summary: 'U1 in D1: direct message' }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );
    expect(sendNotificationSignal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ priority: 'urgent', summary: 'U1 in D1: <@B123> this is a…' }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );
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
