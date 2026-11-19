/**
 * Regression tests for #30951: token truncation must bound its token work to a
 * window derived from the token budget. Before the fix, `applyTokenLimit` and
 * `sandwich` ran tokenx's `estimateTokenCount` (and a negative-index
 * `sliceByTokens`) over the whole output, so a multi-megabyte `execute_command`
 * result blocked the event loop for seconds and buffered ~2 GB of heap.
 */
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';

import { MAX_CHARS_PER_TOKEN, headByTokens, sliceByTokensSafe, tailByTokens } from '../../utils/slice-by-tokens';
import { applyTokenLimit, applyTokenLimitSandwich } from './output-helpers';

const LIMIT = 2_000;

/** Lines of `line <i> <padding>` — realistic multi-line command output. */
function buildOutput(lineCount: number, padding = 24): string {
  const lines = new Array<string>(lineCount);
  for (let i = 1; i <= lineCount; i++) lines[i - 1] = `line ${i} ${'x'.repeat(padding)}`;
  return lines.join('\n');
}

// Well above LIMIT * MAX_CHARS_PER_TOKEN, so the bounded path is exercised.
const medium = buildOutput(6_000);

describe('bounded token truncation (#30951)', () => {
  it('headByTokens matches a slice of the whole text', () => {
    expect(medium.length).toBeGreaterThan(LIMIT * MAX_CHARS_PER_TOKEN);
    expect(headByTokens(medium, 200)).toBe(sliceByTokensSafe(medium, 0, 200));
    expect(headByTokens(medium, 1_800)).toBe(sliceByTokensSafe(medium, 0, 1_800));
  });

  it('tailByTokens matches a slice of the whole text', () => {
    expect(tailByTokens(medium, 200)).toBe(sliceByTokensSafe(medium, -200));
    expect(tailByTokens(medium, 1_800)).toBe(sliceByTokensSafe(medium, -1_800));
  });

  it('applyTokenLimit keeps the same head/tail content as before', async () => {
    const fromStart = await applyTokenLimit(medium, LIMIT, 'start');
    expect(fromStart.endsWith(sliceByTokensSafe(medium, -LIMIT))).toBe(true);
    expect(fromStart).toMatch(/^\[output truncated: showing last ~2000 of ~\d+ tokens\]\n/);

    const fromEnd = await applyTokenLimit(medium, LIMIT, 'end');
    expect(fromEnd.startsWith(sliceByTokensSafe(medium, 0, LIMIT))).toBe(true);
    expect(fromEnd).toMatch(/\n\[output truncated: showing first ~2000 of ~\d+ tokens\]$/);
  });

  it('applyTokenLimitSandwich keeps the same head/tail content as before', async () => {
    const headBudget = Math.floor(LIMIT * 0.1);
    const tailBudget = LIMIT - headBudget;
    const result = await applyTokenLimitSandwich(medium, LIMIT, 0.1);

    expect(result.startsWith(sliceByTokensSafe(medium, 0, headBudget).replace(/\r?\n$/, ''))).toBe(true);
    expect(result.endsWith(sliceByTokensSafe(medium, -tailBudget).replace(/^\r?\n/, ''))).toBe(true);
    expect(result).toMatch(/\[\.\.\.output truncated — .*of ~\d+ tokens\.\.\.\]/);
  });

  it('keeps exact token totals below the sampling threshold', async () => {
    const small = buildOutput(40);
    const total = estimateTokenCount(small);
    const result = await applyTokenLimit(small, 10, 'end');
    expect(result).toContain(`of ~${total} tokens]`);
  });

  it('leaves output within the limit unchanged', async () => {
    const small = 'hello world';
    expect(await applyTokenLimit(small, 100, 'start')).toBe(small);
    expect(await applyTokenLimitSandwich(small, 100)).toBe(small);
  });

  it('truncates a 20 MB output without blocking on the whole string', async () => {
    const huge = buildOutput(600_000);
    expect(huge.length).toBeGreaterThan(20_000_000);

    const start = performance.now();
    const sandwich = await applyTokenLimitSandwich(huge, LIMIT, 0.1);
    const limited = await applyTokenLimit(huge, LIMIT, 'start');
    const elapsed = performance.now() - start;

    // Pre-fix both paths estimated tokens over (and buffered a segment object per segment
    // of) the whole 20 MB string — ~3 s and hundreds of MB of heap on this fixture.
    expect(elapsed).toBeLessThan(1_000);

    expect(sandwich.length).toBeLessThan(huge.length);
    expect(sandwich).toMatch(/\[\.\.\.output truncated — .*of ~\d+ tokens\.\.\.\]/);
    expect(limited.length).toBeLessThan(huge.length);
    expect(limited).toMatch(/^\[output truncated: showing last ~2000 of ~\d+ tokens\]\n/);
  });
});
