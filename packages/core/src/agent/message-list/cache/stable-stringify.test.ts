import { describe, expect, it } from 'vitest';
import { CacheKeyGenerator } from './CacheKeyGenerator';
import { stableStringify } from './stable-stringify';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/23912
 *
 * `stableStringify` built its sorted output on a plain object literal (`{}`),
 * which inherits `Object.prototype`. Assigning to `sorted["__proto__"]` hit the
 * inherited `__proto__` setter instead of creating an own property, so the key
 * was silently dropped from the serialized output. As a result, values that
 * differed only by a `__proto__` key collapsed onto one cache key — breaking
 * `CacheKeyGenerator.fromDBParts` dedup and the agent response cache.
 *
 * Fixed by building the accumulator with `Object.create(null)`.
 */
describe('stableStringify — own __proto__ key preservation (#23912)', () => {
  it('preserves an own __proto__ key so it differs from the key-less object', () => {
    const withProto = JSON.parse('{"__proto__":{"role":"admin"},"id":1}');
    const withoutProto = JSON.parse('{"id":1}');

    const serialized = stableStringify(withProto);
    expect(serialized).toContain('__proto__');
    expect(serialized).not.toBe(stableStringify(withoutProto));
  });

  it('produces distinct keys for distinct __proto__ payloads', () => {
    const admin = stableStringify(JSON.parse('{"__proto__":{"role":"admin"}}'));
    const guest = stableStringify(JSON.parse('{"__proto__":{"role":"guest"}}'));

    expect(admin).not.toBe(guest);
    expect(admin).not.toBe('{}');
    expect(guest).not.toBe('{}');
  });

  it('round-trips other Object.prototype member names as own keys', () => {
    expect(stableStringify(JSON.parse('{"constructor":1,"a":2}'))).toBe('{"a":2,"constructor":1}');
    expect(stableStringify(JSON.parse('{"toString":1,"a":2}'))).toBe('{"a":2,"toString":1}');
  });

  it('keeps deterministic key ordering regardless of insertion order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('sorts nested objects recursively', () => {
    expect(stableStringify({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
  });

  it('gives data-* parts differing only by __proto__ distinct cache keys', () => {
    const adminPart = {
      type: 'data-x' as const,
      data: JSON.parse('{"__proto__":{"role":"admin"}}'),
    };
    const guestPart = {
      type: 'data-x' as const,
      data: JSON.parse('{"__proto__":{"role":"guest"}}'),
    };

    const adminKey = CacheKeyGenerator.fromDBParts([adminPart as any]);
    const guestKey = CacheKeyGenerator.fromDBParts([guestPart as any]);

    expect(adminKey).not.toBe(guestKey);
  });
});
