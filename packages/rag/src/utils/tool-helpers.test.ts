import { describe, expect, it } from 'vitest';
import { coerceTopK, parseFilterValue } from './tool-helpers';

describe('parseFilterValue', () => {
  it('parses JSON object string filters', () => {
    expect(parseFilterValue('{"field":"value"}')).toEqual({ field: 'value' });
  });

  it.each([
    ['array', '["not", "an", "object"]'],
    ['string', '"not-an-object"'],
    ['number', '123'],
    ['boolean', 'true'],
    ['null', 'null'],
  ])('rejects JSON string filters that parse to %s', (_name, filter) => {
    expect(() => parseFilterValue(filter)).toThrow('Invalid filter format: expected a plain object');
  });
});

describe('coerceTopK', () => {
  it.each([
    [5, 5],
    ['5', 5],
    [2.5, 2],
    ['2.9', 2],
    [1, 1],
  ])('coerces %s to %s', (input, expected) => {
    expect(coerceTopK(input)).toBe(expected);
  });

  it.each([undefined, 0, 0.5, -1, NaN, Infinity, 'abc', ''])('falls back to the default for %s', input => {
    expect(coerceTopK(input as number | string | undefined, 7)).toBe(7);
  });
});
