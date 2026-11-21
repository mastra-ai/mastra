import { describe, expect, it, vi } from 'vitest';

const { mockCeramic } = vi.hoisted(() => ({
  mockCeramic: vi.fn(function CeramicClient() {
    return { search: vi.fn() };
  }),
}));

vi.mock('ceramic-ai', () => ({ default: mockCeramic }));

import { createCeramicTools } from '../tools.js';

describe('createCeramicTools', () => {
  it('returns the configured search tool without constructing a client', () => {
    const tools = createCeramicTools({ apiKey: 'ceramic-test' });

    expect(Object.keys(tools)).toEqual(['ceramicSearch']);
    expect(tools.ceramicSearch.id).toBe('ceramic-search');
    expect(tools.ceramicSearch.inputSchema).toBeDefined();
    expect(tools.ceramicSearch.outputSchema).toBeDefined();
    expect(mockCeramic).not.toHaveBeenCalled();
  });
});
