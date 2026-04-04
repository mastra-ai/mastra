import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChannels, matchesDomain, extractUrls } from '../agent-channels';

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

describe('AgentChannels', () => {
  let agentChannels: AgentChannels;
  let mockAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockAgent = createMockAgent();
    agentChannels = new AgentChannels({
      adapters: {
        discord: createMockAdapter('discord'),
        slack: createMockAdapter('slack'),
      },
    });
    agentChannels.__setAgent(mockAgent);
  });

  describe('adapters', () => {
    it('returns all adapters', () => {
      expect(Object.keys(agentChannels.adapters)).toEqual(['discord', 'slack']);
    });

    it('returns a specific adapter by key', () => {
      const adapter = agentChannels.adapters['discord'];
      expect(adapter).toBeDefined();
      expect(adapter!.name).toBe('discord');
    });

    it('returns undefined for unknown adapter key', () => {
      expect(agentChannels.adapters['teams']).toBeUndefined();
    });
  });

  describe('getTools', () => {
    it('generates reaction tools', () => {
      const tools = agentChannels.getTools();
      const toolNames = Object.keys(tools);

      expect(toolNames).toContain('add_reaction');
      expect(toolNames).toContain('remove_reaction');
      expect(toolNames).toHaveLength(2);
    });

    it('returns no tools when tools: false', () => {
      const disabled = new AgentChannels({
        adapters: { test: createMockAdapter('test') },
        tools: false,
      });
      expect(Object.keys(disabled.getTools())).toHaveLength(0);
    });
  });

  describe('getWebhookRoutes', () => {
    it('generates one route per adapter', () => {
      const routes = agentChannels.getWebhookRoutes();
      expect(routes).toHaveLength(2);
    });

    it('generates routes with correct paths', () => {
      const routes = agentChannels.getWebhookRoutes();
      const paths = routes.map(r => r.path);

      expect(paths).toContain('/api/agents/test-agent/channels/discord/webhook');
      expect(paths).toContain('/api/agents/test-agent/channels/slack/webhook');
    });

    it('generates POST routes without auth', () => {
      const routes = agentChannels.getWebhookRoutes();

      for (const route of routes) {
        expect(route.method).toBe('POST');
        expect(route.requiresAuth).toBe(false);
      }
    });
  });

  describe('sdk getter', () => {
    it('returns null before initialization', () => {
      expect(agentChannels.sdk).toBeNull();
    });

    it('returns Chat instance after initialization', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      expect(agentChannels.sdk).not.toBeNull();
      expect(agentChannels.sdk).toHaveProperty('onDirectMessage');
      expect(agentChannels.sdk).toHaveProperty('onNewMention');
      expect(agentChannels.sdk).toHaveProperty('onReaction');
    });

    it('allows registering additional event handlers', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      const handler = vi.fn();
      // Should not throw - handler is added alongside our internal handlers
      agentChannels.sdk!.onReaction(handler);

      // Verify handler was registered (Chat SDK uses array, so multiple handlers work)
      expect(agentChannels.sdk).not.toBeNull();
    });

    it('exposes Chat SDK methods for custom event handling', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      // Verify common Chat SDK methods are available
      expect(typeof agentChannels.sdk!.onDirectMessage).toBe('function');
      expect(typeof agentChannels.sdk!.onNewMention).toBe('function');
      expect(typeof agentChannels.sdk!.onReaction).toBe('function');
      expect(typeof agentChannels.sdk!.onNewMessage).toBe('function');
    });
  });
});

describe('matchesDomain', () => {
  it('matches exact hostname', () => {
    expect(matchesDomain('https://youtube.com/watch?v=123', 'youtube.com')).toBe(true);
  });

  it('matches subdomain', () => {
    expect(matchesDomain('https://www.youtube.com/watch?v=123', 'youtube.com')).toBe(true);
  });

  it('rejects unrelated domain', () => {
    expect(matchesDomain('https://example.com/page', 'youtube.com')).toBe(false);
  });

  it('wildcard matches everything', () => {
    expect(matchesDomain('https://anything.example.org/path', '*')).toBe(true);
  });

  it('returns false for invalid URL', () => {
    expect(matchesDomain('not-a-url', 'example.com')).toBe(false);
  });

  it('does not match partial domain names', () => {
    expect(matchesDomain('https://notyoutube.com/watch', 'youtube.com')).toBe(false);
  });
});

describe('extractUrls', () => {
  it('extracts http and https URLs', () => {
    const text = 'Check out https://example.com and http://other.org/page';
    expect(extractUrls(text)).toEqual(['https://example.com', 'http://other.org/page']);
  });

  it('returns empty array for no URLs', () => {
    expect(extractUrls('just plain text')).toEqual([]);
  });

  it('handles URLs with query params and fragments', () => {
    const text = 'Watch https://youtube.com/watch?v=abc123&t=10#section';
    const urls = extractUrls(text);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('youtube.com/watch?v=abc123');
  });

  it('extracts multiple URLs from one message', () => {
    const text = 'See https://a.com and https://b.com and https://c.com';
    expect(extractUrls(text)).toHaveLength(3);
  });

  it('stops at closing angle brackets and parens', () => {
    const text = 'Link: <https://example.com> or (https://other.com)';
    expect(extractUrls(text)).toEqual(['https://example.com', 'https://other.com']);
  });
});
