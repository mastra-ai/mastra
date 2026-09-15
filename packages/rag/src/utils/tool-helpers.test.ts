import { describe, expect, it } from 'vitest';
import { parseFilterValue } from './tool-helpers';

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
