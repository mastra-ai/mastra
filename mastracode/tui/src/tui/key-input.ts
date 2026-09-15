/**
 * Decode a terminal input sequence into a single-character shortcut.
 *
 * pi-tui pushes the Kitty keyboard protocol when supported, so printable keys
 * arrive as CSI-u sequences (`\x1b[121u` for `y`) instead of raw bytes —
 * leaving `data === 'y'` style comparisons silently dropping every press.
 * Falls back to xterm modifyOtherKeys (`\x1b[27;<mod>;<cp>~`) for terminals
 * without Kitty support.
 *
 * Single-character `parseKey` results pass through unchanged — letters,
 * digits, and unmodified punctuation (`y`, `?`, `0`). `Shift+<letter>`
 * decodes to the uppercase letter so `Y`-vs-`y` shortcuts survive both
 * encodings. Shifted digits and symbols (`shift+1`, `shift+!`, etc.) return
 * `undefined` because pi-tui's `parseKey` does not collapse them to a
 * single shifted glyph. Ctrl/Alt/Super and non-printable keys return
 * `undefined` so modifier-bearing variants never alias a shortcut.
 *
 * Callers that want to react to space or other keys whose `parseKey` name
 * is multi-character (`space`, `enter`, `tab`, function keys) should use
 * pi-tui's `matchesKey` directly.
 */
import { parseKey } from '@earendil-works/pi-tui';

const SHIFT_LETTER_RE = /^shift\+([a-z])$/;

export function decodePrintableShortcut(data: string): string | undefined {
  const key = parseKey(data);
  if (key === undefined) return undefined;
  if (key.length === 1) return key;
  const shifted = SHIFT_LETTER_RE.exec(key);
  if (shifted) return shifted[1]!.toUpperCase();
  return undefined;
}
