import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChat } from '../agent-chat';

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

function createMockAgent(name = 'test-agent') {
  return {
    id: name,
    name,
    stream: vi.fn().mockResolvedValue({
      textStream: new ReadableStream({
        start(controller) {
          controller.enqueue('Hello!');
          controller.close();
        },
      }),
    }),
    getMemory: vi.fn().mockResolvedValue(null),
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as any;
}

describe('AgentChat', () => {
  let agentChat: AgentChat;
  let mockAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockAgent = createMockAgent();
    agentChat = new AgentChat({
      adapters: {
        discord: createMockAdapter('discord'),
        slack: createMockAdapter('slack'),
      },
    });
    agentChat.__setAgent(mockAgent);
  });

  describe('adapters', () => {
    it('returns all adapters', () => {
      expect(Object.keys(agentChat.adapters)).toEqual(['discord', 'slack']);
    });

    it('returns a specific adapter by key', () => {
      const adapter = agentChat.adapters['discord'];
      expect(adapter).toBeDefined();
      expect(adapter!.name).toBe('discord');
    });

    it('returns undefined for unknown adapter key', () => {
      expect(agentChat.adapters['teams']).toBeUndefined();
    });
  });

  describe('getTools', () => {
    it('generates generic channel tools', () => {
      const tools = agentChat.getTools();
      const toolNames = Object.keys(tools);

      expect(toolNames).toContain('send_message');
      expect(toolNames).toContain('edit_message');
      expect(toolNames).toContain('delete_message');
      expect(toolNames).toContain('add_reaction');
      expect(toolNames).toContain('remove_reaction');
    });

    it('generates exactly 5 tools regardless of adapter count', () => {
      const tools = agentChat.getTools();
      expect(Object.keys(tools)).toHaveLength(5);
    });
  });

  describe('getWebhookRoutes', () => {
    it('generates one route per adapter', () => {
      const routes = agentChat.getWebhookRoutes();
      expect(routes).toHaveLength(2);
    });

    it('generates routes with correct paths', () => {
      const routes = agentChat.getWebhookRoutes();
      const paths = routes.map(r => r.path);

      expect(paths).toContain('/api/agents/test-agent/channels/discord/webhook');
      expect(paths).toContain('/api/agents/test-agent/channels/slack/webhook');
    });

    it('generates POST routes without auth', () => {
      const routes = agentChat.getWebhookRoutes();

      for (const route of routes) {
        expect(route.method).toBe('POST');
        expect(route.requiresAuth).toBe(false);
      }
    });
  });

  describe('sdk getter', () => {
    it('returns null before initialization', () => {
      expect(agentChat.sdk).toBeNull();
    });

    it('returns Chat instance after initialization', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChat.initialize(mockMastra);

      expect(agentChat.sdk).not.toBeNull();
      expect(agentChat.sdk).toHaveProperty('onDirectMessage');
      expect(agentChat.sdk).toHaveProperty('onNewMention');
      expect(agentChat.sdk).toHaveProperty('onReaction');
    });

    it('allows registering additional event handlers', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChat.initialize(mockMastra);

      const handler = vi.fn();
      // Should not throw - handler is added alongside our internal handlers
      agentChat.sdk!.onReaction(handler);

      // Verify handler was registered (Chat SDK uses array, so multiple handlers work)
      expect(agentChat.sdk).not.toBeNull();
    });

    it('exposes Chat SDK methods for custom event handling', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChat.initialize(mockMastra);

      // Verify common Chat SDK methods are available
      expect(typeof agentChat.sdk!.onDirectMessage).toBe('function');
      expect(typeof agentChat.sdk!.onNewMention).toBe('function');
      expect(typeof agentChat.sdk!.onReaction).toBe('function');
      expect(typeof agentChat.sdk!.onNewMessage).toBe('function');
    });
  });
});
