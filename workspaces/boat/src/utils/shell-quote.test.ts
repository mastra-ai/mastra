import { describe, expect, it } from 'vitest';

import { shellQuote } from './shell-quote';

describe('shellQuote', () => {
  it('leaves safe arguments unquoted', () => {
    expect(shellQuote('/home/user/app.ts')).toBe('/home/user/app.ts');
    expect(shellQuote('KEY=value')).toBe('KEY=value');
  });

  it('quotes arguments containing whitespace', () => {
    expect(shellQuote('two words')).toBe("'two words'");
  });

  it('escapes embedded single quotes', () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  it('neutralises shell metacharacters', () => {
    expect(shellQuote('$(whoami)')).toBe("'$(whoami)'");
    expect(shellQuote('a; rm -rf /')).toBe("'a; rm -rf /'");
  });
});
