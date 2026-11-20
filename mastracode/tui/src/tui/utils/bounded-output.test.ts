import { describe, expect, it } from 'vitest';
import { appendBoundedOutput } from './bounded-output.js';

describe('appendBoundedOutput', () => {
  it('appends while under the limit', () => {
    expect(appendBoundedOutput('ab', 'cd', 10)).toBe('abcd');
  });

  it('keeps the latest output once the limit is reached', () => {
    expect(appendBoundedOutput('abcdef', 'gh', 5)).toBe('defgh');
  });

  it('keeps only the tail of an oversized chunk', () => {
    expect(appendBoundedOutput('abc', '0123456789', 4)).toBe('6789');
  });

  it('keeps lone surrogates when copying an oversized chunk tail', () => {
    // Trimming can split a surrogate pair; the copy must not alter the code units.
    expect(appendBoundedOutput('', 'x😀', 2)).toBe('😀');
    expect(appendBoundedOutput('', '😀y', 2)).toBe('\ude00y');
  });
});
