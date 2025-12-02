import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { createTool } from './tool';
import { DeferredToolset, ToolSearchIndex, createToolSearchTool, createToolSearch } from './tool-search';

// Mock embedding function that creates simple embeddings based on word overlap
function mockEmbed(text: string): number[] {
  // Simple embedding: create a vector based on presence of common words
  const words = ['calculate', 'math', 'add', 'weather', 'temperature', 'email', 'send', 'message', 'search', 'find'];
  const embedding = words.map(word => (text.toLowerCase().includes(word) ? 1 : 0));
  // Add some variance to make embeddings slightly different
  return embedding.map(v => v + Math.random() * 0.01);
}

// Create a mock embedding model
const mockEmbedder = {
  specificationVersion: 'v1',
  provider: 'test',
  modelId: 'test-embedding',
  maxEmbeddingsPerCall: 100,
  supportsParallelCalls: true,
  doEmbed: vi.fn().mockImplementation(async ({ values }: { values: string[] }) => {
    return {
      embeddings: values.map(v => mockEmbed(v)),
    };
  }),
} as any;

// Sample tools for testing
const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform mathematical calculations like addition, subtraction, multiplication, and division',
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
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    return { location, temperature: 72, conditions: 'sunny' };
  },
});

const emailTool = createTool({
  id: 'sendEmail',
  description: 'Send an email message to a recipient',
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async ({ to, subject }) => {
    return { sent: true, to, subject };
  },
});

const helpTool = createTool({
  id: 'help',
  description: 'Get help and documentation',
  inputSchema: z.object({}),
  execute: async () => {
    return { message: 'How can I help you?' };
  },
});

// ============================================================================
// DeferredToolset Tests (Primary API)
// ============================================================================

describe('DeferredToolset', () => {
  let toolset: DeferredToolset;

  beforeEach(() => {
    vi.clearAllMocks();
    toolset = new DeferredToolset({
      embedder: mockEmbedder,
    });
  });

  describe('addTools', () => {
    it('should add always-loaded tools', async () => {
      await toolset.addTools({ help: helpTool }, { deferLoading: false });

      expect(toolset.getAlwaysLoadedToolIds()).toContain('help');
      expect(toolset.hasTool('help')).toBe(true);
    });

    it('should add deferred tools with embeddings', async () => {
      await toolset.addTools(
        {
          calculator: calculatorTool,
          weather: weatherTool,
        },
        { deferLoading: true },
      );

      expect(toolset.getDeferredToolIds()).toContain('calculator');
      expect(toolset.getDeferredToolIds()).toContain('weather');
      expect(mockEmbedder.doEmbed).toHaveBeenCalled();
    });

    it('should separate always-loaded and deferred tools', async () => {
      await toolset.addTools({ help: helpTool }, { deferLoading: false });
      await toolset.addTools({ calculator: calculatorTool }, { deferLoading: true });

      expect(toolset.getAlwaysLoadedToolIds()).toEqual(['help']);
      expect(toolset.getDeferredToolIds()).toEqual(['calculator']);
    });
  });

  describe('addTool', () => {
    it('should add a single always-loaded tool', async () => {
      await toolset.addTool('help', helpTool, { deferLoading: false });

      expect(toolset.getAlwaysLoadedToolIds()).toContain('help');
    });

    it('should add a single deferred tool', async () => {
      await toolset.addTool('calculator', calculatorTool, { deferLoading: true });

      expect(toolset.getDeferredToolIds()).toContain('calculator');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await toolset.addTools(
        {
          calculator: calculatorTool,
          weather: weatherTool,
          sendEmail: emailTool,
        },
        { deferLoading: true },
      );
    });

    it('should find matching tools', async () => {
      const results = await toolset.search('I need to do math calculations');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('calculator');
    });

    it('should respect topK parameter', async () => {
      const results = await toolset.search('tool', { topK: 1 });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array when no deferred tools', async () => {
      const emptyToolset = new DeferredToolset({ embedder: mockEmbedder });
      const results = await emptyToolset.search('anything');

      expect(results).toEqual([]);
    });
  });

  describe('loadTool / unloadTool', () => {
    beforeEach(async () => {
      await toolset.addTools({ calculator: calculatorTool, weather: weatherTool }, { deferLoading: true });
    });

    it('should load a deferred tool for a thread', () => {
      const loaded = toolset.loadTool('calculator', 'thread-1');

      expect(loaded).toBe(true);
      expect(toolset.getLoadedToolIds('thread-1')).toContain('calculator');
    });

    it('should load multiple tools', () => {
      const count = toolset.loadTools(['calculator', 'weather'], 'thread-1');

      expect(count).toBe(2);
      expect(toolset.getLoadedToolIds('thread-1')).toContain('calculator');
      expect(toolset.getLoadedToolIds('thread-1')).toContain('weather');
    });

    it('should return false when loading non-existent tool', () => {
      const loaded = toolset.loadTool('nonexistent', 'thread-1');

      expect(loaded).toBe(false);
    });

    it('should unload a tool', () => {
      toolset.loadTool('calculator', 'thread-1');
      const unloaded = toolset.unloadTool('calculator', 'thread-1');

      expect(unloaded).toBe(true);
      expect(toolset.getLoadedToolIds('thread-1')).not.toContain('calculator');
    });

    it('should unload all tools for a thread', () => {
      toolset.loadTools(['calculator', 'weather'], 'thread-1');
      toolset.unloadAllTools('thread-1');

      expect(toolset.getLoadedToolIds('thread-1')).toEqual([]);
    });

    it('should keep tools separate between threads', () => {
      toolset.loadTool('calculator', 'thread-1');
      toolset.loadTool('weather', 'thread-2');

      expect(toolset.getLoadedToolIds('thread-1')).toEqual(['calculator']);
      expect(toolset.getLoadedToolIds('thread-2')).toEqual(['weather']);
    });

    it('should use global scope when no threadId provided', () => {
      toolset.loadTool('calculator');

      expect(toolset.getLoadedToolIds()).toContain('calculator');
    });
  });

  describe('getTools', () => {
    beforeEach(async () => {
      await toolset.addTools({ help: helpTool }, { deferLoading: false });
      await toolset.addTools(
        {
          calculator: calculatorTool,
          weather: weatherTool,
        },
        { deferLoading: true },
      );
    });

    it('should return always-loaded tools and search tool', () => {
      const tools = toolset.getTools();

      expect(Object.keys(tools)).toContain('help');
      expect(Object.keys(tools)).toContain('tool_search');
      expect(Object.keys(tools)).not.toContain('calculator');
      expect(Object.keys(tools)).not.toContain('weather');
    });

    it('should include loaded deferred tools', () => {
      toolset.loadTool('calculator', 'thread-1');
      const tools = toolset.getTools('thread-1');

      expect(Object.keys(tools)).toContain('help');
      expect(Object.keys(tools)).toContain('tool_search');
      expect(Object.keys(tools)).toContain('calculator');
      expect(Object.keys(tools)).not.toContain('weather');
    });

    it('should not include tools loaded for other threads', () => {
      toolset.loadTool('calculator', 'thread-1');
      const tools = toolset.getTools('thread-2');

      expect(Object.keys(tools)).not.toContain('calculator');
    });
  });

  describe('searchTool execution', () => {
    beforeEach(async () => {
      await toolset.addTools({ help: helpTool }, { deferLoading: false });
      await toolset.addTools(
        {
          calculator: calculatorTool,
          weather: weatherTool,
        },
        { deferLoading: true },
      );
    });

    it('should load matching tools when search tool is executed', async () => {
      const tools = toolset.getTools('thread-1');
      const searchTool = tools['tool_search'];

      const result = await searchTool?.execute?.({ query: 'math calculate add numbers' });

      expect(result.success).toBe(true);
      expect(result.loadedTools.length).toBeGreaterThan(0);
      expect(result.loadedTools[0].id).toBe('calculator');

      // Tool should now be loaded
      expect(toolset.getLoadedToolIds('thread-1')).toContain('calculator');
    });

    it('should return failure when no tools match', async () => {
      // Use a high minScore to ensure no matches
      const toolsetWithHighMinScore = new DeferredToolset({
        embedder: mockEmbedder,
        minScore: 0.99,
      });
      await toolsetWithHighMinScore.addTools({ calculator: calculatorTool }, { deferLoading: true });

      const strictTools = toolsetWithHighMinScore.getTools('thread-1');
      const strictSearchTool = strictTools['tool_search'];

      const result = await strictSearchTool?.execute?.({ query: 'xyz123abc completely unrelated' });

      expect(result.success).toBe(false);
      expect(result.loadedTools).toEqual([]);
    });
  });

  describe('getTool', () => {
    it('should get always-loaded tool', async () => {
      await toolset.addTools({ help: helpTool }, { deferLoading: false });

      const tool = toolset.getTool('help');
      expect(tool).toBeDefined();
      expect(tool?.id).toBe('help');
    });

    it('should get deferred tool', async () => {
      await toolset.addTools({ calculator: calculatorTool }, { deferLoading: true });

      const tool = toolset.getTool('calculator');
      expect(tool).toBeDefined();
      expect(tool?.id).toBe('calculator');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = toolset.getTool('nonexistent');
      expect(tool).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await toolset.addTools({ help: helpTool }, { deferLoading: false });
      await toolset.addTools({ calculator: calculatorTool, weather: weatherTool }, { deferLoading: true });
      toolset.loadTool('calculator', 'thread-1');
      toolset.loadTools(['calculator', 'weather'], 'thread-2');

      const stats = toolset.getStats();

      expect(stats.alwaysLoadedCount).toBe(1);
      expect(stats.deferredCount).toBe(2);
      expect(stats.loadedByThread['thread-1']).toBe(1);
      expect(stats.loadedByThread['thread-2']).toBe(2);
    });
  });

  describe('custom configuration', () => {
    it('should use custom search tool ID', async () => {
      const customToolset = new DeferredToolset({
        embedder: mockEmbedder,
        searchToolId: 'find_tools',
      });
      await customToolset.addTools({ calculator: calculatorTool }, { deferLoading: true });

      const tools = customToolset.getTools();
      expect(Object.keys(tools)).toContain('find_tools');
      expect(Object.keys(tools)).not.toContain('tool_search');
    });

    it('should use custom search tool description', async () => {
      const customToolset = new DeferredToolset({
        embedder: mockEmbedder,
        searchToolDescription: 'Custom description',
      });

      expect(customToolset.searchTool.description).toBe('Custom description');
    });
  });
});

// ============================================================================
// Legacy API Tests (ToolSearchIndex, createToolSearchTool, createToolSearch)
// ============================================================================

describe('ToolSearchIndex (Legacy)', () => {
  let searchIndex: ToolSearchIndex;

  beforeEach(() => {
    vi.clearAllMocks();
    searchIndex = new ToolSearchIndex({
      embedder: mockEmbedder,
    });
  });

  describe('index', () => {
    it('should index tools successfully', async () => {
      await searchIndex.index({
        calculator: calculatorTool,
        weather: weatherTool,
        sendEmail: emailTool,
      });

      expect(searchIndex.size).toBe(3);
      expect(searchIndex.has('calculator')).toBe(true);
      expect(searchIndex.has('weather')).toBe(true);
      expect(searchIndex.has('sendEmail')).toBe(true);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await searchIndex.index({
        calculator: calculatorTool,
        weather: weatherTool,
        sendEmail: emailTool,
      });
    });

    it('should return matching tools sorted by relevance', async () => {
      const results = await searchIndex.search('I need to do math calculations');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('calculator');
    });

    it('should include score in results', async () => {
      const results = await searchIndex.search('weather temperature');

      expect(results.length).toBeGreaterThan(0);
      expect(typeof results[0]?.score).toBe('number');
    });
  });
});

describe('createToolSearchTool (Legacy)', () => {
  let searchIndex: ToolSearchIndex;

  beforeEach(async () => {
    vi.clearAllMocks();
    searchIndex = new ToolSearchIndex({
      embedder: mockEmbedder,
    });
    await searchIndex.index({
      calculator: calculatorTool,
      weather: weatherTool,
      sendEmail: emailTool,
    });
  });

  it('should create a search-only tool', async () => {
    const searchTool = createToolSearchTool({ searchIndex });

    expect(searchTool.id).toBe('tool_search');

    const result = await searchTool.execute?.({ query: 'send an email' });
    expect(result.matchingTools).toBeDefined();
  });

  it('should create an auto-execute tool', async () => {
    const searchTool = createToolSearchTool({
      searchIndex,
      autoExecute: true,
      minScore: 0,
    });

    const result = await searchTool.execute?.({
      query: 'calculate math add',
      toolInput: { operation: 'add', a: 5, b: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.result?.result).toBe(8);
  });
});

describe('createToolSearch (Legacy)', () => {
  it('should create a complete tool search setup', async () => {
    const { searchIndex, searchTool, indexTools } = createToolSearch({
      embedder: mockEmbedder,
    });

    await indexTools({
      calculator: calculatorTool,
      weather: weatherTool,
    });

    expect(searchIndex.size).toBe(2);

    const result = await searchTool.execute?.({ query: 'math calculation' });
    expect(result.matchingTools).toBeDefined();
  });
});
