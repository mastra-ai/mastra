import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGoogleSearch = vi.fn();
const mockAmazonProduct = vi.fn();

vi.mock('scavio', () => ({
  Scavio: vi.fn(() => ({
    google: { search: mockGoogleSearch },
    amazon: { search: vi.fn(), product: mockAmazonProduct },
    walmart: { search: vi.fn(), product: vi.fn() },
    youtube: { search: vi.fn(), metadata: vi.fn() },
    reddit: { search: vi.fn(), post: vi.fn() },
    tiktok: { searchVideos: vi.fn(), profile: vi.fn() },
    instagram: { searchUsers: vi.fn(), profile: vi.fn() },
  })),
}));

import { createScavioGoogleSearchTool } from '../google.js';
import { createScavioTools } from '../tools.js';

describe('createScavioTools', () => {
  it('returns all Scavio tools keyed by name', () => {
    const tools = createScavioTools({ apiKey: 'test-key' });
    expect(Object.keys(tools)).toEqual([
      'scavioGoogleSearch',
      'scavioAmazonSearch',
      'scavioAmazonProduct',
      'scavioWalmartSearch',
      'scavioWalmartProduct',
      'scavioYoutubeSearch',
      'scavioYoutubeMetadata',
      'scavioRedditSearch',
      'scavioRedditPost',
      'scavioTiktokSearch',
      'scavioTiktokProfile',
      'scavioInstagramSearch',
      'scavioInstagramProfile',
    ]);
    expect(tools.scavioGoogleSearch.id).toBe('scavio-google-search');
  });
});

describe('createScavioGoogleSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleSearch.mockResolvedValue({ results: [{ title: 'r1', url: 'https://example.com' }] });
  });

  it('has the correct id, description, and schemas', () => {
    const tool = createScavioGoogleSearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('scavio-google-search');
    expect(tool.description!.length).toBeGreaterThan(0);
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('calls client.google.search with the input and returns the response', async () => {
    const tool = createScavioGoogleSearchTool({ apiKey: 'test-key' });
    const input = { query: 'pydantic ai', light_request: true };
    const result = await tool.execute!(input, {} as any);
    expect(mockGoogleSearch).toHaveBeenCalledWith(input);
    expect(result).toEqual({ results: [{ title: 'r1', url: 'https://example.com' }] });
  });
});
