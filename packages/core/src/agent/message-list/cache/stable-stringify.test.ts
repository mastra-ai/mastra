/**
 * Tests for packages/core/src/agent/message-list/cache/stable-stringify.ts
 *
 * `stableStringify` is a pure function with no I/O and no async behaviour.
 * The behaviour under test is the deterministic-key-order guarantee that
 * makes it safe to use for cache-key generation, as described in the
 * function's own doc comment.
 */
import { describe, expect, it } from 'vitest';

import { stableStringify } from './stable-stringify';

describe('stableStringify', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { a: 1, b: 2 };
    const b = { b: 2, a: 1 };

    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('sorts keys alphabetically at the top level', () => {
    const result = stableStringify({ z: 1, a: 2, m: 3 });

    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts keys at every nested level, not just the top level', () => {
    const nested = { outer2: 1, outer1: { innerB: 1, innerA: 2 } };

    expect(stableStringify(nested)).toBe('{"outer1":{"innerA":2,"innerB":1},"outer2":1}');
  });

  it('produces identical output for deeply nested objects with different key orders', () => {
    const a = { x: { y: { c: 1, b: 2, a: 3 } } };
    const b = { x: { y: { a: 3, c: 1, b: 2 } } };

    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('preserves array element order (arrays are not sorted)', () => {
    const value = [3, 1, 2];

    expect(stableStringify(value)).toBe('[3,1,2]');
  });

  it('sorts object keys within array elements', () => {
    const value = [{ b: 1, a: 2 }];

    expect(stableStringify(value)).toBe('[{"a":2,"b":1}]');
  });

  it('does not treat arrays as plain objects to be key-sorted', () => {
    // Guards against a regression where the replacer's `Array.isArray` guard
    // is dropped and arrays get converted into sorted-key objects.
    const value = { list: [10, 20, 30] };

    expect(stableStringify(value)).toBe('{"list":[10,20,30]}');
  });

  it('handles primitive values the same way JSON.stringify does', () => {
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(null)).toBe('null');
  });

  it('returns undefined (as a JS value) for undefined input, matching JSON.stringify', () => {
    expect(stableStringify(undefined)).toBe(undefined);
  });

  it('drops keys whose value is undefined, matching JSON.stringify', () => {
    const value = { a: 1, b: undefined };

    expect(stableStringify(value)).toBe('{"a":1}');
  });

  it('handles empty objects and empty arrays', () => {
    expect(stableStringify({})).toBe('{}');
    expect(stableStringify([])).toBe('[]');
  });

  it('produces the same key order for objects built via different assignment sequences', () => {
    const built1: Record<string, number> = {};
    built1.charlie = 3;
    built1.alpha = 1;
    built1.bravo = 2;

    const built2: Record<string, number> = {};
    built2.alpha = 1;
    built2.bravo = 2;
    built2.charlie = 3;

    expect(stableStringify(built1)).toBe(stableStringify(built2));
    expect(stableStringify(built1)).toBe('{"alpha":1,"bravo":2,"charlie":3}');
  });

  it('is stable for realistic data-* message part payloads regardless of source column ordering', () => {
    // Simulates the PostgreSQL jsonb-vs-text-column scenario from the doc
    // comment: functionally identical data survives storage/restore with a
    // different key order, but must hash to the same cache key.
    const fromJsonbColumn = { type: 'data-status', data: { status: 'complete', id: 'abc-123' } };
    const fromTextColumn = { data: { id: 'abc-123', status: 'complete' }, type: 'data-status' };

    expect(stableStringify(fromJsonbColumn)).toBe(stableStringify(fromTextColumn));
  });

  it('treats null and object-with-null-prototype-like values without throwing', () => {
    const value = { a: null, b: { c: null } };

    expect(() => stableStringify(value)).not.toThrow();
    expect(stableStringify(value)).toBe('{"a":null,"b":{"c":null}}');
  });
});
