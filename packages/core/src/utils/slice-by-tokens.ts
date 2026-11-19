import { estimateTokenCount, sliceByTokens } from 'tokenx';

// Unicode mode matches lone surrogate code points without matching complete pairs.
const UNPAIRED_SURROGATE_RE = /[\uD800-\uDFFF]/gu;

/**
 * Upper bound on characters per token for tokenx's default estimator: it never
 * estimates below one token per 6 default characters, and CJK, numeric and
 * punctuation runs estimate more. Only plain whitespace is cheaper (0 tokens),
 * which is why the head/tail helpers below double the window until it holds the
 * budget. Used to pre-slice by characters so no token work ever sees the whole
 * (possibly multi-megabyte) string.
 */
export const MAX_CHARS_PER_TOKEN = 8;

/**
 * `sliceByTokens` from tokenx cuts on UTF-16 code-unit boundaries, so a cut can
 * land inside a surrogate pair (emoji, CJK ext B+, math alphanumerics) and leave
 * an unpaired surrogate. That is invalid UTF-16: it degrades to U+FFFD on a UTF-8
 * round-trip and strict JSON parsers reject it. Always slice through this helper
 * so every truncation site gets the same repair.
 */
export function sliceByTokensSafe(text: string, start: number, end?: number): string {
  return sliceByTokens(text, start, end).replace(UNPAIRED_SURROGATE_RE, '\uFFFD');
}

/** `text.slice(start, end)` by UTF-16 index, with the same repair for a cut inside a surrogate pair. */
export function sliceSafe(text: string, start?: number, end?: number): string {
  return text.slice(start, end).replace(UNPAIRED_SURROGATE_RE, '\uFFFD');
}

/**
 * The longest prefix of `text` holding at most `budget` tokens, without running
 * token estimation over the whole string.
 *
 * `budget * MAX_CHARS_PER_TOKEN` characters always hold at least `budget` tokens
 * for any non-whitespace content, so the loop normally exits on its first check;
 * it doubles the window only to cover whitespace runs (which estimate 0 tokens).
 * The result is identical to `sliceByTokens(text, 0, budget)` because the window
 * already contains more than `budget` tokens.
 */
export function headByTokens(text: string, budget: number): string {
  if (!text || budget <= 0) return '';
  let n = Math.min(budget * MAX_CHARS_PER_TOKEN, text.length);
  while (n < text.length && estimateTokenCount(text.slice(0, n)) <= budget) {
    n = Math.min(n * 2, text.length);
  }
  return sliceByTokensSafe(text.slice(0, n), 0, budget);
}

/**
 * The longest suffix of `text` holding at most `budget` tokens, without running
 * token estimation over the whole string. The mirror of {@link headByTokens};
 * pre-slicing by characters also avoids tokenx's negative-index path, which
 * buffers one estimate object per segment of the whole string.
 */
export function tailByTokens(text: string, budget: number): string {
  if (!text || budget <= 0) return '';
  let n = Math.min(budget * MAX_CHARS_PER_TOKEN, text.length);
  while (n < text.length && estimateTokenCount(text.slice(-n)) <= budget) {
    n = Math.min(n * 2, text.length);
  }
  return sliceByTokensSafe(text.slice(-n), -budget);
}
