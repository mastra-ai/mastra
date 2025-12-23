import { describe, it, expect } from 'vitest';

import { createTool } from './tool';
import { createToolSearch } from './tool-search';

// ============================================================================
// Test Tools
// ============================================================================

const createPRTool = createTool({
  id: 'github.createPR',
  description: 'Create a pull request on GitHub with title and description',
  inputSchema: {
    type: 'object',
    properties: { title: { type: 'string' }, description: { type: 'string' } },
  } as any,
  execute: async ({ title }: { title: string }) => ({ prUrl: `https://github.com/pr/${title}` }),
});

const listIssuesTool = createTool({
  id: 'github.listIssues',
  description: 'List all open issues in a GitHub repository',
  inputSchema: {
    type: 'object',
    properties: { repo: { type: 'string' } },
  } as any,
  execute: async ({ repo }: { repo: string }) => ({ issues: [`Issue in ${repo}`] }),
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
  description: 'Create a Jira ticket for issue tracking and project management',
  inputSchema: {
    type: 'object',
    properties: { summary: { type: 'string' }, priority: { type: 'string' } },
  } as any,
  execute: async ({ summary }: { summary: string }) => ({ ticketId: `JIRA-${summary.slice(0, 5)}` }),
});

const weatherTool = createTool({
  id: 'weather.get',
  description: 'Get current weather information for a location including temperature and conditions',
  execute: async ({ location }: { location: string }) => ({ location, temp: 72, conditions: 'sunny' }),
});

const calculatorTool = createTool({
  id: 'math.calculate',
  description: 'Perform mathematical calculations and arithmetic operations',
  execute: async ({ expression }: { expression: string }) => ({ result: eval(expression) }),
});

const allTools = {
  'github.createPR': createPRTool,
  'github.listIssues': listIssuesTool,
  'slack.sendMessage': sendSlackTool,
  'jira.createTicket': createTicketTool,
  'weather.get': weatherTool,
  'math.calculate': calculatorTool,
};

// ============================================================================
// Tests
// ============================================================================

describe('createToolSearch', () => {
  describe('Initialization', () => {
    it('returns synchronously (no await needed)', () => {
      // No await - it's sync!
      const toolSearch = createToolSearch({ tools: allTools });

      expect(toolSearch).toBeDefined();
      expect(typeof toolSearch.search).toBe('function');
    });

    it('has helper methods', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      expect(typeof toolSearch.search).toBe('function');
      expect(typeof toolSearch.load).toBe('function');
      expect(typeof toolSearch.reset).toBe('function');
      expect(typeof toolSearch.loaded).toBe('function');
      expect(typeof toolSearch.available).toBe('function');
    });

    it('indexes all provided tools', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      const available = toolSearch.available();
      expect(available).toHaveLength(6);
      expect(available).toContain('github.createPR');
      expect(available).toContain('slack.sendMessage');
    });

    it('initially contains only the search tool', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      expect(toolSearch.tool_search).toBeDefined();
      expect(toolSearch['github.createPR']).toBeUndefined();
    });

    it('throws when embedding method used without embedder', () => {
      expect(() => createToolSearch({ tools: allTools, method: 'embedding' })).toThrow(
        'Embedder is required when using embedding search method',
      );
    });
  });

  describe('Can be passed directly to toolsets', () => {
    it('works as a tools object', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      // Simulate passing to agent.generate({ toolsets: { available: toolSearch } })
      const toolsets = { available: toolSearch };

      expect(toolsets.available.tool_search).toBeDefined();
      expect(toolsets.available.tool_search.execute).toBeDefined();
    });

    it('Object.keys returns current tools', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      expect(Object.keys(toolSearch)).toEqual(['tool_search']);

      toolSearch.load('github.createPR');
      expect(Object.keys(toolSearch)).toContain('tool_search');
      expect(Object.keys(toolSearch)).toContain('github.createPR');
    });
  });

  describe('Search Methods', () => {
    describe('BM25 (default)', () => {
      it('ranks results by term frequency and relevance', async () => {
        const toolSearch = createToolSearch({ tools: allTools, method: 'bm25' });

        const results = await toolSearch.search('github pull request');
        expect(results[0].id).toBe('github.createPR');
      });

      it('finds tools with partial matches', async () => {
        const toolSearch = createToolSearch({ tools: allTools });

        const results = await toolSearch.search('message channel');
        expect(results.some(r => r.id === 'slack.sendMessage')).toBe(true);
      });
    });

    describe('Regex', () => {
      it('finds exact substring matches', async () => {
        const toolSearch = createToolSearch({ tools: allTools, method: 'regex' });

        const results = await toolSearch.search('GitHub');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.id.includes('github'))).toBe(true);
      });

      it('is case-insensitive', async () => {
        const toolSearch = createToolSearch({ tools: allTools, method: 'regex' });

        const lower = await toolSearch.search('jira');
        const upper = await toolSearch.search('JIRA');
        expect(lower[0].id).toBe(upper[0].id);
      });
    });
  });

  describe('Tool Loading via Search', () => {
    it('search tool loads matching tools', async () => {
      const toolSearch = createToolSearch({ tools: allTools });

      expect(toolSearch.loaded()).toHaveLength(0);

      const result = await toolSearch.tool_search.execute!({ query: 'github pull request' }, {} as any);

      expect(result.success).toBe(true);
      expect(result.loadedTools[0].id).toBe('github.createPR');
      expect(toolSearch.loaded()).toContain('github.createPR');
    });

    it('loaded tools become accessible', async () => {
      const toolSearch = createToolSearch({ tools: allTools });

      // Before search
      expect(toolSearch['github.createPR']).toBeUndefined();

      // Search
      await toolSearch.tool_search.execute!({ query: 'github' }, {} as any);

      // After search - tool is accessible
      expect(toolSearch['github.createPR']).toBeDefined();
    });

    it('multiple searches accumulate loaded tools', async () => {
      const toolSearch = createToolSearch({ tools: allTools });

      await toolSearch.tool_search.execute!({ query: 'github' }, {} as any);
      await toolSearch.tool_search.execute!({ query: 'slack' }, {} as any);

      expect(toolSearch['github.createPR']).toBeDefined();
      expect(toolSearch['slack.sendMessage']).toBeDefined();
    });
  });

  describe('Manual Loading', () => {
    it('load() adds a specific tool', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      expect(toolSearch['weather.get']).toBeUndefined();

      const success = toolSearch.load('weather.get');
      expect(success).toBe(true);
      expect(toolSearch['weather.get']).toBeDefined();
    });

    it('load() returns false for unknown tools', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      const success = toolSearch.load('nonexistent.tool');
      expect(success).toBe(false);
    });
  });

  describe('Reset', () => {
    it('reset() clears all loaded tools', () => {
      const toolSearch = createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');
      toolSearch.load('slack.sendMessage');
      expect(toolSearch.loaded()).toHaveLength(2);

      toolSearch.reset();

      expect(toolSearch.loaded()).toHaveLength(0);
      expect(toolSearch['github.createPR']).toBeUndefined();
    });
  });

  describe('Tool Execution', () => {
    it('loaded tools can be executed', async () => {
      const toolSearch = createToolSearch({ tools: allTools });

      await toolSearch.tool_search.execute!({ query: 'slack message' }, {} as any);

      const result = await toolSearch['slack.sendMessage'].execute!({ channel: '#dev', message: 'Hello!' }, {} as any);

      expect(result.sent).toBe(true);
      expect(result.channel).toBe('#dev');
    });
  });

  describe('Configuration', () => {
    it('custom search tool ID', () => {
      const toolSearch = createToolSearch({ tools: allTools, id: 'find_tools' });

      expect(toolSearch.find_tools).toBeDefined();
      expect(toolSearch.tool_search).toBeUndefined();
    });

    it('custom search tool description', () => {
      const toolSearch = createToolSearch({
        tools: allTools,
        description: 'Find the right tool for your task',
      });

      expect(toolSearch.tool_search.description).toBe('Find the right tool for your task');
    });

    it('topK limits number of results', async () => {
      const toolSearch = createToolSearch({ tools: allTools, topK: 2 });

      const results = await toolSearch.search('tool');
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Real-World Scenarios', () => {
    it('simulates complete request cycle', async () => {
      const toolSearch = createToolSearch({ tools: allTools });

      // Start: only search tool
      expect(Object.keys(toolSearch)).toEqual(['tool_search']);

      // Agent searches for relevant tools
      const searchResult = await toolSearch.tool_search.execute!({ query: 'create pull request github' }, {} as any);
      expect(searchResult.success).toBe(true);

      // Now GitHub tools are available
      expect(toolSearch['github.createPR']).toBeDefined();

      // Agent executes the tool
      const prResult = await toolSearch['github.createPR'].execute!({ title: 'Add new feature' }, {} as any);
      expect(prResult.prUrl).toContain('Add new feature');

      // User asks for Slack
      await toolSearch.tool_search.execute!({ query: 'slack notify message' }, {} as any);

      // Both tools now available
      expect(toolSearch['github.createPR']).toBeDefined();
      expect(toolSearch['slack.sendMessage']).toBeDefined();

      // End of request: reset
      toolSearch.reset();
      expect(Object.keys(toolSearch)).toEqual(['tool_search']);
    });

    it('works with large tool sets', async () => {
      const manyTools: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        manyTools[`tool_${i}`] = createTool({
          id: `tool_${i}`,
          description: `Tool number ${i} for testing category ${i % 10}`,
          execute: async () => ({ id: i }),
        });
      }

      const toolSearch = createToolSearch({ tools: manyTools, topK: 5 });

      const results = await toolSearch.search('category 5');
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});
