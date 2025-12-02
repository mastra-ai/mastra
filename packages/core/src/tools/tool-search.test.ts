import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTool } from './tool';
import { createToolSearch } from './tool-search';

// Mock tools for testing
const createPRTool = createTool({
  id: 'github.createPR',
  description: 'Create a pull request on GitHub with title and description',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
    },
  } as any,
  execute: async ({ title }: { title: string }) => ({ prUrl: `https://github.com/pr/${title}` }),
});

const sendSlackTool = createTool({
  id: 'slack.sendMessage',
  description: 'Send a message to a Slack channel',
  inputSchema: {
    type: 'object',
    properties: {
      channel: { type: 'string' },
      message: { type: 'string' },
    },
  } as any,
  execute: async ({ channel, message }: { channel: string; message: string }) => ({
    sent: true,
    channel,
    message,
  }),
});

const createTicketTool = createTool({
  id: 'jira.createTicket',
  description: 'Create a Jira ticket for issue tracking',
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      priority: { type: 'string' },
    },
  } as any,
  execute: async ({ summary }: { summary: string }) => ({ ticketId: `JIRA-${summary.slice(0, 5)}` }),
});

const weatherTool = createTool({
  id: 'weather.get',
  description: 'Get current weather information for a location',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string' },
    },
  } as any,
  execute: async ({ location }: { location: string }) => ({ location, temp: 72, conditions: 'sunny' }),
});

const searchWebTool = createTool({
  id: 'web.search',
  description: 'Search the web for information',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
  } as any,
  execute: async ({ query }: { query: string }) => ({ results: [`Result for: ${query}`] }),
});

const allTools = {
  'github.createPR': createPRTool,
  'slack.sendMessage': sendSlackTool,
  'jira.createTicket': createTicketTool,
  'weather.get': weatherTool,
  'web.search': searchWebTool,
};

describe('createToolSearch', () => {
  describe('BM25 search (default)', () => {
    it('creates a search tool with correct properties', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(toolSearch.id).toBe('tool_search');
      expect(toolSearch.description).toContain('Search for and execute');
      expect(toolSearch.execute).toBeDefined();
    });

    it('finds and executes GitHub tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const result = await toolSearch.execute!(
        { query: 'create pull request', input: { title: 'Fix bug' } },
        {} as any,
      );

      expect(result.success).toBe(true);
      expect(result.toolUsed.id).toBe('github.createPR');
      expect(result.result.prUrl).toContain('Fix bug');
    });

    it('finds and executes Slack tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const result = await toolSearch.execute!(
        { query: 'send slack message', input: { channel: '#general', message: 'Hello!' } },
        {} as any,
      );

      expect(result.success).toBe(true);
      expect(result.toolUsed.id).toBe('slack.sendMessage');
      expect(result.result.sent).toBe(true);
      expect(result.result.message).toBe('Hello!');
    });

    it('finds weather tool by keyword match', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const result = await toolSearch.execute!({ query: 'weather location', input: { location: 'NYC' } }, {} as any);

      expect(result.success).toBe(true);
      expect(result.toolUsed.id).toBe('weather.get');
      expect(result.result.temp).toBe(72);
    });

    it('returns error when no tool matches', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, minScore: 0.9 });

      const result = await toolSearch.execute!({ query: 'zzzzzzz' }, {} as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No matching tool');
    });
  });

  describe('Regex search', () => {
    it('finds tool by exact substring match', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

      const result = await toolSearch.execute!({ query: 'GitHub', input: { title: 'Test' } }, {} as any);

      expect(result.success).toBe(true);
      expect(result.toolUsed.id).toBe('github.createPR');
    });

    it('finds tool case-insensitively', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

      const result = await toolSearch.execute!({ query: 'JIRA', input: { summary: 'Bug' } }, {} as any);

      expect(result.success).toBe(true);
      expect(result.toolUsed.id).toBe('jira.createTicket');
    });
  });

  describe('Embedding search', () => {
    // Mock embedding model
    const mockEmbedder = {
      specificationVersion: 'v2',
      modelId: 'test-model',
      provider: 'test',
    };

    beforeEach(() => {
      vi.mock('ai-v5', () => ({
        embed: vi.fn(async ({ value }: { value: string }) => {
          // Simple mock: create deterministic embeddings based on content
          const words: Record<string, number[]> = {
            github: [1, 0, 0, 0, 0],
            pull: [0.9, 0.1, 0, 0, 0],
            request: [0.8, 0.2, 0, 0, 0],
            slack: [0, 1, 0, 0, 0],
            message: [0, 0.9, 0.1, 0, 0],
            jira: [0, 0, 1, 0, 0],
            ticket: [0, 0, 0.9, 0.1, 0],
            weather: [0, 0, 0, 1, 0],
            temperature: [0, 0, 0, 0.95, 0.05],
            web: [0, 0, 0, 0, 1],
            search: [0, 0, 0, 0, 0.9],
          };

          const lowerValue = value.toLowerCase();
          const embedding = [0, 0, 0, 0, 0];

          for (const [word, vec] of Object.entries(words)) {
            if (lowerValue.includes(word)) {
              for (let i = 0; i < 5; i++) {
                embedding[i] += vec[i]!;
              }
            }
          }

          // Normalize
          const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
          return { embedding: embedding.map(v => v / norm) };
        }),
      }));
    });

    it('requires embedder when using embedding method', async () => {
      await expect(createToolSearch({ tools: allTools, method: 'embedding' })).rejects.toThrow(
        'Embedder is required',
      );
    });

    it('finds tools using semantic similarity', async () => {
      const toolSearch = await createToolSearch({
        tools: allTools,
        method: 'embedding',
        embedder: mockEmbedder as any,
        minScore: 0,
      });

      const result = await toolSearch.execute!({ query: 'github PR', input: { title: 'Test' } }, {} as any);

      expect(result.success).toBe(true);
      expect(result.toolUsed.id).toBe('github.createPR');
    });
  });

  describe('Configuration options', () => {
    it('uses custom tool ID', async () => {
      const toolSearch = await createToolSearch({
        tools: allTools,
        id: 'find_tool',
      });

      expect(toolSearch.id).toBe('find_tool');
    });

    it('uses custom description', async () => {
      const toolSearch = await createToolSearch({
        tools: allTools,
        description: 'Find the perfect tool',
      });

      expect(toolSearch.description).toBe('Find the perfect tool');
    });

    it('respects minScore threshold', async () => {
      const toolSearch = await createToolSearch({
        tools: allTools,
        minScore: 0.99,
      });

      const result = await toolSearch.execute!({ query: 'something random' }, {} as any);

      expect(result.success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('handles tool execution errors', async () => {
      const failingTool = createTool({
        id: 'failing.tool',
        description: 'A tool that fails',
        execute: async () => {
          throw new Error('Tool failed!');
        },
      });

      const toolSearch = await createToolSearch({
        tools: { 'failing.tool': failingTool },
      });

      const result = await toolSearch.execute!({ query: 'failing' }, {} as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool failed!');
      expect(result.toolUsed.id).toBe('failing.tool');
    });
  });

  describe('Usage with Agent', () => {
    it('can be passed directly to agent tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Simulate how it would be passed to Agent
      const agentTools = { toolSearch };

      expect(agentTools.toolSearch.id).toBe('tool_search');
      expect(agentTools.toolSearch.execute).toBeDefined();
    });

    it('can be combined with other tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });
      const alwaysAvailable = createTool({
        id: 'help',
        description: 'Get help',
        execute: async () => 'Help info',
      });

      // Simulate passing to Agent with other tools
      const agentTools = { help: alwaysAvailable, toolSearch };

      expect(Object.keys(agentTools)).toEqual(['help', 'toolSearch']);
    });
  });

  describe('Real-world scenario', () => {
    it('simulates agent finding and using the right tool', async () => {
      // User has 100+ tools but agent only gets the search tool
      const toolSearch = await createToolSearch({ tools: allTools });

      // Agent receives a request: "Create a GitHub PR for the bug fix"
      // Agent calls tool_search with a natural language query
      const step1 = await toolSearch.execute!(
        {
          query: 'create github pull request',
          input: { title: 'Bug fix PR', description: 'Fixes the login issue' },
        },
        {} as any,
      );

      expect(step1.success).toBe(true);
      expect(step1.toolUsed.id).toBe('github.createPR');
      expect(step1.result.prUrl).toContain('Bug fix PR');

      // Agent receives another request: "Let the team know on Slack"
      const step2 = await toolSearch.execute!(
        {
          query: 'send notification slack channel',
          input: { channel: '#dev', message: 'PR is ready for review!' },
        },
        {} as any,
      );

      expect(step2.success).toBe(true);
      expect(step2.toolUsed.id).toBe('slack.sendMessage');
      expect(step2.result.channel).toBe('#dev');
    });
  });
});
