import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGoogle = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn(function () {
    return {
      search: { google: mockGoogle, bing: vi.fn(), yandex: vi.fn() },
      scrapeUrl: vi.fn(),
      close: mockClose,
    };
  }),
}));

import { createBrightDataSearchTool } from '../search.js';

describe('createBrightDataSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogle.mockResolvedValue({
      organic: [
        {
          link: 'https://example.com/a',
          title: 'Example A',
          description: 'A description',
        },
        {
          link: 'https://example.com/b',
          title: 'Example B',
          description: 'B description',
        },
      ],
      current_page: 2,
    });
  });

  it('should create a tool with id brightdata-search', () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('brightdata-search');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.search.google with mapped parameters', async () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    const result = await tool.execute!(
      { query: 'pizza restaurants', country: 'us', start: 10 },
      {} as any,
    );

    expect(mockGoogle).toHaveBeenCalledWith('pizza restaurants', {
      country: 'us',
      start: 10,
    });

    expect(result).toEqual({
      query: 'pizza restaurants',
      results: [
        { link: 'https://example.com/a', title: 'Example A', description: 'A description' },
        { link: 'https://example.com/b', title: 'Example B', description: 'B description' },
      ],
      currentPage: 2,
    });
  });

  it('should handle minimal input (only query)', async () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await tool.execute!({ query: 'simple search' }, {} as any);

    expect(mockGoogle).toHaveBeenCalledWith('simple search', {
      country: undefined,
      start: undefined,
    });
  });

  it('should default to empty results when organic is missing', async () => {
    mockGoogle.mockResolvedValue({});

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([]);
    expect(result.currentPage).toBe(1);
  });

  it('should default currentPage to 1 when current_page is missing or non-positive', async () => {
    mockGoogle.mockResolvedValue({ organic: [], current_page: 0 });

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.currentPage).toBe(1);
  });

  it('should filter out organic entries missing link or title', async () => {
    mockGoogle.mockResolvedValue({
      organic: [
        { link: 'https://ok.example', title: 'Has both', description: 'ok' },
        { link: '', title: 'Missing link', description: 'x' },
        { link: 'https://nope.example', title: '', description: 'x' },
        null,
      ],
      current_page: 1,
    });

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([
      { link: 'https://ok.example', title: 'Has both', description: 'ok' },
    ]);
  });

  it('should let errors propagate', async () => {
    mockGoogle.mockRejectedValue(new Error('API rate limit exceeded'));

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow(
      'API rate limit exceeded',
    );
  });

  it('should parse string responses (SDK returns JSON-encoded text)', async () => {
    mockGoogle.mockResolvedValue(
      JSON.stringify({
        organic: [
          { link: 'https://from.string', title: 'Stringified', description: 'ok' },
        ],
        current_page: 3,
      }),
    );

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([
      { link: 'https://from.string', title: 'Stringified', description: 'ok' },
    ]);
    expect(result.currentPage).toBe(3);
  });

  it('should close the client after a successful execute', async () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await tool.execute!({ query: 'test' }, {} as any);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should close the client even when execute throws', async () => {
    mockGoogle.mockRejectedValue(new Error('boom'));
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow('boom');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
