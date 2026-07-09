import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';

describe('sanitizeAnsiForRendering', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeAnsiForRendering('hello world')).toBe('hello world');
  });

  it('preserves SGR color codes (m-terminated)', () => {
    const colored = '\x1b[38;2;255;0;0mred text\x1b[0m';
    expect(sanitizeAnsiForRendering(colored)).toBe(colored);
  });

  it('preserves SGR bold/italic codes', () => {
    const bold = '\x1b[1mbold\x1b[22m';
    expect(sanitizeAnsiForRendering(bold)).toBe(bold);
  });

  it('strips cursor-up (CSI A)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[1Aafter')).toBe('beforeafter');
  });

  it('strips cursor-down (CSI B)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[1Bafter')).toBe('beforeafter');
  });

  it('strips cursor-forward (CSI C)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[5Cafter')).toBe('beforeafter');
  });

  it('strips cursor-back (CSI D)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[3Dafter')).toBe('beforeafter');
  });

  it('strips show-cursor (CSI ?25h)', () => {
    expect(sanitizeAnsiForRendering('text\x1b[?25h more')).toBe('text more');
  });

  it('strips hide-cursor (CSI ?25l)', () => {
    expect(sanitizeAnsiForRendering('text\x1b[?25l more')).toBe('text more');
  });

  it('strips bracketed-paste enable (CSI ?2004h)', () => {
    expect(sanitizeAnsiForRendering('\x1b[?2004hcontent')).toBe('content');
  });

  it('strips bracketed-paste disable (CSI ?2004l)', () => {
    expect(sanitizeAnsiForRendering('content\x1b[?2004l')).toBe('content');
  });

  it('strips erase-in-display (CSI J) — wait, J is recognised by pi-tui', () => {
    // CSI J IS recognised by extractAnsiCode so it won't cause swallowing,
    // but it's a screen-clearing op that shouldn't be in content.
    // We still strip it since it's not SGR.
    expect(sanitizeAnsiForRendering('before\x1b[2Jafter')).toBe('beforeafter');
  });

  it('strips erase-in-line (CSI K)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[2Kafter')).toBe('beforeafter');
  });

  it('strips cursor-position (CSI H)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[10;20Hafter')).toBe('beforeafter');
  });

  it('strips cursor-horizontal-absolute (CSI G)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[5Gafter')).toBe('beforeafter');
  });

  it('strips alternate-screen-buffer (CSI ?1049h)', () => {
    expect(sanitizeAnsiForRendering('\x1b[?1049hcontent\x1b[?1049l')).toBe('content');
  });

  it('strips scroll-region (CSI r)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[1;50rafter')).toBe('beforeafter');
  });

  it('handles mixed SGR and non-SGR sequences', () => {
    const input = '\x1b[1mbold\x1b[1A\x1b[2K\x1b[38;2;0;255;0mgreen\x1b[0m';
    const expected = '\x1b[1mbold\x1b[38;2;0;255;0mgreen\x1b[0m';
    expect(sanitizeAnsiForRendering(input)).toBe(expected);
  });

  it('returns text without ESC unchanged (fast path)', () => {
    const text = 'no escape codes here at all';
    expect(sanitizeAnsiForRendering(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(sanitizeAnsiForRendering('')).toBe('');
  });

  it('strips Kitty keyboard protocol push (CSI >1u)', () => {
    expect(sanitizeAnsiForRendering('text\x1b[>1umore')).toBe('textmore');
  });

  it('strips save/restore cursor (CSI s / CSI u)', () => {
    expect(sanitizeAnsiForRendering('before\x1b[safter\x1b[u')).toBe('beforeafter');
  });
});

describe('sanitizeAnsiForRendering integration with pi-tui visibleWidth', () => {
  it('unsanitized cursor-up causes visibleWidth to undercount (red without fix)', () => {
    // \x1b[1A is cursor-up — pi-tui's extractAnsiCode scans past 'A' looking
    // for m/G/K/H/J, swallowing all text until it finds one of those letters.
    // "hello\x1b[1A world has many items" — the scanner eats from \x1b[1A
    // through the 'm' in 'many', treating it all as one ANSI code.
    const unsanitized = 'hello\x1b[1A world has many items';
    const widthWithBug = visibleWidth(unsanitized);
    // Without fix: visibleWidth dramatically undercounts because
    // extractAnsiCode swallows text from \x1b[1A through 'm' in 'many'
    expect(widthWithBug).toBeLessThan('hello world has many items'.length);

    // With sanitization: cursor-up is stripped, visibleWidth is correct
    const sanitized = sanitizeAnsiForRendering(unsanitized);
    expect(sanitized).toBe('hello world has many items');
    expect(visibleWidth(sanitized)).toBe('hello world has many items'.length);
  });

  it('unsanitized mode-switch causes visibleWidth to undercount (red without fix)', () => {
    // \x1b[?25h (show cursor) ends with 'h' which is not in {m,G,K,H,J}.
    // The scanner scans past 'h' and eats text until the next 'm'.
    const unsanitized = 'start\x1b[?25h middle has some more text\x1b[0m end';
    const widthWithBug = visibleWidth(unsanitized);
    // The scanner eats from \x1b[?25h through 'm' in 'more', then \x1b[0m is
    // properly handled. So visible text is roughly "start end" instead of
    // "start middle has some more text end".
    expect(widthWithBug).toBeLessThan('start middle has some more text end'.length);

    // With sanitization: mode-switch is stripped, visibleWidth is correct
    const sanitized = sanitizeAnsiForRendering(unsanitized);
    expect(visibleWidth(sanitized)).toBe(visibleWidth('start middle has some more text\x1b[0m end'));
  });

  it('SGR codes are preserved and visibleWidth handles them correctly', () => {
    const withSGR = '\x1b[1m\x1b[38;2;255;0;0mhello\x1b[0m world';
    const sanitized = sanitizeAnsiForRendering(withSGR);
    // SGR codes should be preserved
    expect(sanitized).toBe(withSGR);
    // visibleWidth should only count visible characters
    expect(visibleWidth(sanitized)).toBe('hello world'.length);
  });

  it('formatToolResult output with shell escape codes is safe after sanitization', () => {
    // Simulates tool output from a command that writes cursor movement codes
    const shellOutput = 'Compiling...\x1b[1A\x1b[2KDone! 42 modules compiled.';
    const sanitized = sanitizeAnsiForRendering(shellOutput);
    // After sanitization, all visible text is preserved
    expect(sanitized).toBe('Compiling...Done! 42 modules compiled.');
    expect(visibleWidth(sanitized)).toBe('Compiling...Done! 42 modules compiled.'.length);
  });
});
