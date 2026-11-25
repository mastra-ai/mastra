import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';

vi.mock('tokenx', async importOriginal => {
  const actual = await importOriginal<typeof import('tokenx')>();
  return { ...actual, estimateTokenCount: vi.fn(actual.estimateTokenCount) };
});

import { safeSlice } from '../string-utils';
import { formatToolResultForObserver, truncateStringByTokens } from '../tool-result-helpers';

/** The previous implementation, which recounted the whole candidate prefix on every probe. */
function referenceTruncate(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) return '';
  const totalTokens = estimateTokenCount(text);
  if (totalTokens <= maxTokens) return text;
  const buildCandidate = (sliceEnd: number) => {
    const visible = safeSlice(text, sliceEnd);
    return `${visible}\n... [truncated ~${totalTokens - estimateTokenCount(visible)} tokens]`;
  };
  let low = 0;
  let high = text.length;
  let best = buildCandidate(0);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = buildCandidate(mid);
    if (estimateTokenCount(candidate) <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function createRandom(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Pieces chosen to hit every tokenx segment rule: whitespace and structured whitespace, punctuation
// runs, numbers, short words, language-specific characters, CJK, kana, emoji and surrogate pairs.
const PIECES = [
  'const',
  'value',
  'x',
  'ab',
  'abcdefghijkl',
  '12345',
  '7',
  ' ',
  '  ',
  '\n',
  '\n  ',
  '\n\n',
  '\t',
  '\r\n',
  '.',
  '...',
  '{"a":',
  '},',
  '@@ -1,7 +1,8 @@',
  '+',
  '-',
  '\\n',
  'Größe',
  'café',
  'źdźbło',
  'привет',
  'αβγ',
  '漢字',
  'ひらがな',
  '😀',
  '👍🏽',
  '𝒜',
];

function randomText(random: () => number, length: number): string {
  let text = '';
  while (text.length < length) text += PIECES[Math.floor(random() * PIECES.length)];
  return text;
}

describe('truncateStringByTokens', () => {
  it('does not repeatedly retokenize large prefixes during binary search', () => {
    const text = 'const value = await function result;\n'.repeat(4000);
    vi.mocked(estimateTokenCount).mockClear();
    const truncated = truncateStringByTokens(text, 500);
    const visitedCharacters = vi
      .mocked(estimateTokenCount)
      .mock.calls.reduce((total, [value]) => total + value.length, 0);
    expect(visitedCharacters).toBeLessThan(text.length * 2);
    expect(truncated).toBe(referenceTruncate(text, 500));
  });

  it('returns exactly what recounting every candidate prefix returned', () => {
    const random = createRandom(7);
    for (let i = 0; i < 300; i++) {
      const text = randomText(random, Math.floor(random() * 6_000));
      const maxTokens = 1 + Math.floor(random() * 1_200);
      expect(truncateStringByTokens(text, maxTokens)).toBe(referenceTruncate(text, maxTokens));
    }
  });

  it('matches the previous output on large JSON tool results', () => {
    const random = createRandom(11);
    const lines = Array.from({ length: 4_000 }, (_, i) =>
      i % 20 === 0 ? `@@ -${i},7 +${i},8 @@` : `${'+- '[i % 3]}  ${randomText(random, 40)}`,
    );
    const result = { diff: lines.join('\n'), stdout: randomText(random, 30_000), exitCode: 0 };
    const serialized = JSON.stringify(result, null, 2);
    for (const maxTokens of [1, 50, 500, 5_000, 20_000, 1_000_000]) {
      expect(formatToolResultForObserver(result, { maxTokens })).toBe(referenceTruncate(serialized, maxTokens));
    }
  });

  it('matches the previous output on text without word-to-space boundaries', () => {
    const base64Like = 'QUJDRA=='.repeat(5_000);
    const cjk = '漢字かなカナ'.repeat(3_000);
    const spaces = ' \n'.repeat(5_000);
    for (const text of [base64Like, cjk, spaces]) {
      for (const maxTokens of [1, 100, 2_000]) {
        expect(truncateStringByTokens(text, maxTokens)).toBe(referenceTruncate(text, maxTokens));
      }
    }
  });
});
