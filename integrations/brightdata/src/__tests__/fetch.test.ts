import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScrapeUrl = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn(function () {
    return {
      search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
      scrapeUrl: mockScrapeUrl,
      close: mockClose,
    };
  }),
}));

import { createBrightDataFetchTool } from '../fetch.js';

describe('createBrightDataFetchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeUrl.mockResolvedValue('# Example Page\n\nHello world.');
  });

  it('should create a tool with id brightdata-fetch', () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('brightdata-fetch');
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

  it('should close the client after a successful execute', async () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await tool.execute!({ url: 'https://example.com' }, {} as any);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should close the client even when execute throws', async () => {
    mockScrapeUrl.mockRejectedValue(new Error('boom'));
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ url: 'https://example.com' }, {} as any)).rejects.toThrow('boom');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
