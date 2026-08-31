import { describe, expect, it, vi } from 'vitest';

const { mockParallel } = vi.hoisted(() => ({
  mockParallel: vi.fn(function ParallelClient() {
    return { search: vi.fn(), extract: vi.fn() };
  }),
}));

vi.mock('parallel-web', () => ({ default: mockParallel }));

import { createParallelTools } from '../tools.js';

describe('createParallelTools', () => {
  it('returns both configured tools without constructing clients', () => {
    const tools = createParallelTools({ apiKey: 'parallel-test' });

    expect(Object.keys(tools)).toEqual(['parallelSearch', 'parallelExtract']);
    expect(tools.parallelSearch.id).toBe('parallel-search');
    expect(tools.parallelExtract.id).toBe('parallel-extract');
    expect(tools.parallelSearch.inputSchema).toBeDefined();
    expect(tools.parallelSearch.outputSchema).toBeDefined();
    expect(tools.parallelExtract.inputSchema).toBeDefined();
    expect(tools.parallelExtract.outputSchema).toBeDefined();
    expect(mockParallel).not.toHaveBeenCalled();
  });
});
