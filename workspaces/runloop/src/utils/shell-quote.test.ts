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

  it('quotes empty string', () => {
    expect(shellQuote('')).toBe("''");
  });

  it('quotes strings with newlines', () => {
    expect(shellQuote('a\nb')).toBe("'a\nb'");
  });

  it('quotes shell variable references', () => {
    expect(shellQuote('$VAR')).toBe("'$VAR'");
  });

  it('quotes backticks', () => {
    expect(shellQuote('`cmd`')).toBe("'`cmd`'");
  });

  it('quotes semicolons', () => {
    expect(shellQuote('a;b')).toBe("'a;b'");
  });
});
