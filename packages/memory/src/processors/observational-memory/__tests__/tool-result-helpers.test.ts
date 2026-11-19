/**
 * Regression tests for #30951: `truncateStringByTokens` must bound its token work
 * to a window derived from the token budget. Before the fix it counted the whole
 * (possibly multi-megabyte) text up front and binary-searched from `text.length`,
 * re-estimating a near-full copy of the result on every iteration — seconds of
 * blocked work per large Observer tool result.
 */
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS,
  formatToolResultForObserver,
  truncateStringByTokens,
} from '../tool-result-helpers';

// A lone (unpaired) surrogate is what strict JSON parsers reject; a valid pair is fine.
const LONE_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;
const LONE_LOW_SURROGATE = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const MAX_TOKENS = 5_000;

/** Lines of `line <i> <padding>` — realistic multi-line tool output. */
function buildText(lineCount: number, padding = 24): string {
  const lines = new Array<string>(lineCount);
  for (let i = 1; i <= lineCount; i++) lines[i - 1] = `line ${i} ${'x'.repeat(padding)}`;
  return lines.join('\n');
}

describe('truncateStringByTokens (#30951)', () => {
  it('returns text that fits the budget unchanged', () => {
    const text = buildText(50);
    expect(truncateStringByTokens(text, MAX_TOKENS)).toBe(text);
  });

  it('returns an empty string for empty text or a non-positive budget', () => {
    expect(truncateStringByTokens('', MAX_TOKENS)).toBe('');
    expect(truncateStringByTokens('some text', 0)).toBe('');
    expect(truncateStringByTokens('some text', -1)).toBe('');
  });

  it('truncates a several-megabyte result within the budget and in bounded time', () => {
    const text = buildText(600_000);
    expect(text.length).toBeGreaterThan(20_000_000);

    const start = performance.now();
    const result = truncateStringByTokens(text, MAX_TOKENS);
    const elapsed = performance.now() - start;

    // Pre-fix this counted the whole 20 MB text and searched from `text.length`:
    // seconds of blocked work and hundreds of MB of heap.
    expect(elapsed).toBeLessThan(1_500);
    expect(result.length).toBeLessThan(text.length);
    expect(result).toMatch(/\n\.\.\. \[truncated ~\d+ tokens\]$/);
    expect(estimateTokenCount(result)).toBeLessThanOrEqual(MAX_TOKENS);
  });

  it('bounds a huge tool result passed through the Observer formatter', () => {
    const result = formatToolResultForObserver({ output: buildText(100_000) });

    expect(result).toMatch(/\n\.\.\. \[truncated ~\d+ tokens\]$/);
    expect(estimateTokenCount(result)).toBeLessThanOrEqual(DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS);
  });

  it('keeps a whitespace-heavy input within the budget', () => {
    const text = ' '.repeat(2_000_000);
    const result = truncateStringByTokens(text, 100);

    // Whitespace estimates zero tokens, so the character bound — not the estimator —
    // caps the retained prefix.
    expect(result.length).toBeLessThanOrEqual(100 * 8 + 200);
    expect(estimateTokenCount(result)).toBeLessThanOrEqual(100);
  });

  it('never leaves a lone UTF-16 surrogate at the cut boundary', () => {
    // Emoji are surrogate pairs, so most character-bound search midpoints land
    // between the high and low half of one.
    const text = '🔥'.repeat(2_000);

    for (let maxTokens = 10; maxTokens <= 300; maxTokens++) {
      const result = truncateStringByTokens(text, maxTokens);
      expect(LONE_HIGH_SURROGATE.test(result)).toBe(false);
      expect(LONE_LOW_SURROGATE.test(result)).toBe(false);
    }
  });
});
