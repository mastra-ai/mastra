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
    it('returns a callable function with helper methods', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(typeof toolSearch).toBe('function');
      expect(typeof toolSearch.search).toBe('function');
      expect(typeof toolSearch.load).toBe('function');
      expect(typeof toolSearch.reset).toBe('function');
      expect(typeof toolSearch.loaded).toBe('function');
      expect(typeof toolSearch.available).toBe('function');
    });

    it('indexes all provided tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const available = toolSearch.available();
      expect(available).toHaveLength(6);
      expect(available).toContain('github.createPR');
      expect(available).toContain('slack.sendMessage');
      expect(available).toContain('jira.createTicket');
    });

    it('initially returns only the search tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const tools = toolSearch();
      expect(Object.keys(tools)).toEqual(['tool_search']);
      expect(tools.tool_search.id).toBe('tool_search');
    });

    it('throws when embedding method used without embedder', async () => {
      await expect(createToolSearch({ tools: allTools, method: 'embedding' })).rejects.toThrow(
        'Embedder is required when using embedding search method',
      );
    });
  });

  describe('Search Methods', () => {
    describe('BM25 (default)', () => {
      it('ranks results by term frequency and relevance', async () => {
        const toolSearch = await createToolSearch({ tools: allTools, method: 'bm25' });

        const results = await toolSearch.search('github pull request');
        expect(results[0].id).toBe('github.createPR');
      });

      it('finds tools with partial matches', async () => {
        const toolSearch = await createToolSearch({ tools: allTools });

        const results = await toolSearch.search('message channel');
        expect(results.some(r => r.id === 'slack.sendMessage')).toBe(true);
      });

      it('returns empty for no matches with high minScore', async () => {
        const toolSearch = await createToolSearch({ tools: allTools, minScore: 0.99 });

        const results = await toolSearch.search('xyzabc123');
        expect(results).toHaveLength(0);
      });
    });

    describe('Regex', () => {
      it('finds exact substring matches', async () => {
        const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

        const results = await toolSearch.search('GitHub');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.id.includes('github'))).toBe(true);
      });

      it('is case-insensitive', async () => {
        const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

        const lower = await toolSearch.search('jira');
        const upper = await toolSearch.search('JIRA');
        expect(lower[0].id).toBe(upper[0].id);
      });

      it('handles special regex characters', async () => {
        const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

        // Should not throw, characters are escaped
        const results = await toolSearch.search('test.*pattern');
        expect(Array.isArray(results)).toBe(true);
      });
    });
  });

  describe('Tool Loading via Search', () => {
    it('search tool loads matching tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(toolSearch.loaded()).toHaveLength(0);

      const tools = toolSearch();
      const result = await tools.tool_search.execute!({ query: 'github pull request' }, {} as any);

      expect(result.success).toBe(true);
      expect(result.loadedTools.length).toBeGreaterThan(0);
      expect(result.loadedTools[0].id).toBe('github.createPR');
      expect(toolSearch.loaded()).toContain('github.createPR');
    });

    it('loaded tools appear in subsequent calls', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Before search
      expect(toolSearch()['github.createPR']).toBeUndefined();

      // Search
      await toolSearch().tool_search.execute!({ query: 'github' }, {} as any);

      // After search
      expect(toolSearch()['github.createPR']).toBeDefined();
    });

    it('multiple searches accumulate loaded tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      await toolSearch().tool_search.execute!({ query: 'github' }, {} as any);
      await toolSearch().tool_search.execute!({ query: 'slack' }, {} as any);

      const tools = toolSearch();
      expect(tools['github.createPR']).toBeDefined();
      expect(tools['slack.sendMessage']).toBeDefined();
    });

    it('returns helpful message when no tools found', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, minScore: 0.99 });

      const result = await toolSearch().tool_search.execute!({ query: 'xyznonexistent' }, {} as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No matching tools');
      expect(result.availableTools).toEqual(toolSearch.available());
    });
  });

  describe('Manual Loading', () => {
    it('load() adds a specific tool', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      expect(toolSearch()['weather.get']).toBeUndefined();

      const success = toolSearch.load('weather.get');
      expect(success).toBe(true);
      expect(toolSearch()['weather.get']).toBeDefined();
    });

    it('load() returns false for unknown tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      const success = toolSearch.load('nonexistent.tool');
      expect(success).toBe(false);
    });

    it('loaded() returns current loaded tool IDs', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');
      toolSearch.load('slack.sendMessage');

      const loaded = toolSearch.loaded();
      expect(loaded).toContain('github.createPR');
      expect(loaded).toContain('slack.sendMessage');
      expect(loaded).toHaveLength(2);
    });
  });

  describe('Reset', () => {
    it('reset() clears all loaded tools', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');
      toolSearch.load('slack.sendMessage');
      expect(toolSearch.loaded()).toHaveLength(2);

      toolSearch.reset();

      expect(toolSearch.loaded()).toHaveLength(0);
      expect(Object.keys(toolSearch())).toEqual(['tool_search']);
    });

    it('tools can be reloaded after reset', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');
      toolSearch.reset();
      toolSearch.load('slack.sendMessage');

      expect(toolSearch.loaded()).toEqual(['slack.sendMessage']);
    });
  });

  describe('Tool Execution', () => {
    it('loaded tools can be executed', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      await toolSearch().tool_search.execute!({ query: 'slack message' }, {} as any);

      const tools = toolSearch();
      const result = await tools['slack.sendMessage'].execute!({ channel: '#dev', message: 'Hello!' }, {} as any);

      expect(result.sent).toBe(true);
      expect(result.channel).toBe('#dev');
      expect(result.message).toBe('Hello!');
    });

    it('multiple loaded tools can be executed', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');
      toolSearch.load('jira.createTicket');

      const tools = toolSearch();

      const prResult = await tools['github.createPR'].execute!({ title: 'Fix bug' }, {} as any);
      expect(prResult.prUrl).toContain('Fix bug');

      const ticketResult = await tools['jira.createTicket'].execute!({ summary: 'Bug fix' }, {} as any);
      expect(ticketResult.ticketId).toBe('JIRA-Bug f');
    });
  });

  describe('Configuration', () => {
    it('custom search tool ID', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, id: 'find_tools' });

      const tools = toolSearch();
      expect(tools.find_tools).toBeDefined();
      expect(tools.tool_search).toBeUndefined();
    });

    it('custom search tool description', async () => {
      const toolSearch = await createToolSearch({
        tools: allTools,
        description: 'Find the right tool for your task',
      });

      expect(toolSearch().tool_search.description).toBe('Find the right tool for your task');
    });

    it('topK limits number of results', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, topK: 2 });

      const results = await toolSearch.search('tool');
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('minScore filters low-relevance results', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, minScore: 0.5 });

      const results = await toolSearch.search('github');
      results.forEach(r => {
        expect(r.score).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('simulates complete request cycle', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Start: only search tool
      let tools = toolSearch();
      expect(Object.keys(tools)).toEqual(['tool_search']);

      // User: "Create a GitHub PR"
      // Agent searches for relevant tools
      const searchResult = await tools.tool_search.execute!({ query: 'create pull request github' }, {} as any);
      expect(searchResult.success).toBe(true);

      // Now GitHub tools are available
      tools = toolSearch();
      expect(tools['github.createPR']).toBeDefined();

      // Agent executes the tool
      const prResult = await tools['github.createPR'].execute!({ title: 'Add new feature' }, {} as any);
      expect(prResult.prUrl).toContain('Add new feature');

      // User: "Also notify the team on Slack"
      await tools.tool_search.execute!({ query: 'slack notify message' }, {} as any);

      // Both tools now available
      tools = toolSearch();
      expect(tools['github.createPR']).toBeDefined();
      expect(tools['slack.sendMessage']).toBeDefined();

      const slackResult = await tools['slack.sendMessage'].execute!(
        { channel: '#team', message: 'PR created!' },
        {} as any,
      );
      expect(slackResult.sent).toBe(true);

      // End of request: reset for next request
      toolSearch.reset();
      expect(Object.keys(toolSearch())).toEqual(['tool_search']);
    });

    it('handles tool not found gracefully', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, minScore: 0.99 });

      const result = await toolSearch().tool_search.execute!({ query: 'xyznonexistent123' }, {} as any);

      expect(result.success).toBe(false);
      expect(result.loadedTools).toHaveLength(0);
      expect(result.availableTools.length).toBeGreaterThan(0);
    });

    it('works with large tool sets', async () => {
      // Generate 100 tools
      const manyTools: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        manyTools[`tool_${i}`] = createTool({
          id: `tool_${i}`,
          description: `Tool number ${i} for testing category ${i % 10}`,
          execute: async () => ({ id: i }),
        });
      }

      const toolSearch = await createToolSearch({ tools: manyTools, topK: 5 });

      const results = await toolSearch.search('category 5');
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Usage Patterns', () => {
    it('can be used with agent toolsets', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      // Simulate passing to agent.generate({ toolsets: { available: toolSearch() } })
      const toolsets = { available: toolSearch() };

      expect(toolsets.available.tool_search).toBeDefined();
      expect(typeof toolsets.available.tool_search.execute).toBe('function');
    });

    it('maintains state across multiple toolSearch() calls', async () => {
      const toolSearch = await createToolSearch({ tools: allTools });

      toolSearch.load('github.createPR');

      // Multiple calls to toolSearch() see the same loaded state
      expect(toolSearch()['github.createPR']).toBeDefined();
      expect(toolSearch()['github.createPR']).toBeDefined();
      expect(toolSearch()['github.createPR']).toBeDefined();
    });
  });
});
