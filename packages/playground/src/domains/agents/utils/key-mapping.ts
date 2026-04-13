/**
 * Determine if a KeyboardEvent.key value represents a printable character.
 *
 * Printable characters have key.length === 1 (single Unicode character).
 * Non-printable keys have multi-character names: 'Enter', 'ArrowLeft', 'Shift', etc.
 * Dead keys return 'Dead' (length > 1, correctly treated as non-printable).
 */
export function isPrintableKey(key: string): boolean {
  return key.length === 1;
}
