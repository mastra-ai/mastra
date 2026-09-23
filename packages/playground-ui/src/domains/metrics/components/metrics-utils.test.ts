import { describe, expect, it } from 'vitest';
import { formatCompact } from './metrics-utils';

describe('formatCompact', () => {
  it('uses at most three significant digits', () => {
    expect(formatCompact(12_345)).toBe('12.3k');
    expect(formatCompact(999_999)).toBe('1M');
    expect(formatCompact(8_200_000)).toBe('8.2M');
  });
});
