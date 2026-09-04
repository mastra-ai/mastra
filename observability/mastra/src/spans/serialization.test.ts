import { describe, expect, it } from 'vitest';
import { truncateString } from './serialization';

const LONE_SURROGATE = /\\ud[89ab][0-9a-f]{2}/i;

describe('truncateString', () => {
  it('returns the string unchanged when it fits', () => {
    expect(truncateString('hello', 10)).toBe('hello');
    expect(truncateString('hello', 5)).toBe('hello');
  });

  it('truncates ASCII at the requested boundary', () => {
    expect(truncateString('abcdefgh', 3)).toBe('abc…[truncated]');
  });

  it('does not split a surrogate pair at the boundary', () => {
    // 'a' * 9 + emoji: the cut at 10 would land between the emoji's high and low surrogate.
    const input = 'a'.repeat(9) + '😀tail';
    const result = truncateString(input, 10);

    expect(result).toBe('a'.repeat(9) + '…[truncated]');
    expect(LONE_SURROGATE.test(JSON.stringify(result))).toBe(false);
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
  });

  it('keeps a complete emoji when the boundary falls after it', () => {
    const input = 'a'.repeat(9) + '😀tail';
    const result = truncateString(input, 11);

    expect(result).toBe('a'.repeat(9) + '😀…[truncated]');
    expect(LONE_SURROGATE.test(JSON.stringify(result))).toBe(false);
  });

  it('never emits a lone surrogate for any boundary inside an emoji run', () => {
    const input = '😀'.repeat(10);
    for (let i = 1; i < input.length; i++) {
      expect(LONE_SURROGATE.test(JSON.stringify(truncateString(input, i)))).toBe(false);
    }
  });
});
