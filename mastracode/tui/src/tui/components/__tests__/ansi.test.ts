import { visibleWidth } from '@earendil-works/pi-tui';
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
