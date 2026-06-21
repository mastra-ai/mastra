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
  SlackSignalsProvider,
  getSlackConversationTypes,
  getSlackSignalsMetadata,
} from './index.js';
import type {
  SlackSignalsConversation,
  SlackSignalsMessage,
  SlackSignalsSyncClient,
  SlackSignalsThreadStore,
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

function createSyncClient(overrides: Partial<SlackSignalsSyncClient> = {}): SlackSignalsSyncClient {
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
    listThreadMessages: vi.fn(async () => ({ messages: [] })),
    getConversation: vi.fn(async (input: { channelId: string }) => ({
      id: input.channelId,
      name: 'test-channel',
      type: 'public_channel' as const,
    })),
    listUsers: vi.fn(async () => []),
    ...overrides,
  };
}

function getSavedSlackMetadata(threadStore: SlackSignalsThreadStore) {
  const call = (threadStore.saveThread as any).mock.calls.at(-1);
  return (call?.[0]?.thread?.metadata?.mastra?.[SLACK_SIGNALS_METADATA_KEY] ?? {}) as Record<string, any>;
}

function createSubscribedThread(overrides: Partial<StorageThreadType> & { channels?: Record<string, any> } = {}): StorageThreadType {
  const { channels = {}, ...rest } = overrides;
  return createThread({
    metadata: {
      mastra: {
        [SLACK_SIGNALS_METADATA_KEY]: {
          subscription: {
            workspaceId: 'T123',
            workspaceName: 'Mastra',
            workspaceUrl: 'https://mastra.slack.com/',
            userId: 'U123',
            botId: 'B123',
            conversationTypes: ['public_channel', 'private_channel', 'im', 'mpim'],
            subscribedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            lastSubscribeSignalId: 'signal-1',
            channels,
          },
        },
      },
    },
    ...rest,
  });
}

function createChannelState(overrides: Partial<{ id: string; name: string; type: string; latestTs: string; subscribedAt: string }> = {}): Record<string, any> {
  return {
    id: overrides.id ?? 'C123',
    type: overrides.type ?? 'public_channel',
    ...(overrides.name ? { name: overrides.name } : {}),
    ...(overrides.latestTs ? { latestTs: overrides.latestTs } : {}),
    ...(overrides.subscribedAt ? { subscribedAt: overrides.subscribedAt } : { subscribedAt: '2026-01-01T00:00:00.000Z' }),
  };
}

function createMessage(overrides: Partial<SlackSignalsMessage> & { ts: string; channelId?: string }): SlackSignalsMessage {
  return {
    channelId: overrides.channelId ?? 'C123',
    channelType: overrides.channelType ?? 'public_channel',
    ...(overrides.channelName ? { channelName: overrides.channelName } : {}),
    ts: overrides.ts,
    ...(overrides.threadTs ? { threadTs: overrides.threadTs } : {}),
    ...(overrides.user ? { user: overrides.user } : {}),
    ...(overrides.username ? { username: overrides.username } : {}),
    ...(overrides.botId ? { botId: overrides.botId } : {}),
    ...(overrides.text ? { text: overrides.text } : {}),
  };
}

async function runSlackSignalsProcessor(options: {
  processor: SlackSignalsProvider;
  messageList: MessageList;
  requestContext: RequestContext;
}) {
  const runner = new ProcessorRunner({
    inputProcessors: [options.processor],
    outputProcessors: [],
    logger: mockLogger,
    agentName: 'slack-agent',
  });

  return runner.runProcessInputStep({
    messageList: options.messageList,
    stepNumber: 0,
    steps: [],
    model: {} as any,
    tools: {},
    retryCount: 0,
    requestContext: options.requestContext,
    messageId: 'response-1',
    writer: { custom: vi.fn(async () => {}) },
  });
}

function createMockAgent() {
  return {
    sendNotificationSignal: vi.fn().mockResolvedValue(undefined),
  } as any;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('SlackSignalsProvider', () => {
  describe('metadata parsing', () => {
    it('ignores legacy auto-discovered channels without a subscribedAt marker', () => {
      const thread = createSubscribedThread({
        channels: {
          CLEGACY: { id: 'CLEGACY', name: 'legacy', type: 'public_channel', latestTs: '100.000' },
          CSELECTED: createChannelState({ id: 'CSELECTED', name: 'selected' }),
        },
      });

      const metadata = getSlackSignalsMetadata(thread.metadata);

      expect(Object.keys(metadata.subscription?.channels ?? {})).toEqual(['CSELECTED']);
    });
  });

  describe('configuration', () => {
    it('exposes provider id and name', () => {
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', syncClient: createSyncClient() });
      expect(provider.id).toBe('slack-signals');
      expect(provider.name).toBe('Slack Signals');
    });

    it('defaults to all conversation types when include is unspecified', () => {
      expect(DEFAULT_SLACK_SIGNALS_INCLUDE).toEqual({
        publicChannels: true,
        privateChannels: true,
        dms: true,
        groupDms: true,
      });
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', syncClient: createSyncClient() });
      expect(provider.conversationTypes).toEqual(['public_channel', 'private_channel', 'im', 'mpim']);
    });

    it('respects include config to narrow conversation types', () => {
      const types = getSlackConversationTypes({ publicChannels: true, privateChannels: false, dms: true, groupDms: false });
      expect(types).toEqual(['public_channel', 'im']);
    });

    it('uses default poll interval of 60s', () => {
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', syncClient: createSyncClient() });
      expect(provider.pollInterval).toBe(60_000);
    });

    it('accepts custom poll interval', () => {
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', pollIntervalMs: 30_000, syncClient: createSyncClient() });
      expect(provider.pollInterval).toBe(30_000);
    });

    it('supplements available conversations with users.conversations results', async () => {
      const listConversations = vi.fn(async () => ({
        conversations: [{ id: 'C123', name: 'general', type: 'public_channel' as const }],
      }));
      const listUserConversations = vi.fn(async () => ({
        conversations: [
          { id: 'C123', name: 'general', type: 'public_channel' as const },
          { id: 'GMP1', name: 'project-group', type: 'mpim' as const },
        ],
      }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        syncClient: createSyncClient({ listConversations, listUserConversations }),
      });

      await expect(provider.listAvailableChannels()).resolves.toEqual([
        { id: 'C123', name: 'general', type: 'public_channel' },
        { id: 'GMP1', name: 'project-group', type: 'mpim' },
      ]);
      expect(listUserConversations).toHaveBeenCalledWith(expect.objectContaining({ userId: 'U123', types: ['public_channel', 'private_channel', 'im', 'mpim'] }));
    });
  });

  describe('subscribe', () => {
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
    });

    it('adds channels to subscription when channels specified', async () => {
      const thread = createSubscribedThread();
      const threadStore = createThreadStore(thread);
      const syncClient = createSyncClient({
        listConversations: vi.fn(async () => ({
          conversations: [
            { id: 'C100', name: 'general', type: 'public_channel' },
            { id: 'C200', name: 'random', type: 'public_channel' },
          ] as SlackSignalsConversation[],
        })),
      });
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });

      const result = await provider.subscribeThreadToSlack({
        threadId: thread.id,
        resourceId: thread.resourceId,
        channels: ['general', 'random'],
      });

      expect(result.addedChannels).toEqual(['general', 'random']);
      const slackMetadata = getSavedSlackMetadata(threadStore);
      expect(Object.keys(slackMetadata.subscription.channels)).toEqual(['C100', 'C200']);
    });

    it('resolves channel IDs via conversations.info', async () => {
      const thread = createSubscribedThread();
      const threadStore = createThreadStore(thread);
      const syncClient = createSyncClient({
        getConversation: vi.fn(async (input: { channelId: string }) => ({
          id: input.channelId,
          name: 'eng',
          type: 'public_channel' as const,
        })),
      });
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });

      const result = await provider.subscribeThreadToSlack({
        threadId: thread.id,
        resourceId: thread.resourceId,
        channels: ['CABC123'],
      });

      expect(result.addedChannels).toEqual(['eng']);
      expect(syncClient.getConversation).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'CABC123' }));
    });

    it('is idempotent when adding already-subscribed channels', async () => {
      const thread = createSubscribedThread({
        channels: { C100: createChannelState({ id: 'C100', name: 'general', latestTs: '100.000' }) },
      });
      const threadStore = createThreadStore(thread);
      const syncClient = createSyncClient();
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });

      const result = await provider.subscribeThreadToSlack({
        threadId: thread.id,
        resourceId: thread.resourceId,
        channels: ['general'],
      });

      expect(result.addedChannels).toEqual([]);
    });
  });

  describe('unsubscribe', () => {
    it('removes a workspace subscription on unsubscribe', async () => {
      const thread = createSubscribedThread({
        channels: { C100: createChannelState({ id: 'C100', name: 'general' }) },
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

    it('removes specific channels when channels specified', async () => {
      const thread = createSubscribedThread({
        channels: {
          C100: createChannelState({ id: 'C100', name: 'general' }),
          C200: createChannelState({ id: 'C200', name: 'random' }),
        },
      });
      const threadStore = createThreadStore(thread);
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

      const result = await provider.unsubscribeThreadFromSlack({
        threadId: thread.id,
        resourceId: thread.resourceId,
        channels: ['general'],
      });

      expect(result.removedChannels).toEqual(['general']);
      const slackMetadata = getSavedSlackMetadata(threadStore);
      expect(Object.keys(slackMetadata.subscription.channels)).toEqual(['C200']);
    });

    it('removes entire subscription when last channel is removed', async () => {
      const thread = createSubscribedThread({
        channels: { C100: createChannelState({ id: 'C100', name: 'general' }) },
      });
      const threadStore = createThreadStore(thread);
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

      const result = await provider.unsubscribeThreadFromSlack({
        threadId: thread.id,
        resourceId: thread.resourceId,
        channels: ['general'],
      });

      expect(result.removed).toBe(true);
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
  });

  describe('tools', () => {
    it('returns Slack subscribe and unsubscribe tools from processInputStep', async () => {
      const thread = createThread({ id: 'thread-tools', resourceId: 'resource-tools' });

      const result = await runSlackSignalsProcessor({
        processor: new SlackSignalsProvider({ token: 'xoxp-test', threadStore: createThreadStore(thread), syncClient: createSyncClient() }),
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });

      expect(Object.keys(result.tools ?? {})).toEqual(
        expect.arrayContaining([
          'slack_subscribe',
          'slack_unsubscribe',
          'slack_list_subscriptions',
          'slack_read_conversation',
          'slack_read_thread',
        ]),
      );
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

    it('subscribe tool with channels adds specific channels', async () => {
      const thread = createSubscribedThread({ id: 'thread-channels', resourceId: 'resource-channels' });
      const threadStore = createThreadStore(thread);
      const syncClient = createSyncClient({
        listConversations: vi.fn(async () => ({
          conversations: [{ id: 'C999', name: 'eng', type: 'public_channel' }] as SlackSignalsConversation[],
        })),
      });
      const processor = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient });

      const result = await runSlackSignalsProcessor({
        processor,
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });
      const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

      await expect(
        tools.slack_subscribe!.execute(
          { channels: ['eng'] },
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
      ).resolves.toMatchObject({ addedChannels: ['eng'] });
    });

    it('list subscriptions tool returns selected Slack channels for the current thread', async () => {
      const thread = createSubscribedThread({
        id: 'thread-list-subscriptions',
        resourceId: 'resource-list-subscriptions',
        channels: {
          C999: createChannelState({ id: 'C999', name: 'eng', type: 'public_channel', latestTs: '100.000' }),
          D123: createChannelState({ id: 'D123', name: 'Abhi Aiyer', type: 'im', latestTs: '101.000' }),
        },
      });
      const processor = new SlackSignalsProvider({ token: 'xoxp-test', threadStore: createThreadStore(thread), syncClient: createSyncClient() });

      const result = await runSlackSignalsProcessor({
        processor,
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });
      const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

      await expect(
        tools.slack_list_subscriptions!.execute(
          {},
          {
            agent: {
              agentId: 'code-agent',
              threadId: thread.id,
              resourceId: thread.resourceId,
              toolCallId: 'tool-call-list',
              messages: [],
            },
          },
        ),
      ).resolves.toMatchObject({
        subscribed: true,
        workspaceId: 'T123',
        workspaceName: 'Mastra',
        channelCount: 2,
        channels: [
          expect.objectContaining({ id: 'D123', name: 'Abhi Aiyer', type: 'im' }),
          expect.objectContaining({ id: 'C999', name: 'eng', type: 'public_channel' }),
        ],
      });
    });

    it('list subscriptions tool reports when the thread is not subscribed', async () => {
      const thread = createThread({ id: 'thread-list-unsubscribed', resourceId: 'resource-list-unsubscribed' });
      const processor = new SlackSignalsProvider({ token: 'xoxp-test', threadStore: createThreadStore(thread), syncClient: createSyncClient() });

      const result = await runSlackSignalsProcessor({
        processor,
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });
      const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

      await expect(
        tools.slack_list_subscriptions!.execute(
          {},
          {
            agent: {
              agentId: 'code-agent',
              threadId: thread.id,
              resourceId: thread.resourceId,
              toolCallId: 'tool-call-list-empty',
              messages: [],
            },
          },
        ),
      ).resolves.toEqual({
        subscribed: false,
        conversationTypes: [],
        channels: [],
        channelCount: 0,
        message: 'This thread is not subscribed to Slack.',
      });
    });

    it('read conversation tool returns messages around a Slack notification ref', async () => {
      const thread = createThread({ id: 'thread-read', resourceId: 'resource-read' });
      const listMessages = vi
        .fn()
        .mockResolvedValueOnce({
          messages: [
            createMessage({ ts: '100.000', channelId: 'C123', channelName: 'general', user: 'U123', text: 'before' }),
            createMessage({ ts: '101.000', channelId: 'C123', channelName: 'general', user: 'U456', text: 'target' }),
          ],
        })
        .mockResolvedValueOnce({
          messages: [createMessage({ ts: '102.000', channelId: 'C123', channelName: 'general', user: 'U123', text: 'after' })],
        });
      const processor = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore: createThreadStore(thread),
        syncClient: createSyncClient({
          getConversation: vi.fn(async () => ({ id: 'C123', name: 'general', type: 'public_channel' as const })),
          listMessages,
          listUsers: vi.fn(async () => [
            { id: 'U123', name: 'tyler', displayName: 'Tyler', realName: 'Tyler Barnes' },
            { id: 'U456', name: 'abhi', displayName: 'Abhi', realName: 'Abhi Aiyer' },
          ]),
        }),
      });

      const result = await runSlackSignalsProcessor({
        processor,
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });
      const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

      await expect(
        tools.slack_read_conversation!.execute({ channel: 'C123', aroundTs: '101.000', before: 2, after: 1 }),
      ).resolves.toMatchObject({
        slackMessageRef: { channelId: 'C123', channelName: 'general', channelType: 'public_channel', messageTs: '101.000' },
        viewer: { userId: 'U123', username: 'Tyler' },
        messages: [
          expect.objectContaining({ ts: '100.000', user: 'U123', username: 'Tyler', isCurrentUser: true, text: 'before' }),
          expect.objectContaining({ ts: '101.000', user: 'U456', username: 'Abhi', text: 'target' }),
          expect.objectContaining({ ts: '102.000', user: 'U123', username: 'Tyler', isCurrentUser: true, text: 'after' }),
        ],
      });
      expect(listMessages).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ latest: '101.000', inclusive: true, limit: 3 }),
      );
      expect(listMessages).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ oldest: '101.000', inclusive: false, limit: 1 }),
      );
    });

    it('read conversation tool accepts channel name without channel ID', async () => {
      const thread = createThread({ id: 'thread-read-tool-name', resourceId: 'resource-read-tool-name' });
      const listConversations = vi.fn(async () => ({
        conversations: [{ id: 'C123', name: 'general', type: 'public_channel' as const }],
      }));
      const listMessages = vi.fn().mockResolvedValueOnce({ messages: [createMessage({ ts: '101.000', channelId: 'C123', channelName: 'general', text: 'target' })] });
      const processor = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore: createThreadStore(thread),
        syncClient: createSyncClient({ listConversations, listMessages }),
      });

      const result = await runSlackSignalsProcessor({
        processor,
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });
      const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

      await expect(tools.slack_read_conversation!.execute({ channel: '#general', aroundTs: '101.000', before: 1, after: 0 })).resolves.toMatchObject({
        slackMessageRef: { channelId: 'C123', channelName: 'general', channelType: 'public_channel', messageTs: '101.000' },
      });
      expect(listConversations).toHaveBeenCalledWith(expect.objectContaining({ types: ['public_channel', 'private_channel', 'im', 'mpim'] }));
    });

    it('read conversation provider method accepts channelName without channelId', async () => {
      const thread = createThread({ id: 'thread-read-name', resourceId: 'resource-read-name' });
      const listConversations = vi.fn(async () => ({
        conversations: [{ id: 'C123', name: 'general', type: 'public_channel' as const }],
      }));
      const listMessages = vi.fn().mockResolvedValueOnce({ messages: [createMessage({ ts: '101.000', channelId: 'C123', channelName: 'general', text: 'target' })] });
      const processor = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore: createThreadStore(thread),
        syncClient: createSyncClient({ listConversations, listMessages }),
      });

      await expect(processor.readConversation({ channelName: 'general', aroundTs: '101.000', before: 1, after: 0 })).resolves.toMatchObject({
        slackMessageRef: { channelId: 'C123', channelName: 'general', channelType: 'public_channel', messageTs: '101.000' },
      });
      expect(listConversations).toHaveBeenCalledWith(expect.objectContaining({ types: ['public_channel', 'private_channel', 'im', 'mpim'] }));
    });

    it('read conversation requires channelId or channelName', async () => {
      const processor = new SlackSignalsProvider({ token: 'xoxp-test', syncClient: createSyncClient() });

      await expect(processor.readConversation({ aroundTs: '101.000' })).rejects.toThrow('Slack read requires a channelId or resolvable channelName.');
    });

    it('read thread tool returns thread replies from Slack', async () => {
      const thread = createThread({ id: 'thread-replies', resourceId: 'resource-replies' });
      const listThreadMessages = vi.fn(async () => ({
        messages: [
          createMessage({ ts: '200.000', threadTs: '200.000', channelId: 'C123', channelName: 'general', user: 'U123', text: 'root' }),
          createMessage({ ts: '201.000', threadTs: '200.000', channelId: 'C123', channelName: 'general', user: 'U456', text: 'reply' }),
        ],
      }));
      const processor = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore: createThreadStore(thread),
        syncClient: createSyncClient({
          getConversation: vi.fn(async () => ({ id: 'C123', name: 'general', type: 'public_channel' as const })),
          listThreadMessages,
          listUsers: vi.fn(async () => [
            { id: 'U123', name: 'tyler', displayName: 'Tyler', realName: 'Tyler Barnes' },
            { id: 'U456', name: 'abhi', displayName: 'Abhi', realName: 'Abhi Aiyer' },
          ]),
        }),
      });

      const result = await runSlackSignalsProcessor({
        processor,
        messageList: new MessageList({ threadId: thread.id, resourceId: thread.resourceId }),
        requestContext: createRequestContext(thread),
      });
      const tools = result.tools as Record<string, { execute: (input?: unknown, context?: unknown) => Promise<unknown> }>;

      await expect(tools.slack_read_thread!.execute({ channel: 'C123', threadTs: '200.000' })).resolves.toMatchObject({
        slackMessageRef: { channelId: 'C123', channelName: 'general', channelType: 'public_channel', messageTs: '200.000', threadTs: '200.000' },
        viewer: { userId: 'U123', username: 'Tyler' },
        messages: [
          expect.objectContaining({ ts: '200.000', user: 'U123', username: 'Tyler', isCurrentUser: true, text: 'root' }),
          expect.objectContaining({ ts: '201.000', user: 'U456', username: 'Abhi', text: 'reply' }),
        ],
      });
      expect(listThreadMessages).toHaveBeenCalledWith(
        expect.objectContaining({ conversation: expect.objectContaining({ id: 'C123' }), threadTs: '200.000', limit: 100 }),
      );
    });
  });

  describe('processInputStep signals', () => {
    it('emits a subscribe status signal when subscribe signal is received', async () => {
      const thread = createThread();
      const threadStore = createThreadStore(thread);
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

      const signal = createSignal(SlackSignalsProvider.signals.subscribe());
      const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
      messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

      await runSlackSignalsProcessor({
        processor: provider,
        messageList,
        requestContext: createRequestContext(thread),
      });

      const saved = getSavedSlackMetadata(threadStore);
      expect(saved.subscription).toBeDefined();
      expect(saved.subscription.workspaceId).toBe('T123');
    });

    it('emits an unsubscribe status signal when unsubscribe signal is received', async () => {
      const thread = createSubscribedThread();
      const threadStore = createThreadStore(thread);
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });

      const signal = createSignal(SlackSignalsProvider.signals.unsubscribe());
      const messageList = new MessageList({ threadId: thread.id, resourceId: thread.resourceId });
      messageList.add([signal.toDBMessage({ threadId: thread.id, resourceId: thread.resourceId })], 'input');

      await runSlackSignalsProcessor({
        processor: provider,
        messageList,
        requestContext: createRequestContext(thread),
      });

      expect(getSavedSlackMetadata(threadStore).subscription).toBeUndefined();
    });
  });

  describe('pollThread', () => {
    it('returns empty result when no channels are subscribed', async () => {
      const thread = createSubscribedThread();
      const threadStore = createThreadStore(thread);
      const provider = new SlackSignalsProvider({ token: 'xoxp-test', threadStore, syncClient: createSyncClient() });
      provider.connect(createMockAgent());

      const result = await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      expect(result).toEqual({ notificationsSent: 0, channelsSynced: 0, channelsFailed: 0 });
    });

    it('establishes baseline on first poll without notifying', async () => {
      const thread = createSubscribedThread({
        channels: { C100: createChannelState({ id: 'C100', name: 'general' }) },
      });
      const threadStore = createThreadStore(thread);
      const listMessages = vi.fn(async () => ({
        messages: [createMessage({ ts: '100.000', channelId: 'C100', text: 'old message' })],
        latestTs: '100.000',
      }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore,
        syncClient: createSyncClient({ listMessages }),
      });
      const mockAgent = createMockAgent();
      provider.connect(mockAgent);

      const result = await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      expect(result.notificationsSent).toBe(0);
      expect(result.channelsSynced).toBe(1);
      expect(mockAgent.sendNotificationSignal).not.toHaveBeenCalled();

      // Verify latestTs was saved
      const saved = getSavedSlackMetadata(threadStore);
      expect(saved.subscription.channels.C100.latestTs).toBe('100.000');
    });

    it('notifies on new messages after baseline', async () => {
      const thread = createSubscribedThread({
        channels: {
          C100: createChannelState({ id: 'C100', name: 'general', latestTs: '100.000' }),
        },
      });
      const threadStore = createThreadStore(thread);
      const listMessages = vi.fn(async () => ({
        messages: [
          createMessage({ ts: '101.000', channelId: 'C100', text: 'new message 1', user: 'U456' }),
          createMessage({ ts: '102.000', channelId: 'C100', text: 'new message 2', user: 'U789' }),
        ],
        latestTs: '102.000',
      }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore,
        syncClient: createSyncClient({ listMessages }),
      });
      const mockAgent = createMockAgent();
      provider.connect(mockAgent);

      const result = await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      expect(result.notificationsSent).toBe(2);
      expect(result.channelsSynced).toBe(1);

      // Verify latestTs advanced
      const saved = getSavedSlackMetadata(threadStore);
      expect(saved.subscription.channels.C100.latestTs).toBe('102.000');

      // Verify notification shape
      const call = mockAgent.sendNotificationSignal.mock.calls[0]?.[0];
      expect(call.source).toBe('slack');
      expect(call.kind).toBe('slack-message');
      expect(call.summary).toContain('new message 1');
      expect(call.dedupeKey).toBe('T123:C100:101.000');
      expect(call.payload.slackMessageRef).toEqual({
        teamId: 'T123',
        channelId: 'C100',
        channelType: 'public_channel',
        messageTs: '101.000',
      });
      expect(call.attributes).toEqual({
        teamId: 'T123',
        channelId: 'C100',
        channelType: 'public_channel',
        messageTs: '101.000',
      });
    });

    it('uses maxPages=1 on baseline and maxPages=5 on subsequent polls', async () => {
      const baselineThread = createSubscribedThread({
        channels: { C100: createChannelState({ id: 'C100', name: 'general' }) },
      });
      const baselineStore = createThreadStore(baselineThread);
      const listMessages = vi.fn(async () => ({ messages: [], latestTs: undefined }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore: baselineStore,
        syncClient: createSyncClient({ listMessages }),
      });
      provider.connect(createMockAgent());

      await provider.pollThread({ threadId: baselineThread.id, resourceId: baselineThread.resourceId });
      expect(((listMessages.mock as any).calls[0]?.[0] as any)?.maxPages).toBe(1);

      // Now with latestTs set
      const pollThread = createSubscribedThread({
        channels: {
          C100: createChannelState({ id: 'C100', name: 'general', latestTs: '100.000' }),
        },
      });
      const pollStore = createThreadStore(pollThread);
      const listMessages2 = vi.fn(async () => ({ messages: [], latestTs: '100.000' }));
      const provider2 = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore: pollStore,
        syncClient: createSyncClient({ listMessages: listMessages2 }),
      });
      provider2.connect(createMockAgent());

      await provider2.pollThread({ threadId: pollThread.id, resourceId: pollThread.resourceId });
      expect(((listMessages2.mock as any).calls[0]?.[0] as any)?.maxPages).toBe(5);
    });

    it('records sync error on channel failure', async () => {
      const thread = createSubscribedThread({
        channels: {
          C100: createChannelState({ id: 'C100', name: 'general', latestTs: '100.000' }),
        },
      });
      const threadStore = createThreadStore(thread);
      const listMessages = vi.fn(async () => {
        throw new Error('channel_not_found');
      });
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore,
        syncClient: createSyncClient({ listMessages }),
      });
      provider.connect(createMockAgent());

      const result = await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      expect(result.channelsFailed).toBe(1);
      expect(result.notificationsSent).toBe(0);

      const saved = getSavedSlackMetadata(threadStore);
      expect(saved.subscription.channels.C100.lastSyncStatus).toBe('error');
      expect(saved.subscription.channels.C100.lastSyncError).toContain('channel_not_found');
    });

    it('filters messages by excludeChannelIds', async () => {
      const thread = createSubscribedThread({
        channels: {
          C100: createChannelState({ id: 'C100', name: 'general', latestTs: '100.000' }),
          C200: createChannelState({ id: 'C200', name: 'random', latestTs: '100.000' }),
        },
      });
      const threadStore = createThreadStore(thread);
      const listMessages = vi.fn(async (input: any) => ({
        messages: [createMessage({ ts: '101.000', channelId: input.conversation.id, text: 'hello', user: 'U456' })],
        latestTs: '101.000',
      }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore,
        syncClient: createSyncClient({ listMessages }),
        filters: { excludeChannelIds: ['C200'] },
      });
      const mockAgent = createMockAgent();
      provider.connect(mockAgent);

      const result = await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      expect(result.notificationsSent).toBe(1); // Only C100, C200 filtered
    });

    it('assigns high priority to DMs', async () => {
      const thread = createSubscribedThread({
        channels: {
          D100: createChannelState({ id: 'D100', type: 'im', latestTs: '100.000' }),
        },
      });
      const threadStore = createThreadStore(thread);
      const listMessages = vi.fn(async () => ({
        messages: [createMessage({ ts: '101.000', channelId: 'D100', channelType: 'im', text: 'hey', user: 'U456' })],
        latestTs: '101.000',
      }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore,
        syncClient: createSyncClient({ listMessages }),
      });
      const mockAgent = createMockAgent();
      provider.connect(mockAgent);

      await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      const call = mockAgent.sendNotificationSignal.mock.calls[0]?.[0];
      expect(call.priority).toBe('high');
    });

    it('assigns high priority to mentions', async () => {
      const thread = createSubscribedThread({
        channels: {
          C100: createChannelState({ id: 'C100', name: 'general', latestTs: '100.000' }),
        },
      });
      const threadStore = createThreadStore(thread);
      const listMessages = vi.fn(async () => ({
        messages: [
          createMessage({ ts: '101.000', channelId: 'C100', channelName: 'general', text: 'hey <@U123> check this', user: 'U456' }),
        ],
        latestTs: '101.000',
      }));
      const provider = new SlackSignalsProvider({
        token: 'xoxp-test',
        threadStore,
        syncClient: createSyncClient({ listMessages }),
      });
      const mockAgent = createMockAgent();
      provider.connect(mockAgent);

      await provider.pollThread({ threadId: thread.id, resourceId: thread.resourceId });
      const call = mockAgent.sendNotificationSignal.mock.calls[0]?.[0];
      expect(call.priority).toBe('high');
    });
  });
});
