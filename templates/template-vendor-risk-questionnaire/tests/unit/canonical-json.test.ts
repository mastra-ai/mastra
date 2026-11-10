import { expect, it, vi } from 'vitest';
import { canonicalJson, sha256 } from '../../src/mastra/intake/source.ts';

it('produces the same canonical bytes and digest regardless of locale collation', () => {
  const value = { z: 1, A: 2, a: [{ ü: 3, Z: 4, omitted: undefined }], ä: 5 };
  const expected = '{"A":2,"a":[{"Z":4,"ü":3}],"z":1,"ä":5}';
  expect(canonicalJson(value)).toBe(expected);
  const collation = vi.spyOn(String.prototype, 'localeCompare').mockImplementation(() => {
    throw new Error('Locale collation must not affect persisted digests');
  });
  try {
    expect(canonicalJson(value)).toBe(expected);
    expect(sha256(canonicalJson(value))).toBe(sha256(expected));
    expect(canonicalJson({ ä: 5, a: [{ Z: 4, ü: 3 }], A: 2, z: 1 })).toBe(expected);
  } finally {
    collation.mockRestore();
  }
});
