import { describe, it, expect } from 'vitest';

import { shellQuote } from './shell-quote';

describe('shellQuote', () => {
  it('leaves safe tokens unquoted', () => {
    expect(shellQuote('foo')).toBe('foo');
    expect(shellQuote('bar/baz')).toBe('bar/baz');
  });

  it('quotes strings with spaces and special chars', () => {
    expect(shellQuote('a b')).toBe("'a b'");
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
  });
});
