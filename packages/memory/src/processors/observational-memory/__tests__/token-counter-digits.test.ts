import { describe, expect, it } from 'vitest';

import { TokenCounter } from '../token-counter';

describe('TokenCounter digit runs', () => {
  it('counts long digit runs in chunks instead of as a single token', () => {
    const counter = new TokenCounter();
    expect(counter.countString('0'.repeat(28_000))).toBeGreaterThan(9_000);
    expect(counter.countString('12345678901234567890')).toBeGreaterThanOrEqual(7);
    expect(counter.countString('1700000000000')).toBeGreaterThanOrEqual(5);
    expect(counter.countString('hello world this is text')).toBe(5);
  });
});
