import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtract = vi.fn();

vi.mock('../client.js', () => ({
  getSofyaClient: vi.fn(() => ({
    search: vi.fn(),
    fetch: vi.fn(),
    extract: mockExtract,
    research: vi.fn(),
  })),
}));

import { createSofyaExtractTool } from '../extract.js';

describe('createSofyaExtractTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtract.mockResolvedValue({
      url: 'https://example.com/pricing',
      content: 'Pro plan: $20/mo',
      credits_used: 5,
      credits_remaining: 95,
      usage: { input_tokens: 100, output_tokens: 20 },
    });
  });

  it('creates a tool with the correct id', () => {
    const tool = createSofyaExtractTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('sofya-extract');
  });

  it('calls client.extract with the url and prompt', async () => {
    const tool = createSofyaExtractTool({ apiKey: 'test-key' });

    await tool.execute!({ url: 'https://example.com/pricing', prompt: 'list pricing' }, {} as any);

    expect(mockExtract).toHaveBeenCalledWith({ url: 'https://example.com/pricing', prompt: 'list pricing' });
  });

  it('maps the response to the output schema', async () => {
    const tool = createSofyaExtractTool({ apiKey: 'test-key' });

    const result = (await tool.execute!({ url: 'https://example.com/pricing', prompt: 'list pricing' }, {} as any)) as any;

    expect(result).toEqual({
      url: 'https://example.com/pricing',
      content: 'Pro plan: $20/mo',
      creditsUsed: 5,
      creditsRemaining: 95,
    });
  });
});
