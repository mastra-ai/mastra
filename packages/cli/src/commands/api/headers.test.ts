import { describe, expect, it } from 'vitest';
import type { ApiCliError } from './errors';
import { parseHeaders } from './headers';

describe('parseHeaders', () => {
  it('parses repeatable headers, trims whitespace, and preserves colons in values', () => {
    expect(
      parseHeaders(['Authorization: Bearer token', '  X-Test  :  yes  ', 'X-Url: https://example.com/path']),
    ).toEqual({
      Authorization: 'Bearer token',
      'X-Test': 'yes',
      'X-Url': 'https://example.com/path',
    });
  });

  it('returns an empty object for no headers', () => {
    expect(parseHeaders([])).toEqual({});
  });

  it.each(['Missing separator', ': value', 'X-Test:', '  : value  ', 'X-Test:   '])(
    'throws a MALFORMED_HEADER error for %j',
    value => {
      expect(() => parseHeaders([value])).toThrow(
        expect.objectContaining({
          code: 'MALFORMED_HEADER',
          details: { header: value },
        }) as ApiCliError,
      );
    },
  );
});
