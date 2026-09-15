import { visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, it, expect } from 'vitest';
import { truncateAnsi } from '../ansi.js';

describe('truncateAnsi', () => {
  it('returns the string unchanged when within maxWidth', () => {
    expect(truncateAnsi('hello', 10)).toBe('hello');
  });

  it('returns the string unchanged when it exactly fills maxWidth', () => {
    expect(truncateAnsi('hello', 5)).toBe('hello');
    expect(truncateAnsi('abc界', 5)).toBe('abc界');
    expect(truncateAnsi('\x1b[31mhello\x1b[0m', 5)).toBe('\x1b[31mhello\x1b[0m');
  });

  it('returns no visible text when maxWidth is zero', () => {
    expect(truncateAnsi('hello', 0)).toBe('');

    const out = truncateAnsi('\x1b[31mhello\x1b[0m', 0);
    expect(stripAnsi(out)).toBe('');
    expect(visibleWidth(stripAnsi(out))).toBe(0);
  });

  it('preserves SGR escape sequences without counting them toward width', () => {
    const input = '\x1b[31mhello\x1b[0m';
    expect(truncateAnsi(input, 10)).toBe(input);
  });

  it('preserves OSC 8 hyperlinks', () => {
    const input = '\x1b]8;;https://example.com\x07link\x1b]8;;\x07';
    const out = truncateAnsi(input, 20);
    expect(out).toContain('\x1b]8;;https://example.com\x07');
    expect(out).toContain('link');
  });

  it('truncates visible text and closes open hyperlinks/styles', () => {
    const out = truncateAnsi('abcdefghij', 5);
    // 4 chars + ellipsis + closers
    expect(out).toMatch(/^abcd…/);
    expect(out).toContain('\x1b[0m');
  });

  it('truncates wide characters by terminal display width', () => {
    const out = truncateAnsi('界'.repeat(4), 5);

    expect(stripAnsi(out)).toBe('界界…');
    expect(visibleWidth(stripAnsi(out))).toBe(5);
  });

  it('preserves ANSI sequences while truncating wide characters by terminal display width', () => {
    const out = truncateAnsi(`\x1b[31m${'界'.repeat(4)}\x1b[0m`, 5);

    expect(out).toContain('\x1b[31m');
    expect(stripAnsi(out)).toBe('界界…');
    expect(visibleWidth(stripAnsi(out))).toBe(5);
  });

  it('runs in linear time on pathological input (no ReDoS)', () => {
    // Many OSC 8 opens with no BEL terminator — the shape CodeQL flagged.
    const input = '\x1b]8;'.repeat(50_000);
    // Warm up to avoid one-time JIT noise on slower CI runners.
    truncateAnsi('\x1b]8;'.repeat(100), 40);
    const start = performance.now();
    truncateAnsi(input, 40);
    const elapsed = performance.now() - start;
    // Generous budget — linear implementation should complete in a
    // few ms; exponential backtracking would take seconds or hang.
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('pi-tui ANSI width and wrapping compatibility', () => {
  const cases = [
    {
      name: 'plain ASCII',
      input: 'alpha beta gamma',
      width: 8,
      visibleWidth: 16,
      wrapped: ['alpha', 'beta', 'gamma'],
    },
    {
      name: 'SGR-styled ASCII',
      input: '\x1b[31malpha beta\x1b[0m',
      width: 6,
      visibleWidth: 10,
      wrapped: ['\x1b[31malpha', '\x1b[31mbeta\x1b[0m'],
    },
    {
      name: 'OSC hyperlink',
      input: '\x1b]8;;https://e.test\x07alpha beta\x1b]8;;\x07',
      width: 6,
      visibleWidth: 10,
      wrapped: ['\x1b]8;;https://e.test\x07alpha\x1b]8;;\x07', '\x1b]8;;https://e.test\x07beta\x1b]8;;\x07'],
    },
    {
      name: 'APC marker',
      input: '\x1b_cursor:data\x1b\\alpha beta',
      width: 6,
      visibleWidth: 10,
      wrapped: ['\x1b_cursor:data\x1b\\alpha', 'beta'],
    },
    {
      name: 'tab expansion',
      input: 'ab\tcd ef',
      width: 6,
      visibleWidth: 10,
      wrapped: ['ab\tc', 'd ef'],
    },
    {
      name: 'emoji grapheme',
      input: 'ab👩‍💻 cd',
      width: 5,
      visibleWidth: 7,
      wrapped: ['ab👩‍💻', 'cd'],
    },
    {
      name: 'combining mark',
      input: 'Café noir',
      width: 5,
      visibleWidth: 9,
      wrapped: ['Café', 'noir'],
    },
    {
      name: 'CJK text',
      input: '中文測試 alpha',
      width: 6,
      visibleWidth: 14,
      wrapped: ['中文測', '試', 'alpha'],
    },
    {
      name: 'style continuation',
      input: '\x1b[4mabcdef ghi\x1b[24m',
      width: 4,
      visibleWidth: 10,
      wrapped: ['\x1b[4mabcd\x1b[24m', '\x1b[4mef\x1b[24m', '\x1b[4mghi\x1b[24m'],
    },
    {
      name: 'unterminated CSI',
      input: 'ab\x1b[31broken',
      width: 5,
      visibleWidth: 11,
      wrapped: ['ab\x1b[31', 'broke', 'n'],
    },
    {
      name: 'unterminated OSC',
      input: 'ab\x1b]8;;unterminated',
      width: 5,
      visibleWidth: 18,
      wrapped: ['ab\x1b]8;', ';unte', 'rmina', 'ted'],
    },
  ] as const;

  for (const testCase of cases) {
    it(`preserves committed semantics for ${testCase.name}`, () => {
      expect(visibleWidth(testCase.input)).toBe(testCase.visibleWidth);
      expect(wrapTextWithAnsi(testCase.input, testCase.width)).toEqual(testCase.wrapped);
    });
  }
});
