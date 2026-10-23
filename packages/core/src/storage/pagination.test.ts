import { describe, expect, it } from 'vitest';
import { calculatePagination, normalizePerPage } from './base';

const invalidNumbers = [NaN, Infinity, -Infinity, 1.5, -0.5, -1];

describe('normalizePerPage', () => {
  it.each(invalidNumbers)('rejects %s', value => {
    expect(() => normalizePerPage(value, 100)).toThrow('perPage must be >= 0');
  });

  it.each([40, 100])('preserves the default %s', defaultValue => {
    expect(normalizePerPage(undefined, defaultValue)).toBe(defaultValue);
  });

  it.each([0, -0, 1, 25, Number.MAX_SAFE_INTEGER])('accepts %s', value => {
    expect(normalizePerPage(value, 100)).toEqual(value === 0 ? 0 : value);
  });

  it('normalizes fetch-all', () => {
    expect(normalizePerPage(false, 100)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('calculatePagination', () => {
  describe.each([10, 0, undefined, false] as const)('with perPage %s', perPage => {
    it.each(invalidNumbers)('rejects page %s', page => {
      expect(() => calculatePagination(page, perPage, normalizePerPage(perPage, 100))).toThrow('page must be >= 0');
    });
  });

  it.each([
    { page: 0, perPage: 10, offset: 0, response: 10 },
    { page: 2, perPage: 10, offset: 20, response: 10 },
    { page: 2, perPage: undefined, offset: 200, response: 100 },
    { page: 2, perPage: 0, offset: 0, response: 0 },
    { page: 2, perPage: false, offset: 0, response: false },
  ] as const)('preserves valid pagination $page/$perPage', ({ page, perPage, offset, response }) => {
    expect(calculatePagination(page, perPage, normalizePerPage(perPage, 100))).toEqual({ offset, perPage: response });
  });

  it('accepts negative zero as page zero', () => {
    expect(calculatePagination(-0, 10, 10).offset === 0).toBe(true);
  });
});
