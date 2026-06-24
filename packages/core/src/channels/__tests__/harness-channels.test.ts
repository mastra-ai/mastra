import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { HarnessEvent, HarnessEventListener } from '../../harness/types';
import { HarnessChannels } from '../harness-channels';

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

interface MockSession {
  listeners: HarnessEventListener[];
  sendMessage: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  respondToToolApproval: ReturnType<typeof vi.fn>;
  emit: (event: HarnessEvent) => void;
  unsubscribeCalled: boolean;
}

function createMockSession(): MockSession {
  const session: MockSession = {
    listeners: [],
    unsubscribeCalled: false,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    respondToToolApproval: vi.fn(),
    emit: (event: HarnessEvent) => {
      for (const l of session.listeners) void l(event);
    },
  };
  session.subscribe.mockImplementation((listener: HarnessEventListener) => {
    session.listeners.push(listener);
    return () => {
      session.unsubscribeCalled = true;
      session.listeners = session.listeners.filter(l => l !== listener);
    };
  });
  return session;
}

function createMockHarness(session: MockSession) {
  return {
    id: 'test-harness',
    createSession: vi.fn().mockResolvedValue(session),
  } as any;
}

function makeMockMastra() {
  // A non-custom state adapter requires storage; provide a minimal memory store.
  const memoryStore = {} as any;
  return {
    getStorage: () => ({ getStore: () => memoryStore }),
    getServer: () => null,
  } as any;
}

function makeChatThread(adapter: any, overrides: Record<string, unknown> = {}) {
  return {
    id: 'channel-1:thread-1',
    channelId: 'channel-1',
    isDM: false,
    adapter,
    isSubscribed: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue({ id: 'm1', text: '' }),
    mentionUser: vi.fn((userId: string) => `<@${userId}>`),
    messages: (async function* () {})(),
    ...overrides,
  } as any;
}

const baseMessage = {
  id: 'message-1',
  text: 'hello harness',
  author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
  attachments: [],
} as any;

describe('HarnessChannels', () => {
  let session: MockSession;
  let harness: any;
  let channels: HarnessChannels;

  beforeEach(() => {
    session = createMockSession();
    harness = createMockHarness(session);
    channels = new HarnessChannels({
      harness,
      // Custom state adapter so initialize() doesn't require real storage.
      state: {} as any,
      adapters: {
        slack: createMockAdapter('slack'),
      },
    });
  });

  describe('input path', () => {
    it('routes an inbound message to session.sendMessage', async () => {
      const mastra = makeMockMastra();
      await channels.initialize(mastra);

      const chatThread = makeChatThread(channels.adapters.slack);
      await (channels as any).handleChatMessage(chatThread, baseMessage);

      expect(harness.createSession).toHaveBeenCalledTimes(1);
      expect(harness.createSession).toHaveBeenCalledWith({ resourceId: 'slack:channel-1:thread-1' });
      expect(session.sendMessage).toHaveBeenCalledTimes(1);
      expect(session.sendMessage).toHaveBeenCalledWith({ content: 'hello harness' });
    });

    it('uses a custom resolveResourceId when provided', async () => {
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
        resolveResourceId: async ({ message }) => `user:${message.author.userId}`,
      });
      await channels.initialize(makeMockMastra());

      const chatThread = makeChatThread(channels.adapters.slack);
      await (channels as any).handleChatMessage(chatThread, baseMessage);

      expect(harness.createSession).toHaveBeenCalledWith({ resourceId: 'user:user-1' });
    });

    it('opens the session subscription once per thread', async () => {
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleChatMessage(chatThread, baseMessage);
      await (channels as any).handleChatMessage(chatThread, { ...baseMessage, id: 'message-2', text: 'again' });

      expect(harness.createSession).toHaveBeenCalledTimes(1);
      expect(session.subscribe).toHaveBeenCalledTimes(1);
      expect(session.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('output path', () => {
    it('renders emitted assistant text to the thread', async () => {
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);
      await (channels as any).handleChatMessage(chatThread, baseMessage);

      session.emit({
        type: 'message_update',
        message: { id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'Hi there' }], createdAt: new Date() },
      });
      // Let the async renderer settle.
      await new Promise(r => setTimeout(r, 0));

      expect(chatThread.post).toHaveBeenCalledWith('Hi there');
    });
  });

  describe('approval action', () => {
    it('responds to the session gate on Approve click', async () => {
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);
      await (channels as any).handleChatMessage(chatThread, baseMessage);

      await (channels as any).handleApprovalAction({ actionId: 'tool_approve:tc1', thread: chatThread });

      expect(session.respondToToolApproval).toHaveBeenCalledWith({ decision: 'approve', toolCallId: 'tc1' });
    });

    it('responds with decline on Deny click', async () => {
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);
      await (channels as any).handleChatMessage(chatThread, baseMessage);

      await (channels as any).handleApprovalAction({ actionId: 'tool_deny:tc2', thread: chatThread });

      expect(session.respondToToolApproval).toHaveBeenCalledWith({ decision: 'decline', toolCallId: 'tc2' });
    });

    it('ignores actions for threads with no active session', async () => {
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleApprovalAction({ actionId: 'tool_approve:tc3', thread: chatThread });

      expect(session.respondToToolApproval).not.toHaveBeenCalled();
    });
  });

  describe('teardown', () => {
    it('unsubscribes all sessions on close()', async () => {
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);
      await (channels as any).handleChatMessage(chatThread, baseMessage);

      channels.close();

      expect(session.unsubscribeCalled).toBe(true);
      expect((channels as any).bindings.size).toBe(0);
    });
  });

  describe('harness ownership', () => {
    it('binds a later-injected harness via __setHarness', async () => {
      const standalone = new HarnessChannels({
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
      });
      standalone.__setHarness(harness);
      await standalone.initialize(makeMockMastra());

      const chatThread = makeChatThread(standalone.adapters.slack);
      await (standalone as any).handleChatMessage(chatThread, baseMessage);

      expect(harness.createSession).toHaveBeenCalledTimes(1);
      expect(session.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('throws when used without a bound harness', async () => {
      const standalone = new HarnessChannels({
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
      });
      await standalone.initialize(makeMockMastra());

      const chatThread = makeChatThread(standalone.adapters.slack);
      await expect((standalone as any).ensureBinding(chatThread, 'res-1')).rejects.toThrow(/not bound to a Harness/);
    });

    it('exposes harness-scoped webhook routes', () => {
      harness.id = 'support';
      channels.__setHarness(harness);
      const routes = channels.getWebhookRoutes();

      expect(routes).toHaveLength(1);
      expect(routes[0]?.path).toBe('/api/harnesses/support/channels/slack/webhook');
      expect(routes[0]?.method).toBe('POST');
    });

    it('returns no routes when unbound', () => {
      const standalone = new HarnessChannels({
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
      });
      expect(standalone.getWebhookRoutes()).toEqual([]);
    });
  });

  describe('acknowledgment', () => {
    const flush = () => new Promise(r => setTimeout(r, 0));

    it('reacts to the triggering message once on a new session, not on continuations', async () => {
      const adapter = createMockAdapter('slack');
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: adapter },
        acknowledge: { reaction: 'eyes' },
      });
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleChatMessage(chatThread, baseMessage);
      await flush();

      expect(adapter.addReaction).toHaveBeenCalledTimes(1);
      expect(adapter.addReaction).toHaveBeenCalledWith('channel-1:thread-1', 'message-1', 'eyes');

      // A second message on the same thread reuses the session — no re-react.
      await (channels as any).handleChatMessage(chatThread, { ...baseMessage, id: 'message-2' });
      await flush();

      expect(adapter.addReaction).toHaveBeenCalledTimes(1);
    });

    it('posts sessionStartMessage once on a new session, not on continuations', async () => {
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
        acknowledge: { sessionStartMessage: '🧵 Started a new session.' },
      });
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleChatMessage(chatThread, baseMessage);
      await flush();

      expect(chatThread.post).toHaveBeenCalledWith('🧵 Started a new session.');
      const startPosts = chatThread.post.mock.calls.filter((c: unknown[]) => c[0] === '🧵 Started a new session.');
      expect(startPosts).toHaveLength(1);

      await (channels as any).handleChatMessage(chatThread, { ...baseMessage, id: 'message-2' });
      await flush();

      const startPostsAfter = chatThread.post.mock.calls.filter((c: unknown[]) => c[0] === '🧵 Started a new session.');
      expect(startPostsAfter).toHaveLength(1);
    });

    it('resolves sessionStartMessage from a function with session context', async () => {
      const resolver = vi.fn(({ resourceId }: { resourceId: string }) => `Session for ${resourceId}`);
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
        acknowledge: { sessionStartMessage: resolver },
      });
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleChatMessage(chatThread, baseMessage);
      await flush();

      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resolver).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'slack', resourceId: 'slack:channel-1:thread-1' }),
      );
      expect(chatThread.post).toHaveBeenCalledWith('Session for slack:channel-1:thread-1');
    });

    it('does not react or post extra when acknowledge is not configured (default)', async () => {
      const adapter = createMockAdapter('slack');
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: adapter },
      });
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleChatMessage(chatThread, baseMessage);
      await flush();

      expect(adapter.addReaction).not.toHaveBeenCalled();
      expect(chatThread.post).not.toHaveBeenCalled();
      expect(session.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('still forwards the message when the adapter has no addReaction', async () => {
      const adapter = createMockAdapter('slack');
      delete adapter.addReaction;
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: adapter },
        acknowledge: { reaction: 'eyes' },
      });
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await expect((channels as any).handleChatMessage(chatThread, baseMessage)).resolves.toBeUndefined();
      await flush();

      expect(session.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('still forwards the message when addReaction rejects (best-effort)', async () => {
      const adapter = createMockAdapter('slack');
      adapter.addReaction = vi.fn().mockRejectedValue(new Error('slack down'));
      channels = new HarnessChannels({
        harness,
        state: {} as any,
        adapters: { slack: adapter },
        acknowledge: { reaction: 'eyes' },
      });
      await channels.initialize(makeMockMastra());
      const chatThread = makeChatThread(channels.adapters.slack);

      await (channels as any).handleChatMessage(chatThread, baseMessage);
      await flush();

      expect(session.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
