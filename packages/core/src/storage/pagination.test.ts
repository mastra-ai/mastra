import { describe, it, expect } from 'vitest';

import { normalizePerPage, calculatePagination } from './base';

describe('normalizePerPage', () => {
  it('passes through valid positive integers', () => {
    expect(normalizePerPage(10, 40)).toBe(10);
  });

  it('maps false to MAX_SAFE_INTEGER and 0 to 0', () => {
    expect(normalizePerPage(false, 40)).toBe(Number.MAX_SAFE_INTEGER);
    expect(normalizePerPage(0, 40)).toBe(0);
  });

  it('falls back to the default for undefined', () => {
    expect(normalizePerPage(undefined, 40)).toBe(40);
  });

  it('rejects negatives, NaN, Infinity, and fractions', () => {
    expect(() => normalizePerPage(-1, 40)).toThrow();
    expect(() => normalizePerPage(Number.NaN, 40)).toThrow();
    expect(() => normalizePerPage(Number.POSITIVE_INFINITY, 40)).toThrow();
    expect(() => normalizePerPage(2.5, 40)).toThrow();
  });
});

describe('calculatePagination', () => {
  it('computes offset for valid pages', () => {
    expect(calculatePagination(2, 10, 10)).toEqual({ offset: 20, perPage: 10 });
  });

  it('forces offset 0 when perPage is false', () => {
    expect(calculatePagination(3, false, Number.MAX_SAFE_INTEGER)).toEqual({
      offset: 0,
      perPage: false,
    });
  });

  it('rejects negative, NaN, and fractional pages', () => {
    expect(() => calculatePagination(-1, 10, 10)).toThrow('page must be >= 0');
    expect(() => calculatePagination(Number.NaN, 10, 10)).toThrow('page must be >= 0');
    expect(() => calculatePagination(1.5, 10, 10)).toThrow('page must be >= 0');
  });
});
