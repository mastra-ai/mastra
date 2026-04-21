import { describe, it, expect } from 'vitest';
import { parseErrorFromContent, truncateAnsi } from '../tool-execution-enhanced.js';

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

describe('parseErrorFromContent', () => {
  it('parses a standard Error: message line', () => {
    const err = parseErrorFromContent('TypeError: cannot read property x of undefined');
    expect(err).not.toBeNull();
    expect(err!.name).toBe('TypeError');
    expect(err!.message).toBe('cannot read property x of undefined');
  });

  it('matches the legacy "type names" the old regex accepted', () => {
    // The original pattern was /^([A-Z][a-zA-Z]*Error):\s*(.+)$/m, so only
    // error names made of ASCII letters were ever matched. These should
    // still match.
    for (const name of ['TypeError', 'RangeError', 'SyntaxError', 'ZodError', 'MyCustomError']) {
      const err = parseErrorFromContent(`${name}: boom`);
      expect(err?.name).toBe(name);
      expect(err?.message).toBe('boom');
    }
  });

  it('does not match names the original regex also rejected', () => {
    // Digits and underscores were never part of the original class.
    // Verifying here so a future loosening is a conscious decision.
    expect(parseErrorFromContent('HTTP404Error: x')).toBeNull();
    expect(parseErrorFromContent('My_CustomError: x')).toBeNull();
    expect(parseErrorFromContent('lowercaseError: x')).toBeNull();
  });

  it('preserves whitespace-only messages (matches legacy behaviour)', () => {
    // The old regex matched `TypeError:   ` with message = " ". We keep
    // that behaviour so any downstream rendering stays stable.
    const err = parseErrorFromContent('TypeError:   ');
    expect(err).not.toBeNull();
    expect(err!.name).toBe('TypeError');
    expect(err!.message).toBe(' ');
  });

  it('extracts stack frames when present', () => {
    const content = [
      'TypeError: boom',
      '    at foo (file.ts:10:5)',
      '    at bar (file.ts:20:5)',
    ].join('\n');
    const err = parseErrorFromContent(content);
    expect(err?.stack).toContain('at foo (file.ts:10:5)');
    expect(err?.stack).toContain('at bar (file.ts:20:5)');
  });

  it('returns null for non-error content', () => {
    expect(parseErrorFromContent('some random text')).toBeNull();
    expect(parseErrorFromContent('')).toBeNull();
    expect(parseErrorFromContent('Error')).toBeNull(); // missing ':'
  });

  it('runs in linear time on pathological inputs (no ReDoS)', () => {
    // Pathological inputs CodeQL flagged: many tabs/spaces after the
    // separator, and long non-error content — both should complete fast.
    // Warm up to avoid JIT noise on slower CI runners.
    parseErrorFromContent('AError:' + '\t'.repeat(1000));
    const budget = process.env.CI ? 1500 : 500;

    const cases = [
      'AError:' + '\t'.repeat(50_000),
      'AError:' + ' '.repeat(50_000) + 'x',
      'AError:' + 'x'.repeat(50_000),
    ];
    for (const input of cases) {
      const start = performance.now();
      parseErrorFromContent(input);
      expect(performance.now() - start).toBeLessThan(budget);
    }
  });
});
