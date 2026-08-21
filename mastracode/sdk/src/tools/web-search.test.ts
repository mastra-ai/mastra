import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockSearchExecute = vi.fn();
const mockExtractExecute = vi.fn();

vi.mock('@parallel-web/ai-sdk-tools', () => ({
  createSearchTool: vi.fn(() => ({
    description: 'Search the web using Parallel',
    inputSchema: { type: 'object' },
    execute: mockSearchExecute,
  })),
  createExtractTool: vi.fn(() => ({
    description: 'Extract content using Parallel',
    inputSchema: { type: 'object' },
    execute: mockExtractExecute,
  })),
}));

import {
  hasTavilyKey,
  hasParallelKey,
  createParallelWebSearchTool,
  createParallelWebExtractTool,
} from './web-search.js';

describe('web-search tools', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('hasTavilyKey', () => {
    it('returns true when TAVILY_API_KEY is present', () => {
      process.env.TAVILY_API_KEY = 'test-key';
      expect(hasTavilyKey()).toBe(true);
    });

    it('returns false when TAVILY_API_KEY is missing', () => {
      delete process.env.TAVILY_API_KEY;
      expect(hasTavilyKey()).toBe(false);
    });
  });

  describe('hasParallelKey', () => {
    it('returns true when PARALLEL_API_KEY is present', () => {
      process.env.PARALLEL_API_KEY = 'parallel-key';
      expect(hasParallelKey()).toBe(true);
    });

    it('returns false when PARALLEL_API_KEY is missing', () => {
      delete process.env.PARALLEL_API_KEY;
      expect(hasParallelKey()).toBe(false);
    });
  });

  describe('createParallelWebSearchTool', () => {
    it('creates a tool with the SDK description and inputSchema', () => {
      const tool = createParallelWebSearchTool();
      expect(tool.id).toBe('web-search');
      expect(tool.description).toBe('Search the web using Parallel');
      expect(tool.inputSchema).toBeDefined();
    });

    it('formats results to markdown string with truncation', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        results: [
          {
            title: 'Mastra Documentation',
            url: 'https://mastra.ai/docs',
            excerpts: ['Mastra is an agent framework.'],
          },
          {
            url: 'https://example.com',
            excerpts: ['First excerpt', 'Second excerpt'],
          },
        ],
      });

      const tool = createParallelWebSearchTool();
      const result = await tool.execute(
        { search_queries: ['mastra documentation'] },
        {} as any,
      );

      expect(mockSearchExecute).toHaveBeenCalledWith(
        { search_queries: ['mastra documentation'] },
        expect.anything(),
      );
      expect(result).toContain('## Mastra Documentation\nhttps://mastra.ai/docs\nMastra is an agent framework.');
      expect(result).toContain('## https://example.com\nFirst excerpt\n\nSecond excerpt');
    });
  });

  describe('createParallelWebExtractTool', () => {
    it('creates a tool with the SDK description and inputSchema', () => {
      const tool = createParallelWebExtractTool();
      expect(tool.id).toBe('web-extract');
      expect(tool.description).toBe('Extract content using Parallel');
      expect(tool.inputSchema).toBeDefined();
    });

    it('formats extracted results and errors to markdown string', async () => {
      mockExtractExecute.mockResolvedValueOnce({
        results: [
          {
            title: 'Page Title',
            url: 'https://mastra.ai',
            excerpts: ['Extracted markdown content.'],
          },
        ],
        errors: [
          {
            url: 'https://bad.url',
            error_type: 'http_404',
          },
        ],
      });

      const tool = createParallelWebExtractTool();
      const result = await tool.execute(
        { urls: ['https://mastra.ai', 'https://bad.url'] },
        {} as any,
      );

      expect(mockExtractExecute).toHaveBeenCalledWith(
        { urls: ['https://mastra.ai', 'https://bad.url'] },
        expect.anything(),
      );
      expect(result).toContain('## Page Title\nhttps://mastra.ai\nExtracted markdown content.');
      expect(result).toContain('## https://bad.url\nError: http_404');
    });
  });
});
