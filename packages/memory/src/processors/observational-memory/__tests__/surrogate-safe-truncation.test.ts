import { describe, it, expect } from 'vitest';
import { truncateStringByTokens } from '../tool-result-helpers';
import { sanitizeObservationLines } from '../observer-agent';

/**
 * UTF-16 surrogate pair safety tests.
 *
 * Emoji outside the BMP (e.g. 🔥 U+1F525) are encoded as two UTF-16 code
 * units (a surrogate pair).  Naive `str.slice(0, n)` can split a pair,
 * leaving an unpaired high surrogate that Anthropic's JSON parser rejects
 * with "no low surrogate in string".
 *
 * @see https://github.com/mastra-ai/mastra/issues/15573
 */

// 🔥 = U+1F525, encoded as \uD83D\uDD25 in UTF-16 (2 code units, .length === 2)
const FIRE = '🔥';

describe('truncateStringByTokens – surrogate safety', () => {
  it('should not produce unpaired surrogates when truncation lands mid-emoji', () => {
    // Build a string where truncation is likely to land on the emoji
    const text = 'a'.repeat(50) + FIRE + 'b'.repeat(50);
    // Force truncation by using a very small token budget
    const result = truncateStringByTokens(text, 10);

    // Verify no unpaired surrogates: every high surrogate must be followed by a low surrogate
    for (let i = 0; i < result.length; i++) {
      const code = result.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        // High surrogate — next must be low surrogate
        const next = result.charCodeAt(i + 1);
        expect(next).toBeGreaterThanOrEqual(0xdc00);
        expect(next).toBeLessThanOrEqual(0xdfff);
      }
    }

    // Also verify JSON.stringify doesn't throw
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('should handle strings consisting entirely of surrogate-pair emoji', () => {
    const text = FIRE.repeat(100);
    const result = truncateStringByTokens(text, 5);

    // Every character in the truncated portion should be a valid code point
    for (let i = 0; i < result.length; i++) {
      const code = result.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = result.charCodeAt(i + 1);
        expect(next).toBeGreaterThanOrEqual(0xdc00);
        expect(next).toBeLessThanOrEqual(0xdfff);
      }
    }
  });

  it('should not alter strings that fit within the token budget', () => {
    const text = `Hello ${FIRE} world`;
    const result = truncateStringByTokens(text, 1000);
    expect(result).toBe(text);
  });
});

describe('sanitizeObservationLines – surrogate safety', () => {
  it('should not produce unpaired surrogates when truncating long lines with emoji', () => {
    // Build a line that exceeds MAX_OBSERVATION_LINE_CHARS (10_000)
    // Place emoji right at the boundary
    const line = 'x'.repeat(9999) + FIRE + 'y'.repeat(100);
    const result = sanitizeObservationLines(line);

    for (let i = 0; i < result.length; i++) {
      const code = result.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = result.charCodeAt(i + 1);
        expect(next).toBeGreaterThanOrEqual(0xdc00);
        expect(next).toBeLessThanOrEqual(0xdfff);
      }
    }

    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
