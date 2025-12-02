import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { createTool } from './tool';
import { createToolSearch, ToolSearch } from './tool-search';

// Create a mock embedding model
const mockEmbedder = {
  specificationVersion: 'v1',
  provider: 'test',
  modelId: 'test-embedding',
  maxEmbeddingsPerCall: 100,
  supportsParallelCalls: true,
  doEmbed: vi.fn().mockImplementation(async ({ values }: { values: string[] }) => {
    // Create embeddings based on keyword presence for predictable testing
    const keywords = [
      'github',
      'pull',
      'request',
      'pr',
      'slack',
      'message',
      'send',
      'jira',
      'ticket',
      'email',
      'weather',
      'temperature',
      'calculate',
      'math',
    ];
    return {
      embeddings: values.map(v => {
        const lower = v.toLowerCase();
        return keywords.map(kw => (lower.includes(kw) ? 1 : 0));
      }),
    };
  }),
} as any;

// ============================================================================
// Sample Tools
// ============================================================================

const githubCreatePR = createTool({
  id: 'github.createPR',
  description: 'Create a GitHub pull request for code changes',
  inputSchema: z.object({
    title: z.string(),
    body: z.string(),
    base: z.string().default('main'),
  }),
  execute: async ({ title, body, base }) => ({
    success: true,
    prNumber: 123,
    title,
    body,
    base,
    url: 'https://github.com/org/repo/pull/123',
  }),
});

const githubListIssues = createTool({
  id: 'github.listIssues',
  description: 'List GitHub issues for a repository',
  inputSchema: z.object({
    repo: z.string(),
    state: z.enum(['open', 'closed', 'all']).default('open'),
  }),
  execute: async ({ repo, state }) => ({
    issues: [
      { number: 1, title: 'Bug fix needed', state },
      { number: 2, title: 'Feature request', state },
    ],
    repo,
  }),
});

const slackSendMessage = createTool({
  id: 'slack.sendMessage',
  description: 'Send a message to a Slack channel',
  inputSchema: z.object({
    channel: z.string(),
    message: z.string(),
  }),
  execute: async ({ channel, message }) => ({
    success: true,
    channel,
    messageId: 'msg-123',
    message,
  }),
});

const jiraCreateTicket = createTool({
  id: 'jira.createTicket',
  description: 'Create a Jira ticket for tracking work',
  inputSchema: z.object({
    project: z.string(),
    summary: z.string(),
    description: z.string(),
    type: z.enum(['bug', 'task', 'story']).default('task'),
  }),
  execute: async ({ project, summary, type }) => ({
    success: true,
    ticketId: 'PROJ-123',
    project,
    summary,
    type,
  }),
});

const emailSend = createTool({
  id: 'email.send',
  description: 'Send an email to recipients',
  inputSchema: z.object({
    to: z.array(z.string()),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async ({ to, subject }) => ({
    success: true,
    to,
    subject,
    messageId: 'email-456',
  }),
});

const weatherGet = createTool({
  id: 'weather.get',
  description: 'Get current weather and temperature for a location',
  inputSchema: z.object({
    location: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  execute: async ({ location, units }) => ({
    location,
    temperature: units === 'celsius' ? 22 : 72,
    units,
    conditions: 'sunny',
  }),
});

const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    const ops = {
      add: a + b,
      subtract: a - b,
      multiply: a * b,
      divide: a / b,
    };
    return { result: ops[operation] };
  },
});

// ============================================================================
// Tests
// ============================================================================

describe('createToolSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Usage', () => {
    it('should create a tool search with all tools searchable', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
          'jira.createTicket': jiraCreateTicket,
        },
      });

      expect(toolSearch).toBeInstanceOf(ToolSearch);
      expect(toolSearch.getToolIds()).toHaveLength(3);
      expect(toolSearch.getToolIds()).toContain('github.createPR');
      expect(toolSearch.getToolIds()).toContain('slack.sendMessage');
      expect(toolSearch.getToolIds()).toContain('jira.createTicket');
    });

    it('should only expose search tool initially', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
      });

      const tools = toolSearch.getTools('thread-1');

      // Only search tool should be available
      expect(Object.keys(tools)).toEqual(['tool_search']);
      expect(tools['github.createPR']).toBeUndefined();
      expect(tools['slack.sendMessage']).toBeUndefined();
    });
  });

  describe('Search Methods', () => {
    describe('BM25 (default)', () => {
      it('should find relevant tools using BM25', async () => {
        const toolSearch = await createToolSearch({
          tools: {
            'github.createPR': githubCreatePR,
            'slack.sendMessage': slackSendMessage,
            'jira.createTicket': jiraCreateTicket,
          },
          method: 'bm25',
        });

        const results = await toolSearch.search('create a pull request on github');

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]!.id).toBe('github.createPR');
        expect(results[0]!.score).toBeGreaterThan(0);
      });

      it('should rank results by relevance', async () => {
        const toolSearch = await createToolSearch({
          tools: {
            'github.createPR': githubCreatePR,
            'github.listIssues': githubListIssues,
            'slack.sendMessage': slackSendMessage,
          },
          method: 'bm25',
        });

        const results = await toolSearch.search('github pull request');

        expect(results[0]!.id).toBe('github.createPR');
        // github.listIssues should also match on 'github' but lower score
        const issuesResult = results.find(r => r.id === 'github.listIssues');
        expect(issuesResult).toBeDefined();
        expect(issuesResult!.score).toBeLessThan(results[0]!.score);
      });
    });

    describe('Regex', () => {
      it('should find tools matching pattern', async () => {
        const toolSearch = await createToolSearch({
          tools: {
            'github.createPR': githubCreatePR,
            'slack.sendMessage': slackSendMessage,
          },
          method: 'regex',
        });

        const results = await toolSearch.search('slack');

        expect(results.length).toBe(1);
        expect(results[0]!.id).toBe('slack.sendMessage');
      });

      it('should handle special regex characters safely', async () => {
        const toolSearch = await createToolSearch({
          tools: { 'github.createPR': githubCreatePR },
          method: 'regex',
        });

        // Should not throw on special regex chars
        const results = await toolSearch.search('test.*+?^${}()|[]\\');
        expect(results).toBeDefined();
      });
    });

    describe('Embedding', () => {
      it('should require embedder', async () => {
        await expect(
          createToolSearch({
            tools: { 'github.createPR': githubCreatePR },
            method: 'embedding',
          }),
        ).rejects.toThrow('Embedder is required');
      });

      it('should find semantically similar tools', async () => {
        const toolSearch = await createToolSearch({
          tools: {
            'github.createPR': githubCreatePR,
            'slack.sendMessage': slackSendMessage,
            'weather.get': weatherGet,
          },
          method: 'embedding',
          embedder: mockEmbedder,
        });

        const results = await toolSearch.search('I need to make a PR on github');

        expect(results.length).toBeGreaterThan(0);
        expect(results[0]!.id).toBe('github.createPR');
      });
    });
  });

  describe('Tool Loading Flow', () => {
    it('should load tools when search tool is executed', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
        method: 'bm25',
      });

      // Initially no tools loaded
      expect(toolSearch.getLoadedToolIds('thread-1')).toEqual([]);

      // Get the search tool and execute it
      const tools = toolSearch.getTools('thread-1');
      const searchTool = tools['tool_search'];
      const result = await searchTool!.execute!({ query: 'github pull request' });

      expect(result.success).toBe(true);
      expect(result.loadedTools.length).toBeGreaterThan(0);
      expect(result.loadedTools[0].id).toBe('github.createPR');

      // Tool should now be loaded
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('github.createPR');
    });

    it('should include loaded tools in getTools', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
        method: 'bm25',
      });

      // Execute search
      const tools1 = toolSearch.getTools('thread-1');
      await tools1['tool_search']!.execute!({ query: 'github' });

      // Get tools again - should now include the loaded tool
      const tools2 = toolSearch.getTools('thread-1');

      expect(Object.keys(tools2)).toContain('tool_search');
      expect(Object.keys(tools2)).toContain('github.createPR');
      expect(Object.keys(tools2)).not.toContain('slack.sendMessage');
    });

    it('should allow calling loaded tools', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
        method: 'bm25',
      });

      // Load the tool via search
      const tools1 = toolSearch.getTools('thread-1');
      await tools1['tool_search']!.execute!({ query: 'github' });

      // Get tools and call the loaded tool
      const tools2 = toolSearch.getTools('thread-1');
      const createPR = tools2['github.createPR'];

      expect(createPR).toBeDefined();

      const result = await createPR!.execute!({
        title: 'Fix bug',
        body: 'This PR fixes the bug',
        base: 'main',
      });

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(123);
      expect(result.title).toBe('Fix bug');
    });
  });

  describe('Thread Isolation', () => {
    it('should isolate loaded tools between threads', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
        method: 'bm25',
      });

      // Load github tool for thread-1
      const tools1 = toolSearch.getTools('thread-1');
      await tools1['tool_search']!.execute!({ query: 'github' });

      // Load slack tool for thread-2
      const tools2 = toolSearch.getTools('thread-2');
      await tools2['tool_search']!.execute!({ query: 'slack message' });

      // Verify isolation
      const thread1Tools = toolSearch.getTools('thread-1');
      const thread2Tools = toolSearch.getTools('thread-2');

      expect(Object.keys(thread1Tools)).toContain('github.createPR');
      expect(Object.keys(thread1Tools)).not.toContain('slack.sendMessage');

      expect(Object.keys(thread2Tools)).toContain('slack.sendMessage');
      expect(Object.keys(thread2Tools)).not.toContain('github.createPR');
    });

    it('should use global scope when no threadId', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
        method: 'bm25',
      });

      // Load without threadId
      const tools = toolSearch.getTools();
      await tools['tool_search']!.execute!({ query: 'github' });

      // Should be available globally
      expect(toolSearch.getLoadedToolIds()).toContain('github.createPR');
      expect(Object.keys(toolSearch.getTools())).toContain('github.createPR');
    });
  });

  describe('Manual Loading/Unloading', () => {
    it('should manually load tools', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
      });

      const loaded = toolSearch.loadTool('github.createPR', 'thread-1');

      expect(loaded).toBe(true);
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('github.createPR');
    });

    it('should return false for non-existent tool', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
      });

      const loaded = toolSearch.loadTool('nonexistent', 'thread-1');

      expect(loaded).toBe(false);
    });

    it('should load multiple tools at once', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
          'jira.createTicket': jiraCreateTicket,
        },
      });

      const count = toolSearch.loadTools(['github.createPR', 'slack.sendMessage'], 'thread-1');

      expect(count).toBe(2);
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('github.createPR');
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('slack.sendMessage');
    });

    it('should unload a tool', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
      });

      toolSearch.loadTool('github.createPR', 'thread-1');
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('github.createPR');

      const unloaded = toolSearch.unloadTool('github.createPR', 'thread-1');

      expect(unloaded).toBe(true);
      expect(toolSearch.getLoadedToolIds('thread-1')).not.toContain('github.createPR');
    });

    it('should unload all tools for a thread', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
      });

      toolSearch.loadTools(['github.createPR', 'slack.sendMessage'], 'thread-1');
      expect(toolSearch.getLoadedToolIds('thread-1')).toHaveLength(2);

      toolSearch.unloadAllTools('thread-1');

      expect(toolSearch.getLoadedToolIds('thread-1')).toEqual([]);
    });
  });

  describe('Search Tool Response', () => {
    it('should return success with loaded tools on match', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
        method: 'bm25',
      });

      const tools = toolSearch.getTools('thread-1');
      const result = await tools['tool_search']!.execute!({ query: 'github pull request' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Loaded');
      expect(result.loadedTools).toHaveLength(1);
      expect(result.loadedTools[0]).toEqual({
        id: 'github.createPR',
        description: expect.any(String),
        score: expect.any(Number),
      });
    });

    it('should return failure with available tools on no match', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
        method: 'bm25',
      });

      const tools = toolSearch.getTools('thread-1');
      const result = await tools['tool_search']!.execute!({ query: 'xyzabc123' });

      expect(result.success).toBe(false);
      expect(result.loadedTools).toEqual([]);
      expect(result.availableTools).toContain('github.createPR');
    });
  });

  describe('Configuration', () => {
    it('should use custom search tool ID', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
        searchToolId: 'find_tools',
      });

      const tools = toolSearch.getTools();

      expect(Object.keys(tools)).toContain('find_tools');
      expect(Object.keys(tools)).not.toContain('tool_search');
    });

    it('should use custom search tool description', async () => {
      const toolSearch = await createToolSearch({
        tools: { 'github.createPR': githubCreatePR },
        searchToolDescription: 'Find the right tool for the job',
      });

      const tools = toolSearch.getTools();
      expect(tools['tool_search']!.description).toBe('Find the right tool for the job');
    });

    it('should respect topK limit', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'github.listIssues': githubListIssues,
          'slack.sendMessage': slackSendMessage,
          'jira.createTicket': jiraCreateTicket,
        },
        topK: 2,
        method: 'bm25',
      });

      const results = await toolSearch.search('create');

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect minScore threshold', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'slack.sendMessage': slackSendMessage,
        },
        minScore: 0.9,
        method: 'bm25',
      });

      // With high minScore, weak matches should be filtered
      const results = await toolSearch.search('something');

      // Results should be filtered by score
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe('Real-World Scenario', () => {
    it('should work end-to-end like Anthropic Tool Search', async () => {
      // Setup: Create tool search with many tools
      const toolSearch = await createToolSearch({
        tools: {
          'github.createPR': githubCreatePR,
          'github.listIssues': githubListIssues,
          'slack.sendMessage': slackSendMessage,
          'jira.createTicket': jiraCreateTicket,
          'email.send': emailSend,
          'weather.get': weatherGet,
          calculator: calculatorTool,
        },
        method: 'bm25',
      });

      const threadId = 'conversation-123';

      // Step 1: Agent only sees search tool
      let tools = toolSearch.getTools(threadId);
      expect(Object.keys(tools)).toEqual(['tool_search']);

      // Step 2: User asks "Create a PR for my bug fix"
      // Agent searches for relevant tools
      const searchResult = await tools['tool_search']!.execute!({
        query: 'create pull request github',
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.loadedTools[0].id).toBe('github.createPR');

      // Step 3: github.createPR is now loaded
      tools = toolSearch.getTools(threadId);
      expect(Object.keys(tools)).toContain('github.createPR');

      // Step 4: Agent calls the loaded tool
      const prResult = await tools['github.createPR']!.execute!({
        title: 'Fix critical bug',
        body: 'This fixes issue #42',
        base: 'main',
      });

      expect(prResult.success).toBe(true);
      expect(prResult.prNumber).toBe(123);

      // Step 5: User asks "Also send a slack message about it"
      // Agent searches again
      const searchResult2 = await tools['tool_search']!.execute!({
        query: 'send slack message',
      });

      expect(searchResult2.success).toBe(true);
      expect(searchResult2.loadedTools[0].id).toBe('slack.sendMessage');

      // Step 6: Now both tools are loaded
      tools = toolSearch.getTools(threadId);
      expect(Object.keys(tools)).toContain('github.createPR');
      expect(Object.keys(tools)).toContain('slack.sendMessage');

      // Step 7: Agent sends slack message
      const slackResult = await tools['slack.sendMessage']!.execute!({
        channel: '#dev',
        message: 'PR #123 created for bug fix',
      });

      expect(slackResult.success).toBe(true);
      expect(slackResult.channel).toBe('#dev');
    });
  });
});
