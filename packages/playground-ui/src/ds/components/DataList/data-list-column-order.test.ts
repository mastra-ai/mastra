import { describe, expect, it } from 'vitest';
import {
  moveIndex,
  moveKeyedOrder,
  normalizeOrder,
  resolveKeyedOrder,
  splitGridTracks,
} from './data-list-column-order';

describe('splitGridTracks', () => {
  it('keeps parenthesized tracks whole', () => {
    expect(splitGridTracks('auto minmax(0, 1fr)  12rem')).toEqual(['auto', 'minmax(0, 1fr)', '12rem']);
  });

  it('returns null for repeat() templates', () => {
    expect(splitGridTracks('auto repeat(3, 1fr)')).toBeNull();
  });
});

describe('normalizeOrder', () => {
  it('keeps a valid permutation', () => {
    expect(normalizeOrder([2, 0, 1], 3)).toEqual([2, 0, 1]);
  });

  it.each([[undefined], [[0, 1]], [[0, 0, 1]], [[0, 1, 3]]])('falls back to identity for %j', stored => {
    expect(normalizeOrder(stored, 3)).toEqual([0, 1, 2]);
  });
});

describe('moveIndex', () => {
  it('moves forward and backward', () => {
    expect(moveIndex([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
    expect(moveIndex([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2]);
  });

  it('ignores out-of-range moves', () => {
    const order = [0, 1];
    expect(moveIndex(order, 0, 5)).toBe(order);
    expect(moveIndex(order, -1, 0)).toBe(order);
  });
});

describe('resolveKeyedOrder', () => {
  it('uses the default order when nothing is stored', () => {
    expect(resolveKeyedOrder(undefined, ['a', 'b', 'c'])).toEqual([0, 1, 2]);
  });

  it('applies the stored order and skips columns that are not rendered', () => {
    expect(resolveKeyedOrder(['c', 'x', 'a', 'b'], ['a', 'b', 'c'])).toEqual([2, 0, 1]);
  });

  it('inserts new columns at their default position', () => {
    expect(resolveKeyedOrder(['c', 'a'], ['a', 'b', 'c'])).toEqual([2, 1, 0]);
  });
});

describe('moveKeyedOrder', () => {
  it('moves a visible column and remembers hidden ones', () => {
    expect(moveKeyedOrder(['a', 'hidden', 'b', 'c'], ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b', 'hidden']);
  });
});
