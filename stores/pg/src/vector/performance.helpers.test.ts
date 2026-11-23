import { describe, expect, it, vi } from 'vitest';

import { groupBy } from './performance.helpers';

describe('groupBy', () => {
  it('returns an ordinary empty object for empty input', () => {
    const result = groupBy([], () => 'unused');
    expect(result).toEqual({});
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(
      groupBy(
        [],
        () => 'unused',
        group => group.length,
      ),
    ).toEqual({});
  });

  it('groups by property or selector and preserves item order', () => {
    const items = [
      { type: 'a', value: 1 },
      { type: 'b', value: 2 },
      { type: 'a', value: 3 },
    ];
    const expected = { a: [items[0], items[2]], b: [items[1]] };
    expect(groupBy(items, 'type')).toEqual(expected);
    expect(groupBy(items, item => item.type)).toEqual(expected);
    expect(groupBy(items, 'type', group => group.reduce((sum, item) => sum + item.value, 0))).toEqual({ a: 4, b: 2 });
  });

  it('coerces number and string property values into the same bucket', () => {
    const items = [{ key: 1 }, { key: '1' }, { key: 2 }];
    expect(groupBy(items, 'key')).toEqual({ 1: items.slice(0, 2), 2: [items[2]] });
  });

  it.each(['__proto__', 'constructor', 'toString'])(
    'groups %s as an own data property without changing prototypes',
    key => {
      const prototypeDescriptors = Object.getOwnPropertyDescriptors(Object.prototype);
      const items = [
        { key, value: 1 },
        { key, value: 2 },
      ];
      for (const result of [groupBy(items, 'key'), groupBy(items, item => item.key)]) {
        expect(Object.getOwnPropertyDescriptor(result, key)).toEqual({
          value: items,
          enumerable: true,
          configurable: true,
          writable: true,
        });
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      }
      const reduced = groupBy(items, 'key', group => group.length);
      expect(Object.getOwnPropertyDescriptor(reduced, key)).toEqual({
        value: 2,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      expect(Object.getPrototypeOf(reduced)).toBe(Object.prototype);
      expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypeDescriptors);
    },
  );

  it('retains numeric property ordering when invoking reducers', () => {
    const items = [{ key: '10' }, { key: '2' }, { key: 'a' }];
    const reducer = vi.fn(group => group.length);
    expect(groupBy(items, 'key', reducer)).toEqual({ 2: 1, 10: 1, a: 1 });
    expect(reducer.mock.calls).toEqual([[[items[1]]], [[items[0]]], [[items[2]]]]);
  });

  it('preserves symbol keys without passing them to the string-key reducer', () => {
    const first = Symbol('key');
    const second = Symbol('key');
    const items = [{ key: first }, { key: second }, { key: first }];
    const grouped = groupBy(items, 'key');
    expect(Object.getOwnPropertySymbols(grouped)).toEqual([first, second]);
    expect(Reflect.get(grouped, first)).toEqual([items[0], items[2]]);
    expect(Reflect.get(grouped, second)).toEqual([items[1]]);
    const reducer = vi.fn(group => group.length);
    expect(groupBy(items, 'key', reducer)).toEqual({});
    expect(reducer).not.toHaveBeenCalled();
  });
});
