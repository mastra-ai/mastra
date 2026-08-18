import { describe, expect, it } from 'vitest';
import { truncateString } from './serialization';

describe('truncateString', () => {
  it('does not split a UTF-16 surrogate pair at the truncation boundary', () => {
    expect(truncateString('abc😀tail', 4)).toBe('abc…[truncated]');
  });

  it('keeps a complete surrogate pair when it fits before the boundary', () => {
    expect(truncateString('abc😀tail', 5)).toBe('abc😀…[truncated]');
  });
});
