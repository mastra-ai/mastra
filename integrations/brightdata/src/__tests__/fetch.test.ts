import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScrapeUrl = vi.fn();

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn(function () {
    return {
      search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
      scrapeUrl: mockScrapeUrl,
    };
  }),
}));

import { createBrightDataFetchTool } from '../fetch.js';

describe('createBrightDataFetchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeUrl.mockResolvedValue('# Example Page\n\nHello world.');
  });

  it('should create a tool with id web-fetch', () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('web-fetch');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.scrapeUrl with markdown dataFormat', async () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    const result = await tool.execute!({ url: 'https://example.com' }, {} as any);

    expect(mockScrapeUrl).toHaveBeenCalledWith('https://example.com', {
      dataFormat: 'markdown',
    });

    expect(result).toEqual({
      url: 'https://example.com',
      content: '# Example Page\n\nHello world.',
    });
  });

  it('should let errors propagate', async () => {
    mockScrapeUrl.mockRejectedValue(new Error('Network unreachable'));

    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ url: 'https://example.com' }, {} as any)).rejects.toThrow(
      'Network unreachable',
    );
  });
});
