import { describe, it, expect, vi } from 'vitest';

vi.mock('@tavily/core', () => ({
  tavily: vi.fn(() => ({
    search: vi.fn(),
    extract: vi.fn(),
    crawl: vi.fn(),
    map: vi.fn(),
  })),
}));

import { createTavilyTools } from '../tools.js';

describe('createTavilyTools', () => {
  it('should return all four tools', () => {
    const tools = createTavilyTools({ apiKey: 'test-key' });

    expect(tools.tavilySearch).toBeDefined();
    expect(tools.tavilyExtract).toBeDefined();
    expect(tools.tavilyCrawl).toBeDefined();
    expect(tools.tavilyMap).toBeDefined();
  });

  it('should create tools with correct ids', () => {
    const tools = createTavilyTools({ apiKey: 'test-key' });

    expect(tools.tavilySearch.id).toBe('tavily-search');
    expect(tools.tavilyExtract.id).toBe('tavily-extract');
    expect(tools.tavilyCrawl.id).toBe('tavily-crawl');
    expect(tools.tavilyMap.id).toBe('tavily-map');
  });

  it('should create tools that all have descriptions', () => {
    const tools = createTavilyTools({ apiKey: 'test-key' });

    expect(tools.tavilySearch.description).toBeTruthy();
    expect(tools.tavilyExtract.description).toBeTruthy();
    expect(tools.tavilyCrawl.description).toBeTruthy();
    expect(tools.tavilyMap.description).toBeTruthy();
  });

  it('should create tools that all have input and output schemas', () => {
    const tools = createTavilyTools({ apiKey: 'test-key' });

    expect(tools.tavilySearch.inputSchema).toBeDefined();
    expect(tools.tavilySearch.outputSchema).toBeDefined();
    expect(tools.tavilyExtract.inputSchema).toBeDefined();
    expect(tools.tavilyExtract.outputSchema).toBeDefined();
    expect(tools.tavilyCrawl.inputSchema).toBeDefined();
    expect(tools.tavilyCrawl.outputSchema).toBeDefined();
    expect(tools.tavilyMap.inputSchema).toBeDefined();
    expect(tools.tavilyMap.outputSchema).toBeDefined();
  });
});
