import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetContents = vi.fn();

vi.mock('exa-js', () => {
  class FakeExa {
    headers = { set: vi.fn() };
    search = vi.fn();
    findSimilar = vi.fn();
    getContents = mockGetContents;
    answer = vi.fn();
  }
  return { default: FakeExa };
});

import { createExaGetContentsTool } from '../get-contents.js';

describe('createExaGetContentsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContents.mockResolvedValue({
      requestId: 'req-1',
      results: [
        {
          id: 'a',
          url: 'https://a.com',
          title: 'A',
          text: 'full text',
          highlights: ['h1'],
          summary: 'sum',
        },
      ],
      costDollars: { total: 0.002 },
    });
  });

  it('creates a tool with the correct id', () => {
    const tool = createExaGetContentsTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('exa-get-contents');
  });

  it('passes urls and content options through', async () => {
    const tool = createExaGetContentsTool({ apiKey: 'test-key' });

    await tool.execute!(
      {
        urls: ['https://a.com', 'https://b.com'],
        text: { maxCharacters: 500 },
        highlights: true,
        summary: { query: 'pricing' },
        livecrawl: 'always',
        livecrawlTimeout: 5000,
        subpages: 2,
        subpageTarget: 'docs',
      },
      {} as any,
    );

    expect(mockGetContents).toHaveBeenCalledTimes(1);
    const [urls, options] = mockGetContents.mock.calls[0]!;
    expect(urls).toEqual(['https://a.com', 'https://b.com']);
    expect(options.text).toEqual({ maxCharacters: 500 });
    expect(options.highlights).toBe(true);
    expect(options.summary).toEqual({ query: 'pricing' });
    expect(options.livecrawl).toBe('always');
    expect(options.subpages).toBe(2);
    expect(options.subpageTarget).toBe('docs');
  });

  it('cascades through content fields gracefully when only summary is present', async () => {
    mockGetContents.mockResolvedValue({
      results: [{ id: 'b', url: 'https://b.com', title: 'B', summary: 'only summary' }],
    });

    const tool = createExaGetContentsTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ urls: ['https://b.com'], summary: true }, {} as any)) as any;

    expect(result.results[0].summary).toBe('only summary');
    expect(result.results[0].text).toBeUndefined();
    expect(result.results[0].highlights).toBeUndefined();
  });

  it('handles missing results array', async () => {
    mockGetContents.mockResolvedValue({ requestId: 'r' });
    const tool = createExaGetContentsTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ urls: ['https://x.com'] }, {} as any)) as any;
    expect(result.results).toEqual([]);
  });
});
