import { describe, expect, it } from 'vitest';

import { candidatesForPrefix, currentPrefix } from './pierre-autocomplete';

describe('candidatesForPrefix', () => {
  it('returns nothing for prefixes shorter than 2 chars', () => {
    expect(candidatesForPrefix('const foo = 1;', 7)).toEqual([]);
  });

  it('surfaces identifiers starting with the caret prefix', () => {
    const text = 'const fooBar = 1;\nconst fooBaz = 2;\nconst foo';
    const offset = text.length;
    expect(candidatesForPrefix(text, offset)).toEqual(['fooBaz', 'fooBar']);
  });

  it('skips the prefix itself when identical to a source word', () => {
    const text = 'foo\nfooBar';
    // cursor after typing "foo" at the start
    expect(candidatesForPrefix(text, 3)).toEqual(['fooBar']);
  });

  it('ranks matches by proximity to the caret', () => {
    // `far` sits before the caret, `near` right after; both contain the same
    // pair of matches but flipped. Closer occurrences win the top slot.
    const text = 'somewhere quickBrown\n\n\n\n\n\n\n\nfast quickSort qui';
    const offset = text.length;
    const candidates = candidatesForPrefix(text, offset);
    // quickSort is closer to the caret than quickBrown.
    expect(candidates[0]).toBe('quickSort');
    expect(candidates).toContain('quickBrown');
  });
});

describe('currentPrefix', () => {
  it('returns the trailing partial word', () => {
    expect(currentPrefix('const foo', 9)).toBe('foo');
  });

  it('returns an empty string after a whitespace boundary', () => {
    expect(currentPrefix('const foo ', 10)).toBe('');
  });
});
