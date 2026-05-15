import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

vi.mock('@mastra/core/tools', () => ({
  createTool: vi.fn(config => config),
}));

import { createBrightDataSearchTool } from '../search.js';

describe('createBrightDataSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      Response.json({
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
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      { query: 'pizza restaurants', country: 'us', language: 'es', start: 10 },
      {} as any,
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(requestBody).toMatchObject({
      format: 'json',
      method: 'GET',
      zone: 'sdk_serp',
    });
    expect(requestBody.url).toContain('https://www.google.com/search');
    expect(requestBody.url).toContain('q=pizza+restaurants');
    expect(requestBody.url).toContain('gl=us');
    expect(requestBody.url).toContain('hl=es');
    expect(requestBody.url).toContain('start=10');

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

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(requestBody.url).toContain('q=simple+search');
    expect(requestBody.url).toContain('hl=en');
    expect(requestBody.url).not.toContain('gl=');
    expect(requestBody.url).not.toContain('start=');
  });

  it('should default to empty results when organic is missing', async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([]);
    expect(result.currentPage).toBe(1);
  });

  it('should default currentPage to 1 when current_page is missing or non-positive', async () => {
    fetchMock.mockResolvedValue(Response.json({ organic: [], current_page: 0 }));

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.currentPage).toBe(1);
  });

  it('should filter out organic entries missing link or title', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        organic: [
          { link: 'https://ok.example', title: 'Has both', description: 'ok' },
          { link: '', title: 'Missing link', description: 'x' },
          { link: 'https://nope.example', title: '', description: 'x' },
          null,
        ],
        current_page: 1,
      }),
    );

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([
      { link: 'https://ok.example', title: 'Has both', description: 'ok' },
    ]);
  });

  it('should let errors propagate', async () => {
    fetchMock.mockRejectedValue(new Error('API rate limit exceeded'));

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow(
      'API rate limit exceeded',
    );
  });

  it('should parse string responses (SDK returns JSON-encoded text)', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
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

  it('should make one Bright Data request after a successful execute', async () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await tool.execute!({ query: 'test' }, {} as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should preserve the primary error when execute throws', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow('boom');
  });
});
