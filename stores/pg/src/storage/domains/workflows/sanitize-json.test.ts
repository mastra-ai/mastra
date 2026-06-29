import { describe, expect, it } from 'vitest';
import { sanitizeJsonForPg } from './index';

describe('sanitizeJsonForPg', () => {
  it('removes bare null character escapes', () => {
    expect(sanitizeJsonForPg('"prefix\\u0000suffix"')).toBe('"prefixsuffix"');
  });

  it('removes bare unpaired surrogate escapes (high and low, mixed case)', () => {
    expect(sanitizeJsonForPg('"a\\uD800b"')).toBe('"ab"');
    expect(sanitizeJsonForPg('"a\\udfffb"')).toBe('"ab"');
    expect(sanitizeJsonForPg('"a\\uDABCb"')).toBe('"ab"');
  });

  it('escapes invalid JSON escape sequences (\\v, \\k)', () => {
    expect(sanitizeJsonForPg('"Omschr\\vijving"')).toBe('"Omschr\\\\vijving"');
    expect(sanitizeJsonForPg('"Toepassel\\k"')).toBe('"Toepassel\\\\k"');
  });

  it('preserves valid JSON escapes (\\n, \\t, \\", \\\\)', () => {
    expect(sanitizeJsonForPg('"line1\\nline2"')).toBe('"line1\\nline2"');
    expect(sanitizeJsonForPg('"a\\tb"')).toBe('"a\\tb"');
    expect(sanitizeJsonForPg('"quote\\""')).toBe('"quote\\""');
    expect(sanitizeJsonForPg('"back\\\\slash"')).toBe('"back\\\\slash"');
  });

  // Regression for #15920: escaped-backslash + surrogate (e.g. JSON-encoded JS regex
  // literals like [^\ud800-\udfff]). The old surrogate regex stripped only the \uXXXX
  // and left the preceding \\ orphaned, which then merged with the next char to form a
  // new invalid escape (\-), causing PostgreSQL error 22P02.
  describe('escaped-backslash surrogate sequences (regression #15920)', () => {
    it('removes \\\\uD800 fully, including the preceding escaped backslash', () => {
      expect(sanitizeJsonForPg('"prefix\\\\uD800suffix"')).toBe('"prefixsuffix"');
    });

    it('handles a JS-style surrogate range without producing invalid \\- escapes', () => {
      // Input is the JSON-encoded form of: a = "[^\ud800-\udfff]"
      const input = '"a = \\"[^\\\\ud800-\\\\udfff]\\""';
      const sanitized = sanitizeJsonForPg(input);

      // No dangling backslashes should remain before the hyphen.
      expect(sanitized).not.toContain('\\\\-');
      expect(sanitized).not.toContain('\\-');

      // Result must be parseable as JSON (the original failure mode was
      // PostgreSQL rejecting the value with "invalid input syntax for type json").
      expect(() => JSON.parse(sanitized)).not.toThrow();
      expect(JSON.parse(sanitized)).toBe('a = "[^-]"');
    });

    it('removes escaped-backslash null chars (\\\\u0000) cleanly', () => {
      expect(sanitizeJsonForPg('"prefix\\\\u0000suffix"')).toBe('"prefixsuffix"');
    });

    it('output of mixed surrogate + invalid-escape inputs is always valid JSON', () => {
      // Mix: invalid \v escape, JS-style surrogate range, null char, unpaired surrogate.
      const input = JSON.stringify({
        invalidEscape: 'Omschr\\vijving',
        regex: '[^\\ud800-\\udfff]',
        nullChar: 'a\u0000b',
        surrogate: 'x\uD800y',
      });
      const sanitized = sanitizeJsonForPg(input);
      expect(() => JSON.parse(sanitized)).not.toThrow();
    });
  });
});
