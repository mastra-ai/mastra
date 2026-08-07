/**
 * Tests for packages/core/src/workspace/tools/output-helpers.ts
 *
 * All synchronous helpers are tested directly.
 * The async token-based helpers use real tokenx calls — no mocking needed
 * since tokenx is a deterministic pure function.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_TAIL_LINES,
  applyTail,
  applyTokenLimit,
  applyTokenLimitSandwich,
  sandboxToModelOutput,
  stripAnsi,
  truncateOutput,
} from './output-helpers';

// ---------------------------------------------------------------------------
// stripAnsi
// ---------------------------------------------------------------------------

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('strips basic color codes', () => {
    expect(stripAnsi('\u001b[31mred text\u001b[0m')).toBe('red text');
  });

  it('strips bold escape', () => {
    expect(stripAnsi('\u001b[1mbold\u001b[0m')).toBe('bold');
  });

  it('strips OSC hyperlink sequences', () => {
    const hyperlink = '\u001b]8;;https://example.com\u0007click\u001b]8;;\u0007';
    expect(stripAnsi(hyperlink)).toBe('click');
  });

  it('strips cursor movement codes', () => {
    expect(stripAnsi('\u001b[2J\u001b[H')).toBe('');
  });

  it('handles multiple escape sequences in one string', () => {
    expect(stripAnsi('\u001b[32mgreen\u001b[0m and \u001b[34mblue\u001b[0m')).toBe('green and blue');
  });

  it('returns empty string for empty input', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles string with no escape sequences', () => {
    const text = 'No ANSI here at all, just regular text.';
    expect(stripAnsi(text)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// sandboxToModelOutput
// ---------------------------------------------------------------------------

describe('sandboxToModelOutput', () => {
  it('wraps a plain string in { type, value } and strips ANSI', () => {
    const result = sandboxToModelOutput('\u001b[31merror\u001b[0m') as any;
    expect(result).toEqual({ type: 'text', value: 'error' });
  });

  it('wraps a clean string without ANSI in { type, value }', () => {
    expect(sandboxToModelOutput('hello')).toEqual({ type: 'text', value: 'hello' });
  });

  it('returns non-string values as-is', () => {
    expect(sandboxToModelOutput(42)).toBe(42);
    expect(sandboxToModelOutput(null)).toBeNull();
    expect(sandboxToModelOutput({ key: 'val' })).toEqual({ key: 'val' });
  });

  it('returns undefined as-is', () => {
    expect(sandboxToModelOutput(undefined)).toBeUndefined();
  });

  it('returns an array as-is', () => {
    expect(sandboxToModelOutput([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('DEFAULT_TAIL_LINES is 200', () => {
    expect(DEFAULT_TAIL_LINES).toBe(200);
  });

  it('DEFAULT_MAX_OUTPUT_TOKENS is 2000', () => {
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBe(2_000);
  });
});

// ---------------------------------------------------------------------------
// applyTail
// ---------------------------------------------------------------------------

describe('applyTail', () => {
  const makeLines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');

  it('returns output unchanged when line count <= limit', () => {
    const text = makeLines(5);
    expect(applyTail(text, 10)).toBe(text);
  });

  it('returns last N lines when output exceeds limit', () => {
    const text = makeLines(10);
    const result = applyTail(text, 3);
    expect(result).toContain('[showing last 3 of 10 lines]');
    expect(result).toContain('line 8');
    expect(result).toContain('line 9');
    expect(result).toContain('line 10');
    expect(result.split('\n')).not.toContain('line 1');
  });

  it('uses DEFAULT_TAIL_LINES when tail is undefined', () => {
    const text = makeLines(300);
    const result = applyTail(text, undefined);
    expect(result).toContain(`[showing last ${DEFAULT_TAIL_LINES} of 300 lines]`);
  });

  it('uses DEFAULT_TAIL_LINES when tail is null', () => {
    const text = makeLines(300);
    const result = applyTail(text, null);
    expect(result).toContain(`[showing last ${DEFAULT_TAIL_LINES} of 300 lines]`);
  });

  it('returns all lines when tail = 0 (no limit)', () => {
    const text = makeLines(500);
    expect(applyTail(text, 0)).toBe(text);
  });

  it('preserves trailing newline after truncation', () => {
    const text = makeLines(10) + '\n';
    const result = applyTail(text, 3);
    expect(result.endsWith('\n')).toBe(true);
  });

  it('returns empty string for empty input', () => {
    expect(applyTail('', 10)).toBe('');
  });

  it('handles single line within limit', () => {
    expect(applyTail('only one line', 5)).toBe('only one line');
  });
});

// ---------------------------------------------------------------------------
// applyTokenLimit
// ---------------------------------------------------------------------------

describe('applyTokenLimit', () => {
  it('returns output unchanged when within token limit', async () => {
    const short = 'hello world';
    const result = await applyTokenLimit(short, 1000);
    expect(result).toBe(short);
  });

  it('truncates from start by default and prepends notice', async () => {
    const long = 'word '.repeat(2000);
    const result = await applyTokenLimit(long, 50);
    expect(result).toContain('[output truncated: showing last');
    expect(result.length).toBeLessThan(long.length);
  });

  it('truncates from end and appends notice when from="end"', async () => {
    const long = 'word '.repeat(2000);
    const result = await applyTokenLimit(long, 50, 'end');
    expect(result).toContain('[output truncated: showing first');
    expect(result.length).toBeLessThan(long.length);
  });

  it('returns empty string for empty input', async () => {
    expect(await applyTokenLimit('', 100)).toBe('');
  });

  it('uses DEFAULT_MAX_OUTPUT_TOKENS when limit not specified', async () => {
    const short = 'hello';
    expect(await applyTokenLimit(short)).toBe(short);
  });
});

// ---------------------------------------------------------------------------
// applyTokenLimitSandwich
// ---------------------------------------------------------------------------

describe('applyTokenLimitSandwich', () => {
  it('returns output unchanged when within token limit', async () => {
    const short = 'brief output';
    expect(await applyTokenLimitSandwich(short, 1000)).toBe(short);
  });

  it('includes truncation notice for long output', async () => {
    const long = 'word '.repeat(2000);
    const result = await applyTokenLimitSandwich(long, 50);
    expect(result).toContain('[...output truncated');
    expect(result).toContain('tokens...]');
  });

  it('returns empty string for empty input', async () => {
    expect(await applyTokenLimitSandwich('', 100)).toBe('');
  });

  it('allocates head and tail portions', async () => {
    const long = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const result = await applyTokenLimitSandwich(long, 100, 0.2);
    expect(result).toContain('word0'); // head from start
    expect(result).toContain('[...output truncated');
  });
});

// ---------------------------------------------------------------------------
// truncateOutput
// ---------------------------------------------------------------------------

describe('truncateOutput', () => {
  it('applies tail then token limit', async () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
    const result = await truncateOutput(lines, 10, 5);
    expect(result).toContain('[output truncated: showing last');
    expect(result.length).toBeLessThan(lines.length);
  });

  it('applies sandwich when tokenFrom = "sandwich"', async () => {
    const long = 'word '.repeat(2000);
    const result = await truncateOutput(long, null, 50, 'sandwich');
    expect(result).toContain('[...output truncated');
  });

  it('returns short output unchanged', async () => {
    const short = 'just a few words';
    expect(await truncateOutput(short)).toBe(short);
  });

  it('returns empty string for empty input', async () => {
    expect(await truncateOutput('')).toBe('');
  });
});
