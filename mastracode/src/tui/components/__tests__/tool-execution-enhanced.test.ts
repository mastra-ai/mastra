import { describe, it, expect } from 'vitest';
import { truncateAnsi } from '../tool-execution-enhanced.js';

describe('truncateAnsi', () => {
  it('returns the string unchanged when within maxWidth', () => {
    expect(truncateAnsi('hello', 10)).toBe('hello');
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

  it('runs in linear time on pathological input (no ReDoS)', () => {
    // Many OSC 8 opens with no BEL terminator — the shape CodeQL flagged.
    const input = '\x1b]8;'.repeat(50_000);
    const start = Date.now();
    truncateAnsi(input, 40);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
