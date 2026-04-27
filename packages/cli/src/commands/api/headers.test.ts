import { describe, expect, it } from 'vitest';

import { ApiCliError } from './errors';
import { parseHeaders } from './headers';

describe('parseHeaders', () => {
  it('returns an empty object for the default empty header list', () => {
    expect(parseHeaders([])).toEqual({});
  });

  it('parses repeatable Key: Value headers', () => {
    expect(parseHeaders(['Authorization: Bearer token', 'X-Test: yes'])).toEqual({
      Authorization: 'Bearer token',
      'X-Test': 'yes',
    });
  });

  it('trims whitespace around header keys and values', () => {
    expect(parseHeaders(['  X-Test  :  yes  '])).toEqual({ 'X-Test': 'yes' });
  });

  it('preserves colons inside header values', () => {
    expect(parseHeaders(['X-Url: https://example.com/path'])).toEqual({ 'X-Url': 'https://example.com/path' });
  });

  it.each(['Missing separator', ': value', 'X-Test:', '  : value  ', 'X-Test:   '])(
    'throws a malformed header error for %j',
    value => {
      expect(() => parseHeaders([value])).toThrow(ApiCliError);

      try {
        parseHeaders([value]);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiCliError);
        expect((error as ApiCliError).code).toBe('MALFORMED_HEADER');
        expect((error as ApiCliError).details).toEqual({ header: value });
      }
    },
  );
});
