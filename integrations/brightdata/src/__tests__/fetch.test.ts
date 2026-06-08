import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

vi.mock('@mastra/core/tools', () => ({
  createTool: vi.fn(config => config),
}));

import { createBrightDataFetchTool } from '../fetch.js';

describe('createBrightDataFetchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('# Example Page\n\nHello world.'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(requestBody).toEqual({
      data_format: 'markdown',
      format: 'raw',
      method: 'GET',
      url: 'https://example.com',
      zone: 'sdk_unlocker',
    });

    expect(result).toEqual({
      url: 'https://example.com',
      content: '# Example Page\n\nHello world.',
    });
  });

  it('should let errors propagate', async () => {
    fetchMock.mockRejectedValue(new Error('Network unreachable'));

    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ url: 'https://example.com' }, {} as any)).rejects.toThrow(
      'Network unreachable',
    );
  });

  it('should make one Bright Data request after a successful execute', async () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await tool.execute!({ url: 'https://example.com' }, {} as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should preserve the primary error when execute throws', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ url: 'https://example.com' }, {} as any)).rejects.toThrow('boom');
  });
});
