import { describe, expect, it } from 'vitest';
import { deepEqual } from './deep-equal';

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
  });

  it('returns true for the same object reference', () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });

  it('returns true for deeply equal plain objects', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
  });

  it('returns false when object keys differ', () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('returns false when object values differ', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('returns false when objects have different key counts', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('returns true for equal arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false for arrays of different length', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false for arrays with different elements', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('returns true for equal Date instances', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    expect(deepEqual(d1, d2)).toBe(true);
  });

  it('returns false for different Date instances', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2025-06-01');
    expect(deepEqual(d1, d2)).toBe(false);
  });

  it('returns true for both null values', () => {
    expect(deepEqual(null, null)).toBe(true);
  });

  it('returns false when only one side is null', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it('returns false for values of different types', () => {
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('returns false when comparing a Date to a plain object', () => {
    // A Date has no own enumerable keys, so without a type guard it would
    // compare equal to an empty object via the generic object branch.
    expect(deepEqual(new Date('2024-01-01'), {})).toBe(false);
    expect(deepEqual({}, new Date('2024-01-01'))).toBe(false);
    expect(deepEqual(new Date('2024-01-01'), { getTime: 1 })).toBe(false);
  });

  it('returns false when comparing an array to a plain object with matching index keys', () => {
    expect(deepEqual([1, 2], { '0': 1, '1': 2 })).toBe(false);
    expect(deepEqual({ '0': 1, '1': 2 }, [1, 2])).toBe(false);
  });

  it('returns false when comparing a Date to an array', () => {
    expect(deepEqual(new Date('2024-01-01'), [])).toBe(false);
    expect(deepEqual([], new Date('2024-01-01'))).toBe(false);
  });

  it('applies the type guards recursively for nested values', () => {
    expect(deepEqual({ when: new Date('2024-01-01') }, { when: {} })).toBe(false);
    expect(deepEqual({ items: [1, 2] }, { items: { '0': 1, '1': 2 } })).toBe(false);
    // Sanity: genuinely equal nested Dates/arrays still match.
    expect(deepEqual({ when: new Date('2024-01-01') }, { when: new Date('2024-01-01') })).toBe(true);
    expect(deepEqual({ items: [1, 2] }, { items: [1, 2] })).toBe(true);
  });
});
