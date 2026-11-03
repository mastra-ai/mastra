// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useStableWhile } from './useStableWhile';

const sameItems = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

describe('useStableWhile', () => {
  it('keeps returning the first array while later ones hold the same items', () => {
    const { result, rerender } = renderHook(({ list }) => useStableWhile(list, sameItems), {
      initialProps: { list: ['a', 'b'] },
    });
    const first = result.current;
    rerender({ list: ['a', 'b'] });
    expect(result.current).toBe(first);
  });

  it('takes a new array as soon as an item differs', () => {
    const { result, rerender } = renderHook(({ list }) => useStableWhile(list, sameItems), {
      initialProps: { list: ['a'] },
    });
    const next = ['a', 'c'];
    rerender({ list: next });
    expect(result.current).toBe(next);
  });
});
