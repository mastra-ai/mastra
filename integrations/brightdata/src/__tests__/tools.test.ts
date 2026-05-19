import { describe, it, expect, vi } from 'vitest';

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn(function () {
    return {
      search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
      scrapeUrl: vi.fn(),
    };
  }),
}));

import { createBrightDataTools } from '../tools.js';

describe('createBrightDataTools', () => {
  it('should return both tools', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch).toBeDefined();
    expect(tools.webFetch).toBeDefined();
  });

  it('should create tools with correct ids', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch.id).toBe('brightdata-search');
    expect(tools.webFetch.id).toBe('brightdata-fetch');
  });

  it('should create tools that all have descriptions', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch.description).toBeTruthy();
    expect(tools.webFetch.description).toBeTruthy();
  });

  it('should create tools that all have input and output schemas', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch.inputSchema).toBeDefined();
    expect(tools.webSearch.outputSchema).toBeDefined();
    expect(tools.webFetch.inputSchema).toBeDefined();
    expect(tools.webFetch.outputSchema).toBeDefined();
  });
});
