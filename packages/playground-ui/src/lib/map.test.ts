import { describe, expect, it, vi } from 'vitest';

import { getOrCreate } from './map';

describe('getOrCreate', () => {
  it('creates and stores a value on a miss', () => {
    const map = new Map<string, { count: number }>();
    const value = getOrCreate(map, 'a', () => ({ count: 1 }));

    expect(value).toEqual({ count: 1 });
    expect(map.get('a')).toBe(value);
  });

  it('does not call the factory on a hit', () => {
    const map = new Map<string, number>();
    map.set('a', 42);

    const create = vi.fn(() => 99);
    const value = getOrCreate(map, 'a', create);

    expect(value).toBe(42);
    expect(create).not.toHaveBeenCalled();
  });
});
