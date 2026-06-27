import { describe, it, expect, vi } from 'vitest';

vi.mock('../client.js', () => ({
  getSofyaClient: vi.fn(() => ({
    search: vi.fn(),
    fetch: vi.fn(),
    extract: vi.fn(),
    research: vi.fn(),
  })),
}));

import { createSofyaTools } from '../tools.js';

describe('createSofyaTools', () => {
  it('returns all four tools with the expected ids', () => {
    const tools = createSofyaTools({ apiKey: 'test-key' });

    expect(Object.keys(tools)).toEqual(['sofyaSearch', 'sofyaFetch', 'sofyaExtract', 'sofyaResearch']);
    expect(tools.sofyaSearch.id).toBe('sofya-search');
    expect(tools.sofyaFetch.id).toBe('sofya-fetch');
    expect(tools.sofyaExtract.id).toBe('sofya-extract');
    expect(tools.sofyaResearch.id).toBe('sofya-research');
  });
});
