import { describe, expect, it } from 'vitest';

describe('root export', () => {
  it('does not expose named exports from the root barrel', async () => {
    const root = await import('./index');

    expect(Object.keys(root)).toEqual([]);
  });
});
