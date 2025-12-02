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
    // Simple mock: create embeddings based on word presence
    const words = ['calculate', 'math', 'add', 'weather', 'temperature', 'email', 'send', 'message', 'github', 'pr'];
    return {
      embeddings: values.map(v => words.map(word => (v.toLowerCase().includes(word) ? 1 : 0) + Math.random() * 0.01)),
    };
  }),
} as any;

// Always-loaded tools (no deferred property)
const helpTool = createTool({
  id: 'help',
  description: 'Get help and documentation',
  inputSchema: z.object({}),
  execute: async () => ({ message: 'How can I help?' }),
});

// Deferred tools (deferred: true)
const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform mathematical calculations like addition and math operations',
  deferred: true,
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    switch (operation) {
      case 'add':
        return { result: a + b };
      case 'subtract':
        return { result: a - b };
      case 'multiply':
        return { result: a * b };
      case 'divide':
        return { result: a / b };
    }
  },
});

const weatherTool = createTool({
  id: 'weather',
  description: 'Get current weather and temperature for a location',
  deferred: true,
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => ({ location, temperature: 72, conditions: 'sunny' }),
});

const emailTool = createTool({
  id: 'sendEmail',
  description: 'Send an email message to a recipient',
  deferred: true,
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async ({ to, subject }) => ({ sent: true, to, subject }),
});

const githubTool = createTool({
  id: 'github.createPR',
  description: 'Create a GitHub pull request for code changes',
  deferred: true,
  inputSchema: z.object({
    title: z.string(),
    body: z.string(),
  }),
  execute: async ({ title }) => ({ created: true, title }),
});

describe('createToolSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with BM25 method (default)', () => {
    it('should create a tool search with BM25', async () => {
      const toolSearch = await createToolSearch({
        tools: { help: helpTool, calculator: calculatorTool, weather: weatherTool },
      });

      expect(toolSearch).toBeInstanceOf(ToolSearch);
      expect(toolSearch.getAlwaysLoadedToolIds()).toContain('help');
      expect(toolSearch.getDeferredToolIds()).toContain('calculator');
      expect(toolSearch.getDeferredToolIds()).toContain('weather');
    });

    it('should search using BM25', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool, weather: weatherTool, email: emailTool },
        method: 'bm25',
      });

      const results = await toolSearch.search('math calculations add');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('calculator');
    });
  });

  describe('with regex method', () => {
    it('should search using regex', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool, weather: weatherTool, email: emailTool },
        method: 'regex',
      });

      const results = await toolSearch.search('weather');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('weather');
    });

    it('should handle special regex characters', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
        method: 'regex',
      });

      // Should not throw
      const results = await toolSearch.search('test.*+?^${}()|[]\\');
      expect(results).toBeDefined();
    });
  });

  describe('with embedding method', () => {
    it('should require embedder', async () => {
      await expect(
        createToolSearch({
          tools: { calculator: calculatorTool },
          method: 'embedding',
        }),
      ).rejects.toThrow('Embedder is required');
    });

    it('should search using embeddings', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool, weather: weatherTool, github: githubTool },
        method: 'embedding',
        embedder: mockEmbedder,
      });

      const results = await toolSearch.search('math add calculate');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('calculator');
    });
  });

  describe('deferred property on tools', () => {
    it('should automatically separate deferred and always-loaded tools', async () => {
      const toolSearch = await createToolSearch({
        tools: {
          help: helpTool, // no deferred property
          calculator: calculatorTool, // deferred: true
          weather: weatherTool, // deferred: true
        },
      });

      expect(toolSearch.getAlwaysLoadedToolIds()).toEqual(['help']);
      expect(toolSearch.getDeferredToolIds()).toContain('calculator');
      expect(toolSearch.getDeferredToolIds()).toContain('weather');
    });
  });

  describe('getTools', () => {
    it('should return always-loaded tools and search tool', async () => {
      const toolSearch = await createToolSearch({
        tools: { help: helpTool, calculator: calculatorTool },
      });

      const tools = toolSearch.getTools();

      expect(Object.keys(tools)).toContain('help');
      expect(Object.keys(tools)).toContain('tool_search');
      expect(Object.keys(tools)).not.toContain('calculator');
    });

    it('should include loaded deferred tools', async () => {
      const toolSearch = await createToolSearch({
        tools: { help: helpTool, calculator: calculatorTool, weather: weatherTool },
      });

      toolSearch.loadTool('calculator', 'thread-1');
      const tools = toolSearch.getTools('thread-1');

      expect(Object.keys(tools)).toContain('help');
      expect(Object.keys(tools)).toContain('tool_search');
      expect(Object.keys(tools)).toContain('calculator');
      expect(Object.keys(tools)).not.toContain('weather');
    });

    it('should isolate loaded tools between threads', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool, weather: weatherTool },
      });

      toolSearch.loadTool('calculator', 'thread-1');
      toolSearch.loadTool('weather', 'thread-2');

      expect(Object.keys(toolSearch.getTools('thread-1'))).toContain('calculator');
      expect(Object.keys(toolSearch.getTools('thread-1'))).not.toContain('weather');

      expect(Object.keys(toolSearch.getTools('thread-2'))).toContain('weather');
      expect(Object.keys(toolSearch.getTools('thread-2'))).not.toContain('calculator');
    });
  });

  describe('search tool execution', () => {
    it('should load matching tools when executed', async () => {
      const toolSearch = await createToolSearch({
        tools: { help: helpTool, calculator: calculatorTool, weather: weatherTool },
        method: 'bm25',
      });

      const tools = toolSearch.getTools('thread-1');
      const searchTool = tools['tool_search'];

      const result = await searchTool?.execute?.({ query: 'math calculations' });

      expect(result.success).toBe(true);
      expect(result.loadedTools.length).toBeGreaterThan(0);
      expect(result.loadedTools[0].id).toBe('calculator');

      // Tool should now be loaded
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('calculator');
    });

    it('should return failure when no tools match', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
        method: 'bm25',
      });

      const tools = toolSearch.getTools('thread-1');
      const searchTool = tools['tool_search'];

      const result = await searchTool?.execute?.({ query: 'xyz123abc' });

      expect(result.success).toBe(false);
      expect(result.loadedTools).toEqual([]);
    });
  });

  describe('loadTool / unloadTool', () => {
    it('should load a deferred tool', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
      });

      const loaded = toolSearch.loadTool('calculator', 'thread-1');

      expect(loaded).toBe(true);
      expect(toolSearch.getLoadedToolIds('thread-1')).toContain('calculator');
    });

    it('should return false for non-existent tool', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
      });

      const loaded = toolSearch.loadTool('nonexistent', 'thread-1');

      expect(loaded).toBe(false);
    });

    it('should unload a tool', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
      });

      toolSearch.loadTool('calculator', 'thread-1');
      const unloaded = toolSearch.unloadTool('calculator', 'thread-1');

      expect(unloaded).toBe(true);
      expect(toolSearch.getLoadedToolIds('thread-1')).not.toContain('calculator');
    });

    it('should unload all tools for a thread', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool, weather: weatherTool },
      });

      toolSearch.loadTools(['calculator', 'weather'], 'thread-1');
      toolSearch.unloadAllTools('thread-1');

      expect(toolSearch.getLoadedToolIds('thread-1')).toEqual([]);
    });

    it('should use global scope when no threadId', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
      });

      toolSearch.loadTool('calculator');

      expect(toolSearch.getLoadedToolIds()).toContain('calculator');
    });
  });

  describe('custom configuration', () => {
    it('should use custom search tool ID', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool },
        searchToolId: 'find_tools',
      });

      const tools = toolSearch.getTools();

      expect(Object.keys(tools)).toContain('find_tools');
      expect(Object.keys(tools)).not.toContain('tool_search');
    });

    it('should use custom topK', async () => {
      const toolSearch = await createToolSearch({
        tools: { calculator: calculatorTool, weather: weatherTool, email: emailTool },
        topK: 1,
      });

      const results = await toolSearch.search('tool');

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});
