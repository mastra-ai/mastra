import { describe, expect, it, vi } from 'vitest';

const createHighlighterCore = vi.hoisted(() => vi.fn());

vi.mock('shiki/core', () => ({ createHighlighterCore }));

import { highlight } from '../highlight';

describe('highlight', () => {
  it('retries loading the highlighter after a failed load', async () => {
    const tokens = [[{ content: 'const', offset: 0 }]];
    createHighlighterCore
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ codeToTokens: () => ({ tokens }) });

    await expect(highlight('const', 'ts')).rejects.toThrow('Failed to fetch');
    await expect(highlight('const', 'ts')).resolves.toEqual(tokens);
    expect(createHighlighterCore).toHaveBeenCalledTimes(2);
  });
});
