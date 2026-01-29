import { describe, it, expect } from 'vitest';
import {
  extractLines,
  extractLinesWithLimit,
  formatWithLineNumbers,
  charIndexToLineNumber,
  charRangeToLineRange,
  countOccurrences,
  replaceString,
  StringNotFoundError,
  StringNotUniqueError,
} from './line-utils';

describe('extractLines', () => {
  const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

  it('should extract all lines by default', () => {
    const result = extractLines(content);
    expect(result.content).toBe(content);
    expect(result.lines).toEqual({ start: 1, end: 5 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract lines from startLine to endLine', () => {
    const result = extractLines(content, 2, 4);
    expect(result.content).toBe('Line 2\nLine 3\nLine 4');
    expect(result.lines).toEqual({ start: 2, end: 4 });
  });

  it('should extract lines from startLine to end', () => {
    const result = extractLines(content, 3);
    expect(result.content).toBe('Line 3\nLine 4\nLine 5');
    expect(result.lines).toEqual({ start: 3, end: 5 });
  });

  it('should extract lines from start to endLine', () => {
    const result = extractLines(content, undefined, 2);
    expect(result.content).toBe('Line 1\nLine 2');
    expect(result.lines).toEqual({ start: 1, end: 2 });
  });

  it('should handle out of bounds gracefully', () => {
    const result = extractLines(content, -5, 100);
    expect(result.lines).toEqual({ start: 1, end: 5 });
  });
});

describe('extractLinesWithLimit', () => {
  const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

  it('should extract lines using offset and limit', () => {
    const result = extractLinesWithLimit(content, 2, 2);
    expect(result.content).toBe('Line 2\nLine 3');
    expect(result.lines).toEqual({ start: 2, end: 3 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract from offset to end without limit', () => {
    const result = extractLinesWithLimit(content, 3);
    expect(result.content).toBe('Line 3\nLine 4\nLine 5');
    expect(result.lines).toEqual({ start: 3, end: 5 });
  });

  it('should extract first N lines with only limit', () => {
    const result = extractLinesWithLimit(content, undefined, 2);
    expect(result.content).toBe('Line 1\nLine 2');
    expect(result.lines).toEqual({ start: 1, end: 2 });
  });
});

describe('formatWithLineNumbers', () => {
  it('should format single line', () => {
    const result = formatWithLineNumbers('Hello World');
    expect(result).toBe('     1→Hello World');
  });

  it('should format multiple lines', () => {
    const result = formatWithLineNumbers('Line 1\nLine 2\nLine 3');
    expect(result).toBe('     1→Line 1\n     2→Line 2\n     3→Line 3');
  });

  it('should start from custom line number', () => {
    const result = formatWithLineNumbers('Line 5\nLine 6', 5);
    expect(result).toBe('     5→Line 5\n     6→Line 6');
  });

  it('should adjust padding for large line numbers', () => {
    const result = formatWithLineNumbers('Line', 999);
    expect(result).toBe('   999→Line');
  });
});

describe('charIndexToLineNumber', () => {
  const content = 'Line 1\nLine 2\nLine 3';

  it('should return line 1 for index 0', () => {
    expect(charIndexToLineNumber(content, 0)).toBe(1);
  });

  it('should return line 2 for index after first newline', () => {
    expect(charIndexToLineNumber(content, 7)).toBe(2);
  });

  it('should return undefined for out of bounds', () => {
    expect(charIndexToLineNumber(content, -1)).toBeUndefined();
    expect(charIndexToLineNumber(content, 100)).toBeUndefined();
  });
});

describe('charRangeToLineRange', () => {
  const content = 'Line 1\nLine 2\nLine 3';

  it('should convert char range to line range', () => {
    const result = charRangeToLineRange(content, 0, 14);
    expect(result).toEqual({ start: 1, end: 2 });
  });

  it('should return undefined for invalid range', () => {
    expect(charRangeToLineRange(content, -1, 10)).toBeUndefined();
  });
});

describe('countOccurrences', () => {
  it('should count occurrences of string', () => {
    expect(countOccurrences('hello hello hello', 'hello')).toBe(3);
  });

  it('should return 0 for no matches', () => {
    expect(countOccurrences('hello world', 'foo')).toBe(0);
  });

  it('should return 0 for empty search string', () => {
    expect(countOccurrences('hello world', '')).toBe(0);
  });
});

describe('replaceString', () => {
  it('should replace unique string', () => {
    const result = replaceString('Hello World', 'World', 'Universe');
    expect(result.content).toBe('Hello Universe');
    expect(result.replacements).toBe(1);
  });

  it('should throw StringNotFoundError when string not found', () => {
    expect(() => replaceString('Hello World', 'foo', 'bar')).toThrow(StringNotFoundError);
  });

  it('should throw StringNotUniqueError when string not unique', () => {
    expect(() => replaceString('hello hello', 'hello', 'hi')).toThrow(StringNotUniqueError);
  });

  it('should replace all occurrences with replace_all', () => {
    const result = replaceString('hello hello hello', 'hello', 'hi', true);
    expect(result.content).toBe('hi hi hi');
    expect(result.replacements).toBe(3);
  });
});
