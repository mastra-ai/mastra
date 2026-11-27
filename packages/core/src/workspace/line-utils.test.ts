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

  it('should extract specific line range', () => {
    const result = extractLines(content, 2, 4);
    expect(result.content).toBe('Line 2\nLine 3\nLine 4');
    expect(result.lines).toEqual({ start: 2, end: 4 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract from start line to end', () => {
    const result = extractLines(content, 3);
    expect(result.content).toBe('Line 3\nLine 4\nLine 5');
    expect(result.lines).toEqual({ start: 3, end: 5 });
    expect(result.totalLines).toBe(5);
  });

  it('should extract from beginning to end line', () => {
    const result = extractLines(content, undefined, 2);
    expect(result.content).toBe('Line 1\nLine 2');
    expect(result.lines).toEqual({ start: 1, end: 2 });
    expect(result.totalLines).toBe(5);
  });

  it('should handle single line extraction', () => {
    const result = extractLines(content, 3, 3);
    expect(result.content).toBe('Line 3');
    expect(result.lines).toEqual({ start: 3, end: 3 });
  });

  it('should clamp start line to 1', () => {
    const result = extractLines(content, -5, 2);
    expect(result.lines.start).toBe(1);
    expect(result.content).toBe('Line 1\nLine 2');
  });

  it('should clamp end line to total lines', () => {
    const result = extractLines(content, 4, 100);
    expect(result.lines.end).toBe(5);
    expect(result.content).toBe('Line 4\nLine 5');
  });

  it('should handle single line content', () => {
    const result = extractLines('Single line');
    expect(result.content).toBe('Single line');
    expect(result.lines).toEqual({ start: 1, end: 1 });
    expect(result.totalLines).toBe(1);
  });

  it('should handle empty content', () => {
    const result = extractLines('');
    expect(result.content).toBe('');
    expect(result.totalLines).toBe(1); // Empty string splits to ['']
  });

  it('should handle out of bounds gracefully', () => {
    const result = extractLines(content, -5, 100);
    expect(result.lines).toEqual({ start: 1, end: 5 });
  });

  it('should preserve an empty line within a valid range', () => {
    const result = extractLines('Line 1\n\nLine 3', 2, 2);
    expect(result.content).toBe('');
    expect(result.lines).toEqual({ start: 2, end: 2 });
    expect(result.totalLines).toBe(3);
  });

  it('should return an empty range when startLine is past the end', () => {
    const result = extractLines(content, 10, 12);
    expect(result.content).toBe('');
    expect(result.lines).toEqual({ start: 0, end: 0 });
    expect(result.totalLines).toBe(5);
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

  it('should return an empty range when offset is past the end', () => {
    const result = extractLinesWithLimit('a\nb\nc', 10, 5);
    expect(result.content).toBe('');
    expect(result.lines).toEqual({ start: 0, end: 0 });
    expect(result.totalLines).toBe(3);
  });

  it('should return an empty range when offset without limit is past the end', () => {
    const result = extractLinesWithLimit('a\nb\nc', 10);
    expect(result.content).toBe('');
    expect(result.lines).toEqual({ start: 0, end: 0 });
    expect(result.totalLines).toBe(3);
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

  it('should format an empty line', () => {
    const result = formatWithLineNumbers('', 10);
    expect(result).toBe('    10→');
  });
});

describe('charIndexToLineNumber', () => {
  const content = 'Line 1\nLine 2\nLine 3\nLine 4';

  it('should return correct line for character in first line', () => {
    // 'L' at position 0 -> line 1
    expect(charIndexToLineNumber(content, 0)).toBe(1);
    // 'i' at position 1 -> line 1
    expect(charIndexToLineNumber(content, 1)).toBe(1);
    // ' ' at position 4 -> line 1
    expect(charIndexToLineNumber(content, 4)).toBe(1);
    // '1' at position 5 -> line 1
    expect(charIndexToLineNumber(content, 5)).toBe(1);
  });

  it('should return line 3 for character in third line', () => {
    // "Line 1\n" = 7 chars, "Line 2\n" = 7 chars
    // Index 14 is first char of line 3
    expect(charIndexToLineNumber(content, 14)).toBe(3);
  });

  it('should return last line for character at end', () => {
    // Total content length
    expect(charIndexToLineNumber(content, content.length)).toBe(4);
  });

  it('should return undefined for index beyond content length', () => {
    expect(charIndexToLineNumber(content, content.length + 1)).toBeUndefined();
  });

  it('should handle single line content', () => {
    expect(charIndexToLineNumber('single line', 5)).toBe(1);
  });

  it('should handle empty content', () => {
    expect(charIndexToLineNumber('', 0)).toBe(1);
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
  const content = 'Line 1\nLine 2\nLine 3\nLine 4';

  it('should convert character range within single line', () => {
    // "Line" (0-3) on first line
    const range = charRangeToLineRange(content, 0, 4);
    expect(range).toEqual({ start: 1, end: 1 });
  });

  it('should convert character range spanning multiple lines', () => {
    // From start of line 1 to end of line 3
    // "Line 1\n" = 7, "Line 2\n" = 7, "Line 3" = 6 (total 20, but we want index 20)
    const range = charRangeToLineRange(content, 0, 21);
    expect(range).toEqual({ start: 1, end: 3 });
  });

  it('should convert character range starting mid-document', () => {
    // Start at line 2 (index 7), end at line 3
    const range = charRangeToLineRange(content, 7, 21);
    expect(range).toEqual({ start: 2, end: 3 });
  });

  it('should return undefined for invalid end index', () => {
    expect(charRangeToLineRange(content, 0, content.length + 10)).toBeUndefined();
  });

  it('should handle single character range', () => {
    const range = charRangeToLineRange(content, 0, 1);
    expect(range).toEqual({ start: 1, end: 1 });
  });

  it('should handle range ending at newline', () => {
    // "Line 1\n" ends at index 6 (the newline)
    // endCharIdx is exclusive, so charRangeToLineRange(content, 0, 7) includes the newline
    // But we look at index 6 (7-1) which is the newline, still on line 1
    const range = charRangeToLineRange(content, 0, 7);
    expect(range).toEqual({ start: 1, end: 1 });
  });

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
