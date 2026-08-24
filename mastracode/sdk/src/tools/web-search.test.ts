import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const providerMocks = vi.hoisted(() => ({
  parallelSearchExecute: vi.fn(),
  parallelExtractExecute: vi.fn(),
}));

vi.mock('@mastra/parallel', () => ({
  createParallelSearchTool: () => ({
    description: 'parallel search',
    inputSchema: z.object({ searchQueries: z.array(z.string()) }),
    execute: providerMocks.parallelSearchExecute,
  }),
  createParallelExtractTool: () => ({
    description: 'parallel extract',
    inputSchema: z.object({ urls: z.array(z.string()) }),
    execute: providerMocks.parallelExtractExecute,
  }),
}));

vi.mock('@mastra/tavily', () => ({
  createTavilySearchTool: () => ({
    description: 'tavily search',
    inputSchema: z.object({ query: z.string() }),
    execute: vi.fn(),
  }),
  createTavilyExtractTool: () => ({
    description: 'tavily extract',
    inputSchema: z.object({ urls: z.array(z.string()) }),
    execute: vi.fn(),
  }),
}));

import { createConfiguredWebTools, createParallelWebExtractTool, createParallelWebSearchTool } from './web-search.js';

describe('createConfiguredWebTools', () => {
  const originalParallelKey = process.env.PARALLEL_API_KEY;
  const originalTavilyKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    delete process.env.PARALLEL_API_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (originalParallelKey === undefined) delete process.env.PARALLEL_API_KEY;
    else process.env.PARALLEL_API_KEY = originalParallelKey;

    if (originalTavilyKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = originalTavilyKey;
  });

  it('selects Parallel when both provider keys are configured', () => {
    process.env.PARALLEL_API_KEY = 'parallel-key';
    process.env.TAVILY_API_KEY = 'tavily-key';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('parallel search');
    expect(tools?.web_extract.description).toBe('parallel extract');
  });

  it('falls back to Tavily when only its key is configured', () => {
    process.env.TAVILY_API_KEY = 'tavily-key';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('tavily search');
    expect(tools?.web_extract.description).toBe('tavily extract');
  });

  it('returns no model-independent tools when neither key is configured', () => {
    expect(createConfiguredWebTools()).toBeUndefined();
  });
});

describe('Parallel web tool adapters', () => {
  it('formats Parallel search results for Mastra Code', async () => {
    providerMocks.parallelSearchExecute.mockResolvedValueOnce({
      searchId: 'search-1',
      sessionId: 'session-1',
      results: [
        {
          url: 'https://example.com/result',
          title: 'Example result',
          excerpts: ['First relevant excerpt.', 'Second relevant excerpt.'],
        },
      ],
      usage: [{ name: 'search', count: 1 }],
      warnings: [],
    });
    const tool = createParallelWebSearchTool();

    const output = await tool.execute!({ searchQueries: ['example query'] }, {} as never);

    expect(output).toBe(
      '## Example result\nhttps://example.com/result\nFirst relevant excerpt.\nSecond relevant excerpt.',
    );
  });

  it('formats Parallel extraction results and per-URL errors for Mastra Code', async () => {
    providerMocks.parallelExtractExecute.mockResolvedValueOnce({
      extractId: 'extract-1',
      sessionId: 'session-1',
      results: [
        {
          url: 'https://example.com/page',
          title: 'Example page',
          excerpts: ['Relevant page excerpt.'],
          fullContent: 'Full page content.',
        },
      ],
      errors: [
        {
          url: 'https://example.com/missing',
          errorType: 'not_found',
          httpStatusCode: 404,
          content: 'Page not found',
        },
      ],
      usage: [{ name: 'extract', count: 1 }],
      warnings: [],
    });
    const tool = createParallelWebExtractTool();

    const output = await tool.execute!({ urls: ['https://example.com/page'] }, {} as never);

    expect(output).toBe(
      '## https://example.com/page\nFull page content.\n\n## https://example.com/missing\nError: not_found (404)\nPage not found',
    );
  });
});
