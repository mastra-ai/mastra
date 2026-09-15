/**
 * Mastra brand palette (immutable — stays constant regardless of theme).
 *
 * Lives outside the TUI so non-TUI code (e.g. mode metadata colors in
 * `createMastraCode`) can use brand colors without importing TUI modules.
 * The TUI's `theme.ts` re-exports this and layers contrast adaptation on top.
 */
export const mastraBrand = {
  purple: '#7f45e0', // #b588fe brand is too washed out for terminal
  green: '#16c858', // brand green (dark mode primary)
  orange: '#fdac53',
  pink: '#ff69cc',
  blue: '#2563eb', // #6ccdfb brand is to washed out
  red: '#DC5663', // #ff4758 too intense
  yellow: '#e7e67b',
} as const;
