import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindSimilar = vi.fn();

vi.mock('exa-js', () => {
  class FakeExa {
    headers = { set: vi.fn() };
    search = vi.fn();
    findSimilar = mockFindSimilar;
    getContents = vi.fn();
    answer = vi.fn();
  }
  return { default: FakeExa };
});

import { createExaFindSimilarTool } from '../find-similar.js';

describe('createExaFindSimilarTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindSimilar.mockResolvedValue({
      requestId: 'req-1',
      results: [
        {
          id: 'doc-1',
          url: 'https://similar.com',
          title: 'Similar Page',
          score: 0.88,
        },
      ],
      costDollars: { total: 0.005 },
    });
  });

  it('creates a tool with the correct id', () => {
    const tool = createExaFindSimilarTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('exa-find-similar');
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('passes URL and parameters through to findSimilar', async () => {
    const tool = createExaFindSimilarTool({ apiKey: 'test-key' });

    await tool.execute!(
      {
        url: 'https://example.com',
        numResults: 5,
        excludeSourceDomain: true,
        text: true,
      },
      {} as any,
    );

    expect(mockFindSimilar).toHaveBeenCalledTimes(1);
    const [url, options] = mockFindSimilar.mock.calls[0]!;
    expect(url).toBe('https://example.com');
    expect(options.numResults).toBe(5);
    expect(options.excludeSourceDomain).toBe(true);
    expect(options.contents).toEqual({ text: true });
  });

  it('omits contents when no content option is set', async () => {
    const tool = createExaFindSimilarTool({ apiKey: 'test-key' });
    await tool.execute!({ url: 'https://example.com' }, {} as any);
    const [, options] = mockFindSimilar.mock.calls[0]!;
    expect(options.contents).toBeUndefined();
  });

  it('defaults title to null when missing', async () => {
    mockFindSimilar.mockResolvedValue({
      results: [{ id: 'x', url: 'https://x.com', title: null }],
    });

    const tool = createExaFindSimilarTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ url: 'https://example.com' }, {} as any)) as any;
    expect(result.results[0].title).toBeNull();
  });

  it('lets errors propagate', async () => {
    mockFindSimilar.mockRejectedValue(new Error('not found'));
    const tool = createExaFindSimilarTool({ apiKey: 'test-key' });
    await expect(tool.execute!({ url: 'https://example.com' }, {} as any)).rejects.toThrow('not found');
  });
});
