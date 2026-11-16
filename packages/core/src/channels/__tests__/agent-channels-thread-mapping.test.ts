import { describe, it, expect, vi, beforeEach } from 'vitest';

import { noopLogger } from '../../logger';
import { RequestContext } from '../../request-context';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChannels } from '../agent-channels';

// Chat SDK resolves the adapter from the thread id's leading segment, so the
// external ids carry the platform prefix the mock adapter is registered under.
const EXTERNAL_THREAD_ID = 'discord:channel-1:thread-1';
const EXTERNAL_CHANNEL_ID = 'discord:channel-1';
const OWNER_ID = 'test-agent';

// Minimal mock adapter that satisfies the Chat SDK's Adapter interface
function createMockAdapter(name: string) {
  return {
    name,
    postMessage: vi.fn().mockResolvedValue({ id: 'sent-1', text: 'ok' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok', { status: 200 })),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...parts: string[]) => parts.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  } as any;
}

function makeChatThread(overrides: Record<string, unknown> = {}) {
  return {
    id: EXTERNAL_THREAD_ID,
    channelId: EXTERNAL_CHANNEL_ID,
    isDM: false,
    adapter: undefined as any, // set per-test from the channels instance
    isSubscribed: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    mentionUser: vi.fn((userId: string) => `<@${userId}>`),
    messages: (async function* () {})(),
    ...overrides,
  } as any;
}

describe('AgentChannels thread mapping', () => {
  let memoryStore: InMemoryMemory;
  let mockMastra: any;
  let mockAgent: any;
  let channels: AgentChannels;

  const message = {
    id: 'message-1',
    text: 'hi',
    author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
    attachments: [],
  } as any;

  const seedThread = async ({
    id,
    resourceId,
    metadata = {},
  }: {
    id: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  }) => {
    await memoryStore.saveThread({
      thread: {
        id,
        title: '',
        resourceId,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        metadata,
      },
    });
  };

  const seedChannelThread = async ({
    id,
    ownerId = OWNER_ID,
    subscribed = 'true',
  }: {
    id: string;
    ownerId?: string;
    subscribed?: string;
  }) => {
    await seedThread({
      id,
      resourceId: `discord:${id}-owner`,
      metadata: {
        channel_platform: 'discord',
        channel_externalThreadId: EXTERNAL_THREAD_ID,
        channel_externalChannelId: EXTERNAL_CHANNEL_ID,
        channel_ownerId: ownerId,
        channel_subscribed: subscribed,
        channel_lastSender: { author: { userId: 'user-1', userName: 'tyler' }, raw: {} },
        channel_isDM: false,
      },
    });
  };

  const metadataOf = async (threadId: string) =>
    ((await memoryStore.getThreadById({ threadId }))?.metadata ?? {}) as Record<string, unknown>;

  /** Delivers one inbound message on the external thread. */
  const deliverInboundMessage = async () => {
    await (channels as any).processChatMessage(
      makeChatThread({ adapter: channels.adapters.discord }),
      message,
      mockMastra,
      new RequestContext(),
    );
    const [, options] = mockAgent.sendMessage.mock.calls.at(-1)!;
    return options;
  };

  beforeEach(async () => {
    const db = new InMemoryDB();
    memoryStore = new InMemoryMemory({ db });
    mockMastra = {
      getStorage: () => ({ getStore: () => memoryStore }),
      getServer: () => null,
      getLogger: () => noopLogger,
    };
    mockAgent = {
      id: OWNER_ID,
      name: OWNER_ID,
      getMastraInstance: () => mockMastra,
      stream: vi.fn(),
      sendMessage: vi.fn().mockReturnValue({
        accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      }),
    };
    channels = new AgentChannels({ adapters: { discord: createMockAdapter('discord') } });
    channels.__setAgent(mockAgent);
    await channels.initialize(mockMastra);
  });

  describe('unmapThread', () => {
    it('clears the channel binding so the thread stops rendering into the channel', async () => {
      await seedChannelThread({ id: 'mapped-thread' });
      expect(await channels.buildRenderContextForThread('mapped-thread')).not.toBeNull();

      const result = await channels.unmapThread({ platform: 'discord', externalThreadId: EXTERNAL_THREAD_ID });

      expect(result).toEqual({ threadId: 'mapped-thread' });
      const metadata = await metadataOf('mapped-thread');
      expect(metadata.channel_platform).toBeUndefined();
      expect(metadata.channel_externalThreadId).toBeUndefined();
      expect(metadata.channel_externalChannelId).toBeUndefined();
      expect(metadata.channel_subscribed).toBeUndefined();
      expect(metadata.channel_lastSender).toBeUndefined();
      expect(metadata.channel_isDM).toBeUndefined();
      // The ownership record survives, so another agent cannot adopt the thread.
      expect(metadata.channel_ownerId).toBe(OWNER_ID);
      expect(await channels.buildRenderContextForThread('mapped-thread')).toBeNull();
    });

    it('reports nothing to unmap the second time and for an unknown external thread', async () => {
      await seedChannelThread({ id: 'mapped-thread' });

      expect(await channels.unmapThread({ platform: 'discord', externalThreadId: EXTERNAL_THREAD_ID })).toEqual({
        threadId: 'mapped-thread',
      });
      expect(await channels.unmapThread({ platform: 'discord', externalThreadId: EXTERNAL_THREAD_ID })).toEqual({
        threadId: null,
      });
      expect(await channels.unmapThread({ platform: 'discord', externalThreadId: 'channel-9:thread-9' })).toEqual({
        threadId: null,
      });
    });

    it('delivers the next inbound message into a new thread', async () => {
      await seedChannelThread({ id: 'mapped-thread' });
      await channels.unmapThread({ platform: 'discord', externalThreadId: EXTERNAL_THREAD_ID });

      const options = await deliverInboundMessage();

      expect(options.threadId).not.toBe('mapped-thread');
      expect(options.ifIdle.streamOptions.memory.thread).not.toBe('mapped-thread');
      const { threads } = await memoryStore.listThreads({
        filter: { metadata: { channel_externalThreadId: EXTERNAL_THREAD_ID } },
      });
      expect(threads).toHaveLength(1);
      expect(threads[0]!.id).toBe(options.threadId);
    });

    it('leaves a binding claimed by another agent untouched', async () => {
      await seedChannelThread({ id: 'other-agent-thread', ownerId: 'other-agent' });

      expect(await channels.unmapThread({ platform: 'discord', externalThreadId: EXTERNAL_THREAD_ID })).toEqual({
        threadId: null,
      });
      expect((await metadataOf('other-agent-thread')).channel_externalThreadId).toBe(EXTERNAL_THREAD_ID);
    });
  });

  describe('mapThread', () => {
    it('binds an existing thread and delivers the next message into it', async () => {
      await seedThread({ id: 'app-thread', resourceId: 'app:user-42' });

      await channels.mapThread({
        platform: 'discord',
        externalThreadId: EXTERNAL_THREAD_ID,
        threadId: 'app-thread',
        externalChannelId: EXTERNAL_CHANNEL_ID,
      });

      const metadata = await metadataOf('app-thread');
      expect(metadata.channel_platform).toBe('discord');
      expect(metadata.channel_externalThreadId).toBe(EXTERNAL_THREAD_ID);
      expect(metadata.channel_externalChannelId).toBe(EXTERNAL_CHANNEL_ID);
      expect(metadata.channel_ownerId).toBe(OWNER_ID);
      expect(metadata.channel_subscribed).toBe('false');

      const options = await deliverInboundMessage();
      expect(options.threadId).toBe('app-thread');
      // The app's own resource keeps owning the thread.
      expect(options.resourceId).toBe('app:user-42');
    });

    it('moves the binding away from the previously mapped thread', async () => {
      await seedChannelThread({ id: 'old-thread' });
      await seedThread({ id: 'new-thread', resourceId: 'app:user-42' });

      await channels.mapThread({
        platform: 'discord',
        externalThreadId: EXTERNAL_THREAD_ID,
        threadId: 'new-thread',
        externalChannelId: EXTERNAL_CHANNEL_ID,
      });

      const oldMetadata = await metadataOf('old-thread');
      expect(oldMetadata.channel_externalThreadId).toBeUndefined();
      expect(oldMetadata.channel_platform).toBeUndefined();

      const options = await deliverInboundMessage();
      expect(options.threadId).toBe('new-thread');
    });

    it('does not move a binding claimed by another agent', async () => {
      await seedChannelThread({ id: 'other-agent-thread', ownerId: 'other-agent' });
      await seedThread({ id: 'new-thread', resourceId: 'app:user-42' });

      await channels.mapThread({
        platform: 'discord',
        externalThreadId: EXTERNAL_THREAD_ID,
        threadId: 'new-thread',
        externalChannelId: EXTERNAL_CHANNEL_ID,
      });

      expect((await metadataOf('other-agent-thread')).channel_externalThreadId).toBe(EXTERNAL_THREAD_ID);
      expect((await metadataOf('new-thread')).channel_externalThreadId).toBe(EXTERNAL_THREAD_ID);
    });

    it('fails when the target thread does not exist', async () => {
      await expect(
        channels.mapThread({
          platform: 'discord',
          externalThreadId: EXTERNAL_THREAD_ID,
          threadId: 'missing-thread',
          externalChannelId: EXTERNAL_CHANNEL_ID,
        }),
      ).rejects.toThrow(/the thread does not exist/);
    });

    it('unmaps and remaps the same thread without leaving the account subscribed', async () => {
      await seedChannelThread({ id: 'mapped-thread' });
      await channels.unmapThread({ platform: 'discord', externalThreadId: EXTERNAL_THREAD_ID });

      await channels.mapThread({
        platform: 'discord',
        externalThreadId: EXTERNAL_THREAD_ID,
        threadId: 'mapped-thread',
        externalChannelId: EXTERNAL_CHANNEL_ID,
      });

      const metadata = await metadataOf('mapped-thread');
      expect(metadata.channel_externalThreadId).toBe(EXTERNAL_THREAD_ID);
      expect(metadata.channel_subscribed).toBe('false');

      const options = await deliverInboundMessage();
      expect(options.threadId).toBe('mapped-thread');
    });
  });
});
