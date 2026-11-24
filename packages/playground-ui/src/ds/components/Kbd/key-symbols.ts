export type KeySymbol = {
  /** What a screen reader says for the key. */
  name: string;
  /** In the drawing's units, `KEY_SYMBOL_HEIGHT` of which are one cap height. */
  width: number;
  path: string;
};

export const KEY_SYMBOL_HEIGHT = 18;

const enter: KeySymbol = { name: 'Enter', width: 18, path: 'M17 2V8.5A3 3 0 0 1 14 11.5H1M5.5 7L1 11.5L5.5 16' };

/**
 * The key symbols a shortcut hint can contain, drawn to a capital letter's height because fonts disagree: Commit Mono
 * has no ↵ or ⌃ and a short ⌘, the body face has almost none, and each OS falls back to a different font. Naturally
 * short keys (sideways arrows, ⌃) are centered on the capitals instead of stretched.
 */
export const keySymbols: Readonly<Record<string, KeySymbol>> = {
  '⌘': {
    name: 'Command',
    width: 18,
    path: 'M14.25 1A2.75 2.75 0 0 0 11.5 3.75V14.25A2.75 2.75 0 1 0 14.25 11.5H3.75A2.75 2.75 0 1 0 6.5 14.25V3.75A2.75 2.75 0 1 0 3.75 6.5H14.25A2.75 2.75 0 0 0 14.25 1Z',
  },
  '⇧': { name: 'Shift', width: 18, path: 'M9 1L1 9.25H5.25V17H12.75V9.25H17Z' },
  '⌥': { name: 'Option', width: 18, path: 'M1 1H5.5L12.5 17H17M11.5 1H17' },
  '⌃': { name: 'Control', width: 16, path: 'M1 12.5L8 5.5L15 12.5' },
  '↵': enter,
  '⏎': enter,
  '⌫': {
    name: 'Backspace',
    width: 22,
    path: 'M7 2H18A3 3 0 0 1 21 5V13A3 3 0 0 1 18 16H7L1 9ZM10.5 6.5L15.5 11.5M15.5 6.5L10.5 11.5',
  },
  '⌦': {
    name: 'Forward delete',
    width: 22,
    path: 'M15 2H4A3 3 0 0 0 1 5V13A3 3 0 0 0 4 16H15L21 9ZM11.5 6.5L6.5 11.5M6.5 6.5L11.5 11.5',
  },
  '⎋': { name: 'Escape', width: 18, path: 'M9 1A8 8 0 1 1 1 9M9 9L1 1M5 1H1V5' },
  '⇥': { name: 'Tab', width: 19, path: 'M1 9H14M9 4L14 9L9 14M18 2V16' },
  '␣': { name: 'Space', width: 18, path: 'M1 11V16H17V11' },
  '↑': { name: 'Up arrow', width: 14, path: 'M7 17V1M1 7L7 1L13 7' },
  '↓': { name: 'Down arrow', width: 14, path: 'M7 1V17M1 11L7 17L13 11' },
  '←': { name: 'Left arrow', width: 18, path: 'M17 9H1M7 3L1 9L7 15' },
  '→': { name: 'Right arrow', width: 18, path: 'M1 9H17M11 3L17 9L11 15' },
};
