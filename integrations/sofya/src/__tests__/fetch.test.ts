import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchMethod = vi.fn();

vi.mock('../client.js', () => ({
  getSofyaClient: vi.fn(() => ({
    search: vi.fn(),
    fetch: mockFetchMethod,
    extract: vi.fn(),
    research: vi.fn(),
  })),
}));

import { createSofyaFetchTool } from '../fetch.js';

describe('createSofyaFetchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMethod.mockResolvedValue({
      results: [
        { title: 'Example', url: 'https://example.com', content: '# Example', raw_html: null, published_time: null, success: true, error: null },
        { title: null, url: 'https://bad.example', content: '', raw_html: null, published_time: null, success: false, error: 'not found' },
      ],
      credits_used: 2,
      credits_remaining: 98,
    });
  });

  it('creates a tool with the correct id', () => {
    const tool = createSofyaFetchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('sofya-fetch');
  });

  it('calls client.fetch with mapped parameters', async () => {
    const tool = createSofyaFetchTool({ apiKey: 'test-key' });

    await tool.execute!({ urls: ['https://example.com'], includeRawHtml: true }, {} as any);

    expect(mockFetchMethod).toHaveBeenCalledWith({
      urls: ['https://example.com'],
      includeRawHtml: true,
    });
  });

  it('maps results and preserves per-url success flags', async () => {
    const tool = createSofyaFetchTool({ apiKey: 'test-key' });

    const result = (await tool.execute!({ urls: ['https://example.com', 'https://bad.example'] }, {} as any)) as any;

    expect(result.results).toEqual([
      { title: 'Example', url: 'https://example.com', content: '# Example', rawHtml: undefined, publishedTime: undefined, success: true, error: undefined },
      { title: undefined, url: 'https://bad.example', content: '', rawHtml: undefined, publishedTime: undefined, success: false, error: 'not found' },
    ]);
    expect(result.creditsUsed).toBe(2);
    expect(result.creditsRemaining).toBe(98);
  });
});
