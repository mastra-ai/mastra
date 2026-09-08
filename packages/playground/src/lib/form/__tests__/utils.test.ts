import { describe, it, expect } from 'vitest';
import { removeEmptyValues } from '../utils';

describe('removeEmptyValues', () => {
  it('strips null, undefined and empty strings', () => {
    expect(removeEmptyValues({ a: null, b: undefined, c: '', d: 'x' })).toEqual({ d: 'x' });
  });

  it('preserves falsy primitives that are not empty', () => {
    expect(removeEmptyValues({ zero: 0, no: false, s: 'a' })).toEqual({ zero: 0, no: false, s: 'a' });
  });

  it('strips empty plain objects and arrays, including nested ones that clean to empty', () => {
    expect(removeEmptyValues({ obj: {}, arr: [], nested: { inner: { deep: '' } }, keep: 1 })).toEqual({ keep: 1 });
  });

  it('recurses into nested plain objects and arrays of plain objects', () => {
    expect(
      removeEmptyValues({
        nested: { a: '', b: 'b' },
        list: [{ x: '' }, { y: 'y' }, 'z', null],
      }),
    ).toEqual({ nested: { b: 'b' }, list: [{ y: 'y' }, 'z'] });
  });

  it('recurses into nested arrays', () => {
    expect(removeEmptyValues({ matrix: [[1, ''], []] })).toEqual({ matrix: [[1]] });
  });

  it('preserves Date instances by identity', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    expect(removeEmptyValues({ startDate: date }).startDate).toBe(date);
  });

  it('preserves File and Blob instances by identity', () => {
    const file = new File([], 'example.txt');
    const blob = new Blob(['hi']);
    const result = removeEmptyValues({ file, blob });
    expect(result.file).toBe(file);
    expect(result.blob).toBe(blob);
  });

  it('preserves Map, Set and class instances by identity', () => {
    class Foo {}
    const map = new Map();
    const set = new Set();
    const foo = new Foo();
    const result = removeEmptyValues({ map, set, foo });
    expect(result.map).toBe(map);
    expect(result.set).toBe(set);
    expect(result.foo).toBe(foo);
  });

  it('preserves non-plain objects inside arrays', () => {
    const date = new Date();
    const result = removeEmptyValues({ dates: [date, new Map()] });
    expect(result.dates).toHaveLength(2);
    expect(result.dates![0]).toBe(date);
  });

  it('treats null-prototype objects as plain and recurses into them', () => {
    const obj = Object.create(null);
    obj.a = '';
    obj.b = 'b';
    expect(removeEmptyValues({ obj })).toEqual({ obj: { b: 'b' } });
  });
});
