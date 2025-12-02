import { describe, it, expect } from 'vitest';

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
  describe('Basic API', () => {
    it('returns a callable function', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(typeof toolSearch).toBe('function');
      expect(toolSearch.search).toBeDefined();
      expect(toolSearch.loadTool).toBeDefined();
      expect(toolSearch.getToolIds).toBeDefined();
    });

    it('calling toolSearch() returns tools object with search tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const tools = toolSearch();

      expect(tools.tool_search).toBeDefined();
      expect(tools.tool_search.id).toBe('tool_search');
      expect(Object.keys(tools)).toEqual(['tool_search']); // Only search tool initially
    });

    it('getToolIds returns all searchable tool IDs', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const ids = toolSearch.getToolIds();

      expect(ids).toContain('github.createPR');
      expect(ids).toContain('slack.sendMessage');
      expect(ids).toContain('jira.createTicket');
      expect(ids.length).toBe(5);
    });
  });

  describe('Search and load flow', () => {
    it('search tool loads matching tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });
      const threadId = 'thread-1';

      // Initially only search tool
      let tools = toolSearch(threadId);
      expect(Object.keys(tools)).toEqual(['tool_search']);

      // Call search tool
      const searchTool = tools.tool_search;
      const result = await searchTool.execute!({ query: 'github pull request' }, {} as any);

      expect(result.success).toBe(true);
      expect(result.loadedTools.length).toBeGreaterThan(0);
      expect(result.loadedTools[0].id).toBe('github.createPR');

      // Now tools include the loaded one
      tools = toolSearch(threadId);
      expect(tools['github.createPR']).toBeDefined();
    });

    it('loaded tools can be executed directly', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });
      const threadId = 'thread-1';

      // Search and load
      const tools = toolSearch(threadId);
      await tools.tool_search.execute!({ query: 'slack message' }, {} as any);

      // Get updated tools and call the loaded tool
      const updatedTools = toolSearch(threadId);
      const slackTool = updatedTools['slack.sendMessage'];
      expect(slackTool).toBeDefined();

      const result = await slackTool.execute!({ channel: '#dev', message: 'Hello!' }, {} as any);
      expect(result.sent).toBe(true);
      expect(result.channel).toBe('#dev');
    });

    it('different threads have isolated loaded tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Thread 1 loads GitHub tool
      const tools1 = toolSearch('thread-1');
      await tools1.tool_search.execute!({ query: 'github' }, {} as any);

      // Thread 2 loads Slack tool
      const tools2 = toolSearch('thread-2');
      await tools2.tool_search.execute!({ query: 'slack' }, {} as any);

      // Check isolation
      const thread1Tools = toolSearch('thread-1');
      const thread2Tools = toolSearch('thread-2');

      expect(thread1Tools['github.createPR']).toBeDefined();
      expect(thread1Tools['slack.sendMessage']).toBeUndefined();

      expect(thread2Tools['slack.sendMessage']).toBeDefined();
      expect(thread2Tools['github.createPR']).toBeUndefined();
    });
  });

  describe('Manual loading', () => {
    it('loadTool adds tool for a thread', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.loadTool('github.createPR', 'thread-1');

      const tools = toolSearch('thread-1');
      expect(tools['github.createPR']).toBeDefined();
    });

    it('unloadTool removes tool from thread', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.loadTool('github.createPR', 'thread-1');
      expect(toolSearch('thread-1')['github.createPR']).toBeDefined();

      toolSearch.unloadTool('github.createPR', 'thread-1');
      expect(toolSearch('thread-1')['github.createPR']).toBeUndefined();
    });

    it('unloadAll clears all loaded tools for thread', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.loadTool('github.createPR', 'thread-1');
      toolSearch.loadTool('slack.sendMessage', 'thread-1');
      expect(toolSearch.getLoadedToolIds('thread-1').length).toBe(2);

      toolSearch.unloadAll('thread-1');
      expect(toolSearch.getLoadedToolIds('thread-1').length).toBe(0);
    });
  });

  describe('Search methods', () => {
    it('BM25 search (default)', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'bm25' });

      const results = await toolSearch.search('create pull request github');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('github.createPR');
    });

    it('Regex search', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

      const results = await toolSearch.search('GitHub');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('github.createPR');
    });

    it('Embedding search requires embedder', async () => {
      await expect(createToolSearch({ tools: allTools, method: 'embedding' })).rejects.toThrow(
        'Embedder is required',
      );
    });
  });

  describe('Configuration', () => {
    it('custom search tool ID', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, id: 'find_tool' });

      const tools = toolSearch();
      expect(tools.find_tool).toBeDefined();
      expect(tools.tool_search).toBeUndefined();
    });

    it('custom description', async () => {
      const toolSearch = await createToolSearch({
        tools: allTools,
        description: 'Find the perfect tool',
      });

      const tools = toolSearch();
      expect(tools.tool_search.description).toBe('Find the perfect tool');
    });

    it('minScore filters results', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, minScore: 0.99 });

      const results = await toolSearch.search('something random');

      expect(results.length).toBe(0);
    });
  });

  describe('Real-world scenario', () => {
    it('simulates multi-turn conversation with tool discovery', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });
      const threadId = 'conversation-123';

      // Turn 1: User asks to create a PR, agent searches for tools
      let tools = toolSearch(threadId);
      expect(Object.keys(tools)).toEqual(['tool_search']);

      const searchResult = await tools.tool_search.execute!({ query: 'github pull request' }, {} as any);
      expect(searchResult.success).toBe(true);
      expect(searchResult.message).toContain('Loaded');

      // Turn 2: Agent now has access to the GitHub tool
      tools = toolSearch(threadId);
      expect(tools['github.createPR']).toBeDefined();

      const prResult = await tools['github.createPR'].execute!({ title: 'Fix bug #123' }, {} as any);
      expect(prResult.prUrl).toContain('Fix bug');

      // Turn 3: User asks to notify team, agent searches again
      const slackSearch = await tools.tool_search.execute!({ query: 'slack notify' }, {} as any);
      expect(slackSearch.success).toBe(true);

      // Turn 4: Both tools now available
      tools = toolSearch(threadId);
      expect(tools['github.createPR']).toBeDefined();
      expect(tools['slack.sendMessage']).toBeDefined();

      const slackResult = await tools['slack.sendMessage'].execute!(
        { channel: '#dev', message: 'PR created!' },
        {} as any,
      );
      expect(slackResult.sent).toBe(true);
    });
  });

  describe('Usage with Agent', () => {
    it('can be passed to agent toolsets', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });
      const threadId = 'thread-1';

      // Simulate how it would be used with agent.generate
      const toolsets = { available: toolSearch(threadId) };

      expect(toolsets.available.tool_search).toBeDefined();
    });

    it('without threadId uses global state', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Load tool without threadId
      toolSearch.loadTool('github.createPR');

      // Access without threadId sees the loaded tool
      const tools = toolSearch();
      expect(tools['github.createPR']).toBeDefined();
    });
  });
});
