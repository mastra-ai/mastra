import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const providerMocks = vi.hoisted(() => ({
  parallelSearchExecute: vi.fn(),
  parallelExtractExecute: vi.fn(),
  firecrawlSearchExecute: vi.fn(),
  firecrawlScrapeExecute: vi.fn(),
}));

vi.mock('@mastra/firecrawl', () => ({
  createFirecrawlSearchTool: () => ({
    description: 'firecrawl search',
    inputSchema: z.object({ query: z.string() }),
    execute: providerMocks.firecrawlSearchExecute,
  }),
  createFirecrawlScrapeTool: () => ({
    description: 'firecrawl scrape',
    inputSchema: z.object({ url: z.string() }),
    execute: providerMocks.firecrawlScrapeExecute,
  }),
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

const settingsMock = vi.hoisted(() => ({ webSearchProvider: 'auto' as string }));

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({ preferences: { webSearchProvider: settingsMock.webSearchProvider } }),
}));

import {
  createConfiguredWebTools,
  createFirecrawlWebExtractTool,
  createFirecrawlWebSearchTool,
  createParallelWebExtractTool,
  createParallelWebSearchTool,
  resolveWebSearchProvider,
} from './web-search.js';

describe('createConfiguredWebTools', () => {
  const originalParallelKey = process.env.PARALLEL_API_KEY;
  const originalTavilyKey = process.env.TAVILY_API_KEY;
  const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    delete process.env.PARALLEL_API_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    settingsMock.webSearchProvider = 'auto';
  });

  afterEach(() => {
    if (originalParallelKey === undefined) delete process.env.PARALLEL_API_KEY;
    else process.env.PARALLEL_API_KEY = originalParallelKey;

    if (originalTavilyKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = originalTavilyKey;

    if (originalFirecrawlKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalFirecrawlKey;
  });

  it('honors an explicit Firecrawl preference when its key is configured', () => {
    process.env.FIRECRAWL_API_KEY = 'fc-key';
    process.env.TAVILY_API_KEY = 'tavily-key';
    settingsMock.webSearchProvider = 'firecrawl';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('firecrawl search');
    expect(tools?.web_extract.description).toBe('firecrawl scrape');
  });

  it('selects Firecrawl in auto mode only when it is the sole configured key', () => {
    process.env.FIRECRAWL_API_KEY = 'fc-key';
    expect(createConfiguredWebTools()?.web_search.description).toBe('firecrawl search');

    process.env.PARALLEL_API_KEY = 'parallel-key';
    expect(createConfiguredWebTools()?.web_search.description).toBe('parallel search');
  });

  it('resolveWebSearchProvider falls back from firecrawl when its key is missing', () => {
    process.env.TAVILY_API_KEY = 'tavily-key';
    expect(resolveWebSearchProvider('firecrawl')).toBe('tavily');

    process.env.FIRECRAWL_API_KEY = 'fc-key';
    expect(resolveWebSearchProvider('firecrawl')).toBe('firecrawl');
  });

  it('selects Tavily in auto mode when both provider keys are configured', () => {
    process.env.PARALLEL_API_KEY = 'parallel-key';
    process.env.TAVILY_API_KEY = 'tavily-key';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('tavily search');
    expect(tools?.web_extract.description).toBe('tavily extract');
  });

  it('honors an explicit Parallel preference when its key is configured', () => {
    process.env.PARALLEL_API_KEY = 'parallel-key';
    process.env.TAVILY_API_KEY = 'tavily-key';
    settingsMock.webSearchProvider = 'parallel';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('parallel search');
    expect(tools?.web_extract.description).toBe('parallel extract');
  });

  it('falls back to the configured provider when the preferred key is missing', () => {
    process.env.TAVILY_API_KEY = 'tavily-key';
    settingsMock.webSearchProvider = 'parallel';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('tavily search');
  });

  it('selects Parallel in auto mode when only its key is configured', () => {
    process.env.PARALLEL_API_KEY = 'parallel-key';

    const tools = createConfiguredWebTools();

    expect(tools?.web_search.description).toBe('parallel search');
    expect(tools?.web_extract.description).toBe('parallel extract');
  });

  it('returns no model-independent tools when neither key is configured', () => {
    expect(createConfiguredWebTools()).toBeUndefined();
  });

  it('resolveWebSearchProvider honors explicit choices only while the key exists', () => {
    process.env.TAVILY_API_KEY = 'tavily-key';
    process.env.PARALLEL_API_KEY = 'parallel-key';
    expect(resolveWebSearchProvider('tavily')).toBe('tavily');
    expect(resolveWebSearchProvider('parallel')).toBe('parallel');
    expect(resolveWebSearchProvider('auto')).toBe('tavily');

    delete process.env.PARALLEL_API_KEY;
    expect(resolveWebSearchProvider('parallel')).toBe('tavily');

    delete process.env.TAVILY_API_KEY;
    expect(resolveWebSearchProvider('tavily')).toBeUndefined();
  });
});

describe('Parallel web tool adapters', () => {
  it('uses Mastra Code query input instead of Parallel searchQueries', () => {
    const tool = createParallelWebSearchTool();
    const inputSchema = tool.inputSchema as z.ZodType;

    expect(inputSchema.safeParse({ query: 'example query' }).success).toBe(true);
    expect(inputSchema.safeParse({ searchQueries: ['example query'] }).success).toBe(false);
  });

  it('formats Parallel search results for Mastra Code', async () => {
    providerMocks.parallelSearchExecute.mockClear();
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

    const output = await tool.execute!({ query: 'example query' }, {} as never);

    expect(output).toBe(
      '## Example result\nhttps://example.com/result\nFirst relevant excerpt.\nSecond relevant excerpt.',
    );
    expect(providerMocks.parallelSearchExecute).toHaveBeenCalledWith(
      { searchQueries: ['example query'] },
      expect.anything(),
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

  it('surfaces Parallel search validation errors', async () => {
    providerMocks.parallelSearchExecute.mockResolvedValueOnce({
      error: true,
      message: 'Invalid Parallel search input',
      validationErrors: { errors: ['Invalid Parallel search input'], fields: {} },
    });
    const tool = createParallelWebSearchTool();

    await expect(tool.execute!({ query: 'example query' }, {} as never)).rejects.toThrow(
      'Invalid Parallel search input',
    );
  });

  it('rejects missing Parallel extract output', async () => {
    providerMocks.parallelExtractExecute.mockResolvedValueOnce(undefined);
    const tool = createParallelWebExtractTool();

    await expect(tool.execute!({ urls: ['https://example.com/page'] }, {} as never)).rejects.toThrow(
      'Parallel extract returned no output',
    );
  });
});

describe('Firecrawl web tool adapters', () => {
  beforeEach(() => {
    providerMocks.firecrawlSearchExecute.mockReset();
    providerMocks.firecrawlScrapeExecute.mockReset();
  });

  it('formats Firecrawl web results for Mastra Code', async () => {
    providerMocks.firecrawlSearchExecute.mockResolvedValueOnce({
      web: [
        { url: 'https://example.com/result', title: 'Example result', description: 'A relevant snippet.' },
        { url: 'https://example.com/untitled' },
      ],
      news: [],
      images: [],
    });
    const tool = createFirecrawlWebSearchTool();

    const output = await tool.execute!({ query: 'example query' }, {} as never);

    expect(output).toBe(
      '## Example result\nhttps://example.com/result\nA relevant snippet.\n\n## https://example.com/untitled\nhttps://example.com/untitled',
    );
    expect(providerMocks.firecrawlSearchExecute).toHaveBeenCalledWith({ query: 'example query' }, expect.anything());
  });

  it('surfaces Firecrawl search validation errors', async () => {
    providerMocks.firecrawlSearchExecute.mockResolvedValueOnce({
      error: true,
      message: 'Invalid Firecrawl search input',
      validationErrors: { errors: ['Invalid Firecrawl search input'], fields: {} },
    });
    const tool = createFirecrawlWebSearchTool();

    await expect(tool.execute!({ query: 'example query' }, {} as never)).rejects.toThrow(
      'Invalid Firecrawl search input',
    );
  });

  it('accepts the shared multi-URL web-extract input and scrapes each URL', async () => {
    providerMocks.firecrawlScrapeExecute
      .mockResolvedValueOnce({ url: 'https://example.com/page', markdown: 'Page content.' })
      .mockRejectedValueOnce(new Error('403 forbidden'));
    const tool = createFirecrawlWebExtractTool();
    const inputSchema = tool.inputSchema as z.ZodType;

    expect(inputSchema.safeParse({ url: 'https://example.com/page' }).success).toBe(false);
    expect(inputSchema.safeParse({ urls: ['https://example.com/page'] }).success).toBe(true);

    const output = await tool.execute!(
      { urls: ['https://example.com/page', 'https://example.com/blocked'] },
      {} as never,
    );

    expect(output).toBe(
      '## https://example.com/page\nPage content.\n\n## https://example.com/blocked\nError: 403 forbidden',
    );
    expect(providerMocks.firecrawlScrapeExecute).toHaveBeenCalledTimes(2);
    expect(providerMocks.firecrawlScrapeExecute).toHaveBeenNthCalledWith(
      1,
      { url: 'https://example.com/page' },
      expect.anything(),
    );
  });

  it('reports missing Firecrawl scrape output inline instead of failing the batch', async () => {
    providerMocks.firecrawlScrapeExecute.mockResolvedValueOnce(undefined);
    const tool = createFirecrawlWebExtractTool();

    const output = await tool.execute!({ urls: ['https://example.com/page'] }, {} as never);

    expect(output).toBe('## https://example.com/page\nError: Firecrawl extract returned no output');
  });
});
