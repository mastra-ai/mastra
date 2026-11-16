import { describe, it, expect, vi, beforeEach } from 'vitest';

import { noopLogger } from '../../logger';
import { RequestContext } from '../../request-context';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChannels } from '../agent-channels';

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

/**
 * Every channel metadata write happens while the rest of an inbound message is
 * still running, so a key deleted in between - an unmap clearing the mapping,
 * for example - must not come back. These tests model that window by running a
 * hook just before the store applies a matching patch: a writer that spreads an
 * earlier snapshot re-writes the deleted key, a writer that patches only the
 * keys it owns leaves it deleted.
 */
describe('AgentChannels channel metadata writes under a concurrent clear', () => {
  let memoryStore: InMemoryMemory;
  let mockMastra: any;
  let mockAgent: any;
  let channels: AgentChannels;
  let armNextMatchingWrite: (patchKey: string, hook: () => Promise<void>) => void;

  const message = {
    id: 'message-1',
    text: 'hi',
    author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
    attachments: [],
  } as any;

  const seedThread = async (metadata: Record<string, unknown>) => {
    await memoryStore.saveThread({
      thread: {
        id: 'mapped-thread',
        title: '',
        resourceId: 'discord:user-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        metadata,
      },
    });
  };

  const metadataOf = async () =>
    ((await memoryStore.getThreadById({ threadId: 'mapped-thread' }))?.metadata ?? {}) as Record<string, unknown>;

  const deliverInboundMessage = async () => {
    await (channels as any).processChatMessage(
      makeChatThread({ adapter: channels.adapters.discord }),
      message,
      mockMastra,
      new RequestContext(),
    );
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

    const originalPatchThread = memoryStore.patchThread.bind(memoryStore);
    let pending: { key: string; hook: () => Promise<void> } | null = null;
    (memoryStore as any).patchThread = async (args: any) => {
      if (pending && args?.metadata && pending.key in args.metadata) {
        const { hook } = pending;
        pending = null;
        await hook();
      }
      return originalPatchThread(args);
    };
    armNextMatchingWrite = (key, hook) => {
      pending = { key, hook };
    };
  });

  it('does not restore a binding cleared while an inbound message is handled', async () => {
    await seedThread({
      channel_platform: 'discord',
      channel_externalThreadId: EXTERNAL_THREAD_ID,
      channel_externalChannelId: EXTERNAL_CHANNEL_ID,
      channel_ownerId: OWNER_ID,
    });

    armNextMatchingWrite('channel_lastSender', async () => {
      await memoryStore.updateThread({
        id: 'mapped-thread',
        metadata: { channel_externalThreadId: undefined },
      });
    });

    await deliverInboundMessage();

    const metadata = await metadataOf();
    // The last-sender bookkeeping still landed...
    expect(metadata.channel_isDM).toBe(false);
    // ...but it did not bring the cleared binding back.
    expect(metadata.channel_externalThreadId).toBeUndefined();
  });

  it('does not restore a binding cleared while a legacy thread is adopted', async () => {
    // Pre-upgrade row: mapped to the external thread but not yet claimed by an agent.
    await seedThread({
      channel_platform: 'discord',
      channel_externalThreadId: EXTERNAL_THREAD_ID,
      channel_externalChannelId: EXTERNAL_CHANNEL_ID,
    });

    armNextMatchingWrite('channel_ownerId', async () => {
      await memoryStore.updateThread({
        id: 'mapped-thread',
        metadata: { channel_externalThreadId: undefined },
      });
    });

    await deliverInboundMessage();

    const metadata = await metadataOf();
    expect(metadata.channel_ownerId).toBe(OWNER_ID);
    expect(metadata.channel_externalThreadId).toBeUndefined();
  });
});
