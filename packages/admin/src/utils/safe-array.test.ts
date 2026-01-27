import { describe, it, expect } from 'vitest';
import { safeArray } from './safe-array';

describe('safeArray', () => {
  it('returns the array when value is an array', () => {
    const input = [1, 2, 3];
    expect(safeArray(input)).toBe(input);
  });

  it('returns empty array for null', () => {
    expect(safeArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(safeArray(undefined)).toEqual([]);
  });

  it('returns empty array for string', () => {
    expect(safeArray('not an array')).toEqual([]);
  });

  it('returns empty array for number', () => {
    expect(safeArray(123)).toEqual([]);
  });

  it('returns empty array for object', () => {
    expect(safeArray({ key: 'value' })).toEqual([]);
  });

  it('returns empty array for boolean', () => {
    expect(safeArray(true)).toEqual([]);
    expect(safeArray(false)).toEqual([]);
  });

  it('returns custom default value when provided', () => {
    const defaultValue = ['default'];
    expect(safeArray(null, defaultValue)).toEqual(['default']);
    expect(safeArray(undefined, defaultValue)).toEqual(['default']);
  });

  it('preserves array type with generics', () => {
    interface TestItem {
      id: string;
      name: string;
    }
    const items: TestItem[] = [{ id: '1', name: 'test' }];
    const result = safeArray<TestItem>(items);
    expect(result).toBe(items);
    expect(result[0].id).toBe('1');
  });

  it('handles empty arrays correctly', () => {
    const emptyArray: string[] = [];
    expect(safeArray(emptyArray)).toBe(emptyArray);
    expect(safeArray(emptyArray)).toHaveLength(0);
  });

  it('handles nested arrays', () => {
    const nested = [[1, 2], [3, 4]];
    expect(safeArray(nested)).toBe(nested);
  });
});
