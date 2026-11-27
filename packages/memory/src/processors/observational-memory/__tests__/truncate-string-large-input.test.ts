import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';

import { safeSlice } from '../string-utils';
import { truncateStringByTokens } from '../tool-result-helpers';

// Count how many characters the synchronous tokenizer is asked to process. tokenx
// allocates per word, so this is what turns a big tool result into a multi-second stall.
const tokenizedChars = vi.hoisted(() => ({ total: 0 }));
vi.mock('tokenx', async importOriginal => {
  const actual = await importOriginal<typeof import('tokenx')>();
  return {
    ...actual,
    estimateTokenCount: (text: string) => {
      tokenizedChars.total += text.length;
      return actual.estimateTokenCount(text);
    },
  };
});

/** The implementation before the fix: exact, but it tokenizes the whole text ~25 times. */
function referenceTruncate(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) return '';
  const totalTokens = estimateTokenCount(text);
  if (totalTokens <= maxTokens) return text;
  const build = (end: number) => {
    const visible = safeSlice(text, end);
    return `${visible}\n... [truncated ~${totalTokens - estimateTokenCount(visible)} tokens]`;
  };
  let low = 0;
  let high = text.length;
  let best = build(0);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = build(mid);
    if (estimateTokenCount(candidate) <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function prose(chars: number): string {
  const words = ['alpha', 'beta', 'gamma', 'delta', 'tool', 'result', 'path/to/file.ts:12', '{"key":"value"}', '42'];
  let out = '';
  for (let i = 0; out.length < chars; i++) out += words[(i * 7 + (i % 5)) % words.length] + (i % 11 === 0 ? '\n' : ' ');
  return out;
}

function untokenized<T>(fn: () => T): { result: T; chars: number; ms: number } {
  tokenizedChars.total = 0;
  const start = performance.now();
  const result = fn();
  return { result, chars: tokenizedChars.total, ms: performance.now() - start };
}

describe('truncateStringByTokens on large input', () => {
  it('does not hand a 30 MB tool result to the tokenizer', () => {
    const text = prose(30_000_000);
    const { result, chars, ms } = untokenized(() => truncateStringByTokens(text, 5_000));

    expect(estimateTokenCount(result)).toBeLessThanOrEqual(5_000);
    expect(result).toMatch(/\n\.\.\. \[truncated ~\d+ tokens\]$/);
    // Bounded by the budget, not by the input: a few hundred KB at most.
    expect(chars).toBeLessThan(5_000_000);
    expect(ms).toBeLessThan(1_000);
  });

  it('keeps the same visible text the exact algorithm keeps, with a close token count', () => {
    for (const text of [
      prose(2_000_000),
      JSON.stringify({ rows: Array.from({ length: 60_000 }, (_, i) => ({ i, s: `row ${i}` })) }),
      // Object tool results reach the observer pretty-printed, so indentation counts too.
      JSON.stringify({ rows: Array.from({ length: 20_000 }, (_, i) => ({ i, s: `row ${i}` })) }, null, 2),
    ]) {
      const exact = referenceTruncate(text, 5_000);
      const fast = truncateStringByTokens(text, 5_000);

      const split = (s: string) => {
        const at = s.lastIndexOf('\n... [truncated ~');
        return { visible: s.slice(0, at), tokens: Number(/~(\d+) tokens/.exec(s.slice(at))![1]) };
      };
      const a = split(exact);
      const b = split(fast);
      expect(b.visible).toBe(a.visible);
      expect(Math.abs(b.tokens - a.tokens) / a.tokens).toBeLessThan(0.05);
    }
  });

  it('is identical to the exact algorithm for inputs the old code handled quickly', () => {
    for (const size of [100, 20_000, 150_000]) {
      const text = prose(size);
      expect(truncateStringByTokens(text, 5_000)).toBe(referenceTruncate(text, 5_000));
    }
    expect(truncateStringByTokens('short', 5_000)).toBe('short');
    expect(truncateStringByTokens('', 5_000)).toBe('');
    expect(truncateStringByTokens('text', 0)).toBe('');
  });

  it('stays bounded for one huge unbroken string and for whitespace padding', () => {
    const blob = 'a'.repeat(30_000_000);
    const padded = `${'x'.repeat(100)}${' '.repeat(30_000_000)}${'y'.repeat(100)}`;
    for (const text of [blob, padded]) {
      const { result, chars, ms } = untokenized(() => truncateStringByTokens(text, 5_000));
      expect(estimateTokenCount(result)).toBeLessThanOrEqual(5_000);
      expect(chars).toBeLessThan(5_000_000);
      expect(ms).toBeLessThan(1_000);
    }
  });

  it('never splits a surrogate pair', () => {
    const text = '😀'.repeat(8_000_000);
    const result = truncateStringByTokens(text, 5_000);
    const visible = result.slice(0, result.lastIndexOf('\n... [truncated'));
    expect(visible.length % 2).toBe(0);
    expect(visible).toBe(visible.normalize());
    expect(visible.endsWith('😀')).toBe(true);
  });
});
