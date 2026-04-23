import { describe, it, expect } from 'vitest';

import { safeSlice } from '../string-utils';

describe('safeSlice', () => {
  it('returns the whole string when end >= str.length', () => {
    expect(safeSlice('hello', 10)).toBe('hello');
    expect(safeSlice('hello', 5)).toBe('hello');
  });

  it('returns empty string when end <= 0', () => {
    expect(safeSlice('hello', 0)).toBe('');
    expect(safeSlice('hello', -1)).toBe('');
  });

  it('handles ASCII strings like normal slice', () => {
    expect(safeSlice('abcdef', 3)).toBe('abc');
    expect(safeSlice('abcdef', 1)).toBe('a');
  });

  it('backs off by one when end lands immediately after a high surrogate', () => {
    const prefix = 'a'.repeat(9);
    const emoji = '\uD83D\uDD25'; // 🔥 (high surrogate + low surrogate)
    const str = prefix + emoji;

    // end = 10 slices through the emoji's high surrogate at index 9.
    // safeSlice should back off to end = 9, dropping the entire surrogate pair.
    expect(safeSlice(str, 10)).toBe(prefix);
  });

  it('does not back off when end lands after a low surrogate', () => {
    const prefix = 'a'.repeat(9);
    const emoji = '\uD83D\uDD25'; // 🔥
    const str = prefix + emoji;

    // end = 11 lands after the low surrogate at index 10.
    expect(safeSlice(str, 11)).toBe(prefix + emoji);
  });

  it('does not back off when end lands after a non-surrogate BMP character', () => {
    const str = 'abc🔥def';
    // indexes: 0='a', 1='b', 2='c', 3=high surrogate, 4=low surrogate, 5='d', 6='e', 7='f'
    expect(safeSlice(str, 3)).toBe('abc'); // end on high surrogate → back off
    expect(safeSlice(str, 4)).toBe('abc'); // end on low surrogate → back off (high at 3)
    expect(safeSlice(str, 5)).toBe('abc🔥'); // end on 'd' (not a surrogate)
    expect(safeSlice(str, 6)).toBe('abc🔥d'); // end on 'e' (not a surrogate)
  });

  it('handles multiple surrogate pairs correctly', () => {
    const str = '🔥a🔥b🔥';
    // indices: 0=high,1=low,2=a,3=high,4=low,5=b,6=high,7=low
    expect(safeSlice(str, 1)).toBe(''); // backs off from first high surrogate
    expect(safeSlice(str, 3)).toBe('🔥a');
    expect(safeSlice(str, 4)).toBe('🔥a'); // backs off from second high surrogate
    expect(safeSlice(str, 6)).toBe('🔥a🔥b');
    expect(safeSlice(str, 7)).toBe('🔥a🔥b'); // backs off from third high surrogate
  });

  it('handles a string that starts with a high surrogate', () => {
    const str = '\uD83D\uDD25hello';
    expect(safeSlice(str, 1)).toBe('');
    expect(safeSlice(str, 2)).toBe('🔥');
  });

  it('handles an empty string', () => {
    expect(safeSlice('', 0)).toBe('');
    expect(safeSlice('', 5)).toBe('');
  });
});
