import { describe, expect, it } from 'vitest';
import { formatCompact, formatCost } from './metrics-utils';

describe('formatCompact', () => {
  it('uses at most three significant digits', () => {
    expect(formatCompact(12_345)).toBe('12.3K');
    expect(formatCompact(999_999)).toBe('1M');
    expect(formatCompact(8_200_000)).toBe('8.2M');
  });
});

describe('formatCost', () => {
  it('never shows fractions of a cent', () => {
    expect(formatCost(0.0006)).toBe('<$0.01');
    expect(formatCost(0.0277)).toBe('$0.03');
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(0.0006, 'EUR')).toBe('<0.01 EUR');
  });
});
