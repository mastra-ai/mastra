/**
 * The editor ships exactly one theme — Pierre's default light/dark pair from
 * `@pierre/theme` — and the pair is picked by the factory's global color
 * scheme (`html.light`). There is deliberately no user-facing theme picker.
 */
export interface EditorTheme {
  /** Shiki theme names Pierre resolves to its bundled loaders. */
  light: string;
  dark: string;
  /** Chrome swatch for surfaces (e.g. the terminal) that mirror editor colors. */
  swatch: {
    light: { bg: string; fg: string; accent: string };
    dark: { bg: string; fg: string; accent: string };
  };
}

export const EDITOR_THEME: EditorTheme = {
  light: 'pierre-light',
  dark: 'pierre-dark',
  swatch: {
    light: { bg: '#ffffff', fg: '#1f2328', accent: '#0969da' },
    dark: { bg: '#0d1117', fg: '#e6edf3', accent: '#7ee787' },
  },
};
