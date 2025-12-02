import { describe, it, expect } from 'vitest';

import { createTool } from './tool';
import { createToolSearch } from './tool-search';

// Mock tools for testing
const createPRTool = createTool({
  id: 'github.createPR',
  description: 'Create a pull request on GitHub with title and description',
  inputSchema: {
    type: 'object',
    properties: { title: { type: 'string' } },
  } as any,
  execute: async ({ title }: { title: string }) => ({ prUrl: `https://github.com/pr/${title}` }),
});

const sendSlackTool = createTool({
  id: 'slack.sendMessage',
  description: 'Send a message to a Slack channel',
  inputSchema: {
    type: 'object',
    properties: { channel: { type: 'string' }, message: { type: 'string' } },
  } as any,
  execute: async ({ channel, message }: { channel: string; message: string }) => ({ sent: true, channel, message }),
});

const createTicketTool = createTool({
  id: 'jira.createTicket',
  description: 'Create a Jira ticket for issue tracking',
  inputSchema: {
    type: 'object',
    properties: { summary: { type: 'string' } },
  } as any,
  execute: async ({ summary }: { summary: string }) => ({ ticketId: `JIRA-${summary.slice(0, 5)}` }),
});

const weatherTool = createTool({
  id: 'weather.get',
  description: 'Get current weather information for a location',
  execute: async ({ location }: { location: string }) => ({ location, temp: 72 }),
});

const allTools = {
  'github.createPR': createPRTool,
  'slack.sendMessage': sendSlackTool,
  'jira.createTicket': createTicketTool,
  'weather.get': weatherTool,
};

describe('createToolSearch', () => {
  describe('Basic API', () => {
    it('returns a callable function', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(typeof toolSearch).toBe('function');
      expect(toolSearch.search).toBeDefined();
      expect(toolSearch.load).toBeDefined();
      expect(toolSearch.reset).toBeDefined();
    });

    it('calling toolSearch() returns tools with search tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const tools = toolSearch();

      expect(tools.tool_search).toBeDefined();
      expect(Object.keys(tools)).toEqual(['tool_search']); // Only search tool initially
    });

    it('available() returns all searchable tool IDs', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(toolSearch.available()).toContain('github.createPR');
      expect(toolSearch.available()).toContain('slack.sendMessage');
      expect(toolSearch.available().length).toBe(4);
    });
  });

  describe('Search and load flow', () => {
    it('search tool loads matching tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Initially only search tool
      expect(Object.keys(toolSearch())).toEqual(['tool_search']);

      // Call search tool
      const tools = toolSearch();
      const result = await tools.tool_search.execute!({ query: 'github pull request' }, {} as any);

      expect(result.success).toBe(true);
      expect(result.loadedTools[0].id).toBe('github.createPR');

      // Now github tool is available
      expect(toolSearch()['github.createPR']).toBeDefined();
    });

    it('loaded tools can be executed', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Search and load
      await toolSearch().tool_search.execute!({ query: 'slack message' }, {} as any);

      // Execute loaded tool
      const tools = toolSearch();
      const result = await tools['slack.sendMessage'].execute!({ channel: '#dev', message: 'Hi!' }, {} as any);

      expect(result.sent).toBe(true);
      expect(result.channel).toBe('#dev');
    });

    it('reset() clears loaded tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Load some tools
      await toolSearch().tool_search.execute!({ query: 'github' }, {} as any);
      expect(toolSearch()['github.createPR']).toBeDefined();

      // Reset
      toolSearch.reset();

      // Tools are deferred again
      expect(toolSearch()['github.createPR']).toBeUndefined();
      expect(Object.keys(toolSearch())).toEqual(['tool_search']);
    });
  });

  describe('Manual loading', () => {
    it('load() adds a tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');

      expect(toolSearch()['github.createPR']).toBeDefined();
      expect(toolSearch.loaded()).toContain('github.createPR');
    });

    it('load() returns false for unknown tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(toolSearch.load('unknown.tool')).toBe(false);
    });
  });

  describe('Search methods', () => {
    it('BM25 search (default)', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'bm25' });

      const results = await toolSearch.search('create pull request github');

      expect(results[0].id).toBe('github.createPR');
    });

    it('Regex search', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

      const results = await toolSearch.search('Jira');

      expect(results[0].id).toBe('jira.createTicket');
    });

    it('Embedding search requires embedder', async () => {
      await expect(createToolSearch({ tools: allTools, method: 'embedding' })).rejects.toThrow('Embedder is required');
    });
  });

  describe('Configuration', () => {
    it('custom search tool ID', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, id: 'find_tool' });

      expect(toolSearch().find_tool).toBeDefined();
      expect(toolSearch().tool_search).toBeUndefined();
    });

    it('custom description', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, description: 'Find tools' });

      expect(toolSearch().tool_search.description).toBe('Find tools');
    });
  });

  describe('Real-world flow', () => {
    it('simulates a complete request cycle', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Start of request - only search tool available
      let tools = toolSearch();
      expect(Object.keys(tools)).toEqual(['tool_search']);

      // Agent searches for GitHub tools
      await tools.tool_search.execute!({ query: 'github PR' }, {} as any);

      // GitHub tool now available
      tools = toolSearch();
      expect(tools['github.createPR']).toBeDefined();

      // Agent uses it
      const prResult = await tools['github.createPR'].execute!({ title: 'Bug fix' }, {} as any);
      expect(prResult.prUrl).toContain('Bug fix');

      // Agent searches for Slack
      await tools.tool_search.execute!({ query: 'slack notify' }, {} as any);

      // Both tools available
      tools = toolSearch();
      expect(tools['github.createPR']).toBeDefined();
      expect(tools['slack.sendMessage']).toBeDefined();

      // End of request - reset for next request
      toolSearch.reset();
      expect(Object.keys(toolSearch())).toEqual(['tool_search']);
    });
  });
});
