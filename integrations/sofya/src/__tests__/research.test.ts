import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResearch = vi.fn();

vi.mock('../client.js', () => ({
  getSofyaClient: vi.fn(() => ({
    search: vi.fn(),
    fetch: vi.fn(),
    extract: vi.fn(),
    research: mockResearch,
  })),
}));

import { createSofyaResearchTool } from '../research.js';

describe('createSofyaResearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResearch.mockResolvedValue({
      query: 'what is mastra',
      report: 'Mastra is a TypeScript AI framework.',
      sources: [{ title: 'Mastra', url: 'https://mastra.ai', fetched: true }],
      sub_queries: ['mastra overview', 'mastra features'],
      credits_used: 25,
      credits_remaining: 75,
    });
  });

  it('creates a tool with the correct id', () => {
    const tool = createSofyaResearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('sofya-research');
  });

  it('calls client.research with mapped parameters', async () => {
    const tool = createSofyaResearchTool({ apiKey: 'test-key' });

    await tool.execute!({ query: 'what is mastra', topic: 'general', maxSources: 10 }, {} as any);

    expect(mockResearch).toHaveBeenCalledWith({
      query: 'what is mastra',
      topic: 'general',
      freshness: undefined,
      maxSources: 10,
    });
  });

  it('maps the report, sources, and sub-queries to the output schema', async () => {
    const tool = createSofyaResearchTool({ apiKey: 'test-key' });

    const result = (await tool.execute!({ query: 'what is mastra' }, {} as any)) as any;

    expect(result).toEqual({
      query: 'what is mastra',
      report: 'Mastra is a TypeScript AI framework.',
      sources: [{ title: 'Mastra', url: 'https://mastra.ai', fetched: true }],
      subQueries: ['mastra overview', 'mastra features'],
      creditsUsed: 25,
      creditsRemaining: 75,
    });
  });
});
