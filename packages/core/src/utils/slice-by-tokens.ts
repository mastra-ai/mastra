import { sliceByTokens } from 'tokenx';

// Unicode mode matches lone surrogate code points without matching complete pairs.
const UNPAIRED_SURROGATE_RE = /[\uD800-\uDFFF]/gu;

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
