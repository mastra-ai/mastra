import { describe, expect, it } from 'vitest';

import { mergeDictation } from '../dictation';

describe('mergeDictation', () => {
  it('adds dictated text after what you typed, separated by one space', () => {
    expect(mergeDictation('fix the login bug  ', '', 'and add a test')).toBe('fix the login bug and add a test');
    expect(mergeDictation('   ', '', 'hello')).toBe('hello');
  });

  it('leaves the draft alone when nothing was heard', () => {
    expect(mergeDictation('fix the login bug', '', '')).toBe('fix the login bug');
  });

  it('grows the dictated text in place as more words arrive', () => {
    const first = mergeDictation('fix it', '', 'Add a');
    const second = mergeDictation(first, 'Add a', 'Add a test');

    expect(second).toBe('fix it Add a test');
  });

  it('swaps the live words for the final transcript when it reads differently', () => {
    expect(mergeDictation('fix it Add a test', 'Add a test', 'Add a test.')).toBe('fix it Add a test.');
  });

  it('keeps words you typed after the dictated text and adds only the new words', () => {
    expect(mergeDictation('Hello there', 'Hello', 'Hello world')).toBe('Hello there world');
  });

  it('never rewrites your edits when the final transcript reads differently from the live words', () => {
    expect(mergeDictation('Hallo, there', 'Hello', 'Hi there.')).toBe('Hallo, there');
  });
});
