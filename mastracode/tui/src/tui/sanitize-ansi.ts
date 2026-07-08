/**
 * Sanitize ANSI escape codes in text content before it enters the TUI
 * rendering pipeline.
 *
 * pi-tui's extractAnsiCode() only recognises CSI sequences that end with
 * one of {m, G, K, H, J}. When a CSI sequence uses a different final byte
 * (e.g. \x1b[1A  – cursor-up, ending with 'A'), the scanner skips past
 * the real terminator and swallows all subsequent text until it finally
 * hits one of those five letters. This makes visibleWidth() dramatically
 * undercount, wrapTextWithAnsi() produces far fewer lines, and the TUI
 * collapses to a handful of rows — permanently corrupting the session's
 * rendered height.
 *
 * This module strips every CSI sequence whose final byte is NOT 'm'
 * (SGR — Select Graphic Rendition, i.e. colours/styles). SGR codes are
 * the only CSI sequences that belong in rendered text content; all others
 * (cursor movement, screen clearing, mode switches, etc.) are terminal
 * control operations that should never appear in message or tool-result
 * text.
 */

// CSI (Control Sequence Introducer) format:
//   ESC [ <params> <final-byte>
// Where:
//   <params>  = zero or more bytes in the range 0x20–0x3F (space through ?)
//   <final-byte> = one byte in the range 0x40–0x7E (@ through ~)
//
// We keep only SGR (final byte = 'm') since those are colour/style codes
// that pi-tui's extractAnsiCode handles correctly.
//
// The regex below matches:
//   \x1b\[          — ESC [
//   [^@-~]*         — parameter bytes (anything that isn't the final byte range)
//   [^m@-~]?        — NOT used; instead we match a final byte that isn't 'm'
//
// Strategy: match ALL CSI sequences, then conditionally keep SGR ones.

const CSI_SEQUENCE_RE = /\x1b\[[\x20-\x3f]*[\x40-\x7e]/g;

/**
 * Strip non-SGR CSI sequences from text.
 *
 * Keeps: \x1b[...m  (SGR — colours, bold, italic, etc.)
 * Strips: \x1b[...A, \x1b[...h, \x1b[...l, etc.
 *
 * Also strips lone ESC bytes that aren't part of any recognised sequence
 * (bare ESC can confuse terminal state).
 */
export function sanitizeAnsiForRendering(text: string): string {
  if (!text.includes('\x1b')) return text;

  return text.replace(CSI_SEQUENCE_RE, match => {
    // Keep SGR sequences (ending with 'm')
    if (match.endsWith('m')) return match;
    // Strip everything else
    return '';
  });
}
