import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockScrape } = vi.hoisted(() => ({ mockScrape: vi.fn() }));

vi.mock('firecrawl', () => ({
  Firecrawl: vi.fn(function FirecrawlClient() {
    return { search: vi.fn(), scrape: mockScrape };
  }),
}));

import { createFirecrawlScrapeTool, toScrapeOptions } from '../scrape.js';

const context = {} as any;

describe('createFirecrawlScrapeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrape.mockResolvedValue({
      markdown: '# Title\n\nBody',
      links: ['https://example.com/a'],
      metadata: { title: 'Title', description: 'Desc', sourceURL: 'https://example.com', statusCode: 200 },
    });
  });

  it('has the expected id, description and schemas', () => {
    const tool = createFirecrawlScrapeTool({ apiKey: 'fc-test' });
    expect(tool.id).toBe('firecrawl-scrape');
    expect(tool.description).toContain('Firecrawl');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('defaults to markdown and forwards the url separately from the options', async () => {
    const tool = createFirecrawlScrapeTool({ apiKey: 'fc-test' });
    await tool.execute!({ url: 'https://example.com' }, context);
    expect(mockScrape).toHaveBeenCalledWith('https://example.com', { formats: ['markdown'] });
  });

  it('maps every supported option', () => {
    expect(
      toScrapeOptions({
        formats: ['html', 'links'],
        onlyMainContent: false,
        includeTags: ['article'],
        excludeTags: ['nav'],
        waitFor: 500,
        timeout: 20_000,
        maxAge: 60_000,
        mobile: true,
      }),
    ).toEqual({
      formats: ['html', 'links'],
      onlyMainContent: false,
      includeTags: ['article'],
      excludeTags: ['nav'],
      waitFor: 500,
      timeout: 20_000,
      maxAge: 60_000,
      mobile: true,
    });
  });

  it('flattens the document and its metadata into the output', async () => {
    const tool = createFirecrawlScrapeTool({ apiKey: 'fc-test' });
    const output = await tool.execute!({ url: 'https://example.com', formats: ['markdown', 'links'] }, context);

    expect(output).toEqual({
      url: 'https://example.com',
      title: 'Title',
      description: 'Desc',
      statusCode: 200,
      markdown: '# Title\n\nBody',
      links: ['https://example.com/a'],
    });
  });

  it('falls back to metadata.url when sourceURL is absent', async () => {
    mockScrape.mockResolvedValue({ markdown: 'x', metadata: { url: 'https://example.com/u' } });
    const tool = createFirecrawlScrapeTool({ apiKey: 'fc-test' });
    await expect(tool.execute!({ url: 'https://example.com' }, context)).resolves.toMatchObject({
      url: 'https://example.com/u',
    });
  });

  it('rejects invalid input', async () => {
    const tool = createFirecrawlScrapeTool({ apiKey: 'fc-test' });
    const result = await tool.execute!({ url: 'not-a-url' } as any, context);
    expect(result).toMatchObject({ error: true });
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('propagates SDK errors', async () => {
    mockScrape.mockRejectedValue(new Error('403 forbidden'));
    const tool = createFirecrawlScrapeTool({ apiKey: 'fc-test' });
    await expect(tool.execute!({ url: 'https://example.com' }, context)).rejects.toThrow('403 forbidden');
  });
});
