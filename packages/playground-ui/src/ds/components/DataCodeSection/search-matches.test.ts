import { describe, expect, it } from 'vitest';

import { findMatchRanges, getNextMatchIndex } from './search-matches';

describe('findMatchRanges', () => {
  it('finds every non-overlapping occurrence in document order', () => {
    expect(findMatchRanges('a ab abc ab a', 'ab')).toEqual([
      { from: 2, to: 4 },
      { from: 5, to: 7 },
      { from: 9, to: 11 },
    ]);
  });

  it('matches case-insensitively', () => {
    expect(findMatchRanges('Preguntas preguntas PREGUNTAS', 'preguntas')).toEqual([
      { from: 0, to: 9 },
      { from: 10, to: 19 },
      { from: 20, to: 29 },
    ]);
  });

  it('does not return overlapping matches', () => {
    expect(findMatchRanges('aaaa', 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ]);
  });

  it('treats the query as a literal string, not a regex', () => {
    expect(findMatchRanges('a.b a.b axb', 'a.b')).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
    ]);
  });

  it('returns an empty array for an empty query or empty text', () => {
    expect(findMatchRanges('hello', '')).toEqual([]);
    expect(findMatchRanges('', 'hello')).toEqual([]);
  });

  it('returns an empty array when there is no match', () => {
    expect(findMatchRanges('hello world', 'xyz')).toEqual([]);
  });

  it('keeps offsets anchored to the original text for characters that change length when lowercased', () => {
    // 'İ' (U+0130) lowercases to two code units ('i' + combining dot), so a lowercase-and-compare
    // approach would report 'foo' one position too far. The match must stay at its real offset.
    expect(findMatchRanges('İ foo', 'foo')).toEqual([{ from: 2, to: 5 }]);
  });
});

describe('getNextMatchIndex', () => {
  it('steps forward', () => {
    expect(getNextMatchIndex(0, 3, 1)).toBe(1);
    expect(getNextMatchIndex(1, 3, 1)).toBe(2);
  });

  it('wraps around to the first match after the last one', () => {
    expect(getNextMatchIndex(2, 3, 1)).toBe(0);
  });

  it('steps backward and wraps around to the last match', () => {
    expect(getNextMatchIndex(1, 3, -1)).toBe(0);
    expect(getNextMatchIndex(0, 3, -1)).toBe(2);
  });

  it('returns -1 when there are no matches', () => {
    expect(getNextMatchIndex(0, 0, 1)).toBe(-1);
    expect(getNextMatchIndex(0, 0, -1)).toBe(-1);
  });

  it('stays on the only match when there is a single one', () => {
    expect(getNextMatchIndex(0, 1, 1)).toBe(0);
    expect(getNextMatchIndex(0, 1, -1)).toBe(0);
  });
});
