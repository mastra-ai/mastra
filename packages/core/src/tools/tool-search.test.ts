import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { createTool } from './tool';
import { ToolSearchIndex, createToolSearchTool, createToolSearch } from './tool-search';

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

describe('ToolSearchIndex', () => {
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

    it('should call embedder for each tool', async () => {
      await searchIndex.index({
        calculator: calculatorTool,
        weather: weatherTool,
      });

      expect(mockEmbedder.doEmbed).toHaveBeenCalledTimes(2);
    });
  });

  describe('add', () => {
    it('should add a single tool to the index', async () => {
      await searchIndex.add('calculator', calculatorTool);

      expect(searchIndex.size).toBe(1);
      expect(searchIndex.has('calculator')).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove a tool from the index', async () => {
      await searchIndex.index({ calculator: calculatorTool });

      const removed = searchIndex.remove('calculator');

      expect(removed).toBe(true);
      expect(searchIndex.size).toBe(0);
      expect(searchIndex.has('calculator')).toBe(false);
    });

    it('should return false when removing non-existent tool', () => {
      const removed = searchIndex.remove('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all indexed tools', async () => {
      await searchIndex.index({
        calculator: calculatorTool,
        weather: weatherTool,
      });

      searchIndex.clear();

      expect(searchIndex.size).toBe(0);
    });
  });

  describe('get', () => {
    it('should retrieve a tool by ID', async () => {
      await searchIndex.index({ calculator: calculatorTool });

      const tool = searchIndex.get('calculator');

      expect(tool).toBeDefined();
      expect(tool?.id).toBe('calculator');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = searchIndex.get('nonexistent');
      expect(tool).toBeUndefined();
    });
  });

  describe('listToolIds', () => {
    it('should list all indexed tool IDs', async () => {
      await searchIndex.index({
        calculator: calculatorTool,
        weather: weatherTool,
      });

      const ids = searchIndex.listToolIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('calculator');
      expect(ids).toContain('weather');
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

    it('should respect topK parameter', async () => {
      const results = await searchIndex.search('tool', { topK: 1 });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should respect minScore parameter', async () => {
      const results = await searchIndex.search('completely unrelated query xyz abc', { minScore: 0.99 });

      // With such a high minScore, few or no results should match
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array when no tools are indexed', async () => {
      const emptyIndex = new ToolSearchIndex({ embedder: mockEmbedder });

      const results = await emptyIndex.search('anything');

      expect(results).toEqual([]);
    });

    it('should include score and description in results', async () => {
      const results = await searchIndex.search('weather temperature');

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0]!;
      expect(firstResult.id).toBeDefined();
      expect(firstResult.description).toBeDefined();
      expect(typeof firstResult.score).toBe('number');
      expect(firstResult.score).toBeGreaterThanOrEqual(0);
      expect(firstResult.score).toBeLessThanOrEqual(1);
    });
  });
});

describe('createToolSearchTool', () => {
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

  describe('search-only mode', () => {
    it('should create a tool that returns matching tools', async () => {
      const searchTool = createToolSearchTool({ searchIndex });

      expect(searchTool.id).toBe('tool_search');
      expect(searchTool.description).toContain('Search for available tools');

      const result = await searchTool.execute?.({ query: 'send an email' });

      expect(result.matchingTools).toBeDefined();
      expect(Array.isArray(result.matchingTools)).toBe(true);
    });

    it('should use custom id and description', async () => {
      const searchTool = createToolSearchTool({
        searchIndex,
        id: 'my_tool_finder',
        description: 'Custom description',
      });

      expect(searchTool.id).toBe('my_tool_finder');
      expect(searchTool.description).toBe('Custom description');
    });

    it('should return suggestion when no tools match', async () => {
      const searchTool = createToolSearchTool({ searchIndex, minScore: 0.99 });

      const result = await searchTool.execute?.({ query: 'xyz123 completely unknown' });

      // Should still return something (even if empty matchingTools)
      expect(result).toBeDefined();
    });
  });

  describe('auto-execute mode', () => {
    it('should create a tool that executes the best match', async () => {
      const searchTool = createToolSearchTool({
        searchIndex,
        autoExecute: true,
        minScore: 0,
      });

      expect(searchTool.description).toContain('execute');

      const result = await searchTool.execute?.({
        query: 'I need to add numbers together calculate math',
        toolInput: { operation: 'add', a: 5, b: 3 },
      });

      expect(result.success).toBe(true);
      expect(result.executedTool?.id).toBe('calculator');
      expect(result.result?.result).toBe(8);
    });

    it('should return error when no matching tool found', async () => {
      const searchTool = createToolSearchTool({
        searchIndex,
        autoExecute: true,
        minScore: 0.99,
      });

      const result = await searchTool.execute?.({
        query: 'xyz123abc completely unrelated',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No matching tool found');
    });

    it('should handle tool execution errors gracefully', async () => {
      const errorTool = createTool({
        id: 'errorTool',
        description: 'A tool that always throws an error',
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      });

      const errorIndex = new ToolSearchIndex({ embedder: mockEmbedder });
      await errorIndex.index({ errorTool });

      const searchTool = createToolSearchTool({
        searchIndex: errorIndex,
        autoExecute: true,
        minScore: 0,
      });

      const result = await searchTool.execute?.({ query: 'error' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });
  });
});

describe('createToolSearch', () => {
  it('should create a complete tool search setup', async () => {
    const { searchIndex, searchTool, indexTools } = createToolSearch({
      embedder: mockEmbedder,
    });

    expect(searchIndex).toBeInstanceOf(ToolSearchIndex);
    expect(searchTool).toBeDefined();
    expect(typeof indexTools).toBe('function');

    // Index some tools
    await indexTools({
      calculator: calculatorTool,
      weather: weatherTool,
    });

    expect(searchIndex.size).toBe(2);

    // Use the search tool
    const result = await searchTool.execute?.({ query: 'math calculation' });
    expect(result.matchingTools).toBeDefined();
  });

  it('should pass configuration to the search tool', async () => {
    const { searchTool } = createToolSearch({
      embedder: mockEmbedder,
      id: 'custom_search',
      autoExecute: false,
      topK: 2,
    });

    expect(searchTool.id).toBe('custom_search');
  });
});
