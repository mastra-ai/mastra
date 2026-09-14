import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from './CacheKeyGenerator';
import { stableStringify } from './stable-stringify';

/**
 * Regression tests for the same prototype-member class fixed by #23700/#23701: the
 * re-sorting accumulator in `stableStringify` is a plain object literal, so assigning
 * the own key `__proto__` from the input is a no-op — the key is silently dropped from
 * the serialized output instead of being emitted like `JSON.stringify` does.
 *
 * The consequence is a cache-key collision: an object carrying a `__proto__` key and
 * the same object without it serialize identically, so two DISTINCT values produce the
 * SAME cache key. That defeats `MessageMerger` dedup (distinct data-* parts dropped as
 * duplicates) and lets the response cache replay one request's answer for another.
 */
describe('stableStringify prototype-member keys (mirrors #23700)', () => {
  // Must be parsed, not written as a literal: `{ __proto__: ... }` in source sets the
  // prototype rather than creating an own enumerable key.
  const withProto = () => JSON.parse('{"__proto__":{"role":"admin"},"id":1}');

  it('preserves an own "__proto__" key instead of dropping it', () => {
    const serialized = stableStringify(withProto());

    expect(serialized).toContain('__proto__');
    expect(JSON.parse(serialized)).toHaveProperty('id', 1);
  });

  it('does not collapse a value carrying "__proto__" onto one that lacks it', () => {
    const keyA = stableStringify(withProto());
    const keyB = stableStringify(JSON.parse('{"id":1}'));

    expect(keyA).not.toBe(keyB);
  });

  it('keeps distinct "__proto__" payloads distinct', () => {
    const keyA = stableStringify(JSON.parse('{"__proto__":{"role":"admin"}}'));
    const keyB = stableStringify(JSON.parse('{"__proto__":{"role":"guest"}}'));

    expect(keyA).not.toBe(keyB);
  });

  it('still emits other Object.prototype member names as own keys', () => {
    const serialized = stableStringify(JSON.parse('{"constructor":1,"toString":2}'));

    expect(JSON.parse(serialized)).toEqual({ constructor: 1, toString: 2 });
  });

  it('fromDBParts (the MessageMerger dedup path) keeps two distinct data-* parts apart', () => {
    const partsA = [{ type: 'data-x', data: JSON.parse('{"__proto__":{"role":"admin"},"id":1}') }] as any;
    const partsB = [{ type: 'data-x', data: JSON.parse('{"id":1}') }] as any;

    expect(CacheKeyGenerator.fromDBParts(partsA)).not.toBe(CacheKeyGenerator.fromDBParts(partsB));
  });

  it('still sorts keys deterministically regardless of insertion order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
});
