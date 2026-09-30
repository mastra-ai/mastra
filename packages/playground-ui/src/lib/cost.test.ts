import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatCost, formatFullNumber } from './cost';

describe('formatCompactNumber', () => {
  it.each([
    [999, '999'],
    [6000, '6K'],
    [12_310, '12.3K'],
    [999_999, '1M'],
    [8_200_000, '8.2M'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCompactNumber(value)).toBe(expected);
  });

  it.each([
    [0, '$0.00'],
    [0.0012, '<$0.01'],
    [42.5, '$42.50'],
    [123.45, '$123'],
    [12_345.67, '$12.3K'],
  ])('formats %s USD as %s', (value, expected) => {
    expect(formatCompactNumber(value, { currency: 'USD' })).toBe(expected);
  });
});

describe('formatFullNumber', () => {
  it('keeps every digit', () => {
    expect(formatFullNumber(12_310)).toBe('12,310');
    expect(formatFullNumber(12_345.67, { currency: 'USD' })).toBe('$12,345.67');
    expect(formatFullNumber(0.0277, { currency: 'USD' })).toBe('$0.03');
    expect(formatFullNumber(0.0012, { currency: 'USD' })).toBe('<$0.01');
  });

  it('marks a negative amount under the smallest unit', () => {
    expect(formatFullNumber(-0.0012, { currency: 'USD' })).toBe('-<$0.01');
  });

  it('formats a unit that is not a currency as a plain number', () => {
    expect(formatFullNumber(12_310, { currency: 'credits' })).toBe('12,310');
    expect(formatCompactNumber(12_310, { currency: 'credits' })).toBe('12.3K');
  });

  it('uses the precision of the currency', () => {
    expect(formatFullNumber(1234.5, { currency: 'JPY' })).toBe('¥1,235');
    expect(formatFullNumber(0.4, { currency: 'JPY' })).toBe('<¥1');
    expect(formatFullNumber(1.2345, { currency: 'KWD' })).toBe('KWD\u00a01.235');
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
