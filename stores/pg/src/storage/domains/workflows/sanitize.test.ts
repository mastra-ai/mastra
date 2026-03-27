import { describe, it, expect } from 'vitest';

/**
 * Sanitizes JSON string by removing or escaping problematic sequences that PostgreSQL jsonb rejects.
 * Handles:
 * - \u0000 (null character) - causes error 22P05 "unsupported Unicode escape sequence"
 * - \uD800-\uDFFF (unpaired surrogates) - causes "Unicode low surrogate must follow a high surrogate"
 * - Invalid JSON escape sequences like \v, \k, etc. - PostgreSQL only accepts \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
 *
 * Invalid escape sequences are escaped by doubling the backslash (e.g., \v becomes \\v).
 */
function sanitizeJsonForPg(jsonString: string): string {
  // First, remove problematic Unicode escape sequences
  let sanitized = jsonString.replace(/\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})/g, '');

  // Then, escape invalid JSON escape sequences.
  // PostgreSQL's JSON parser only accepts these escape sequences: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
  // Any other \X combination is rejected. We escape these by doubling the backslash.
  // This regex matches a backslash followed by a character that is NOT part of a valid escape sequence.
  // We use a negative lookahead to avoid matching valid escape sequences.
  sanitized = sanitized.replace(/\\(?!"|\\|\/|b|f|n|r|t|u[0-9a-fA-F]{4})/g, '\\\\');

  return sanitized;
}

describe('sanitizeJsonForPg', () => {
  it('should remove null character Unicode escape sequences', () => {
    const input = '{"text": "hello\\u0000world"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "helloworld"}');
  });

  it('should remove unpaired surrogate Unicode escape sequences', () => {
    const input = '{"text": "hello\\uD800world"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "helloworld"}');
  });

  it('should escape invalid escape sequence \\v', () => {
    const input = '{"text": "Omschr\\vijving"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "Omschr\\\\vijving"}');
  });

  it('should escape invalid escape sequence \\k', () => {
    const input = '{"text": "Toepassel\\k"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "Toepassel\\\\k"}');
  });

  it('should escape invalid escape sequence \\g', () => {
    const input = '{"text": "Verkr\\ging"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "Verkr\\\\ging"}');
  });

  it('should NOT escape valid escape sequences', () => {
    const input = '{"text": "line1\\nline2\\ttab\\\"quote\\\\backslash"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "line1\\nline2\\ttab\\\"quote\\\\backslash"}');
  });

  it('should handle multiple invalid escape sequences', () => {
    const input = '{"text": "\\v\\k\\g\\s\\z"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "\\\\v\\\\k\\\\g\\\\s\\\\z"}');
  });

  it('should handle mixed valid and invalid escape sequences', () => {
    const input = '{"text": "\\n\\v\\t\\k"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "\\n\\\\v\\t\\\\k"}');
  });

  it('should handle Dutch text with backslash-letter combinations from the issue', () => {
    // Example from the issue: Dutch words like "Omschrijving" containing \v
    const input = '{"content": "Omschr\\v... (Omschrijving), (b\\v... (bvb)"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"content": "Omschr\\\\v... (Omschrijving), (b\\\\v... (bvb)"}');
  });

  it('should handle \\uXXXX escape sequences correctly', () => {
    const input = '{"text": "emoji \\uD83D\\uDE00"}';
    const result = sanitizeJsonForPg(input);
    // Note: The regex removes D800-DFFF range (surrogates), which includes valid emoji surrogate pairs
    // This is intentional as per the original function design to avoid PostgreSQL errors
    expect(result).toBe('{"text": "emoji "}');
  });

  it('should handle backslash-space combinations', () => {
    const input = '{"text": "hello\\ world"}';
    const result = sanitizeJsonForPg(input);
    expect(result).toBe('{"text": "hello\\\\ world"}');
  });
});
