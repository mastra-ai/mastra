/**
 * Editor theme presets sourced from `@pierre/theme`. Each preset is a light +
 * dark pair; Pierre auto-picks the right one based on the active color scheme.
 *
 * The bundled palette covers everyday use plus soft/vibrant and colorblind
 * variants — no more hand-rolled `.tok-*` presets. Loaders are registered
 * lazily in PierreFileSurface so unused themes never enter the bundle.
 */

export type EditorThemeId =
  | 'pierre'
  | 'pierre-soft'
  | 'pierre-vibrant'
  | 'pierre-protanopia-deuteranopia'
  | 'pierre-tritanopia';

export interface EditorThemePreset {
  id: EditorThemeId;
  name: string;
  description: string;
  /** Shiki theme names Pierre resolves to registered loaders. */
  light: string;
  dark: string;
  /** Preview swatch (chrome bg / accent) so the picker can render a chip. */
  swatch: {
    light: { bg: string; fg: string; accent: string };
    dark: { bg: string; fg: string; accent: string };
  };
}

export const EDITOR_THEMES: EditorThemePreset[] = [
  {
    id: 'pierre',
    name: 'Pierre',
    description: 'The default pair. Balanced contrast, follows your OS color scheme.',
    light: 'pierre-light',
    dark: 'pierre-dark',
    swatch: {
      light: { bg: '#ffffff', fg: '#1f2328', accent: '#0969da' },
      dark: { bg: '#0d1117', fg: '#e6edf3', accent: '#7ee787' },
    },
  },
  {
    id: 'pierre-soft',
    name: 'Pierre Soft',
    description: 'Muted tones for long sessions. Same palette, lower voltage.',
    light: 'pierre-light-soft',
    dark: 'pierre-dark-soft',
    swatch: {
      light: { bg: '#f6f5f2', fg: '#33322f', accent: '#3d7bb3' },
      dark: { bg: '#1a1a1d', fg: '#cbd0d6', accent: '#84c26f' },
    },
  },
  {
    id: 'pierre-vibrant',
    name: 'Pierre Vibrant',
    description: 'Cranked-up saturation. When you need every token to shout.',
    light: 'pierre-light-vibrant',
    dark: 'pierre-dark-vibrant',
    swatch: {
      light: { bg: '#ffffff', fg: '#111827', accent: '#e11d48' },
      dark: { bg: '#080a10', fg: '#f8fafc', accent: '#f472b6' },
    },
  },
  {
    id: 'pierre-protanopia-deuteranopia',
    name: 'Pierre Red-Green Safe',
    description: 'Palette shifted for protanopia and deuteranopia.',
    light: 'pierre-light-protanopia-deuteranopia',
    dark: 'pierre-dark-protanopia-deuteranopia',
    swatch: {
      light: { bg: '#ffffff', fg: '#1f2328', accent: '#2563eb' },
      dark: { bg: '#0d1117', fg: '#e6edf3', accent: '#60a5fa' },
    },
  },
  {
    id: 'pierre-tritanopia',
    name: 'Pierre Blue-Yellow Safe',
    description: 'Palette shifted for tritanopia.',
    light: 'pierre-light-tritanopia',
    dark: 'pierre-dark-tritanopia',
    swatch: {
      light: { bg: '#ffffff', fg: '#1f2328', accent: '#c026d3' },
      dark: { bg: '#0d1117', fg: '#e6edf3', accent: '#f472b6' },
    },
  },
];

export const DEFAULT_EDITOR_THEME: EditorThemeId = 'pierre';

const STORAGE_KEY = 'mastra-editor-theme';

/** Older theme ids (factory-settings/synthwave-overdose/etc.) fall back to 'pierre'. */
export function loadEditorTheme(): EditorThemeId {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && EDITOR_THEMES.some(theme => theme.id === raw)) return raw as EditorThemeId;
  } catch {
    // Storage unavailable (private mode etc.) — fall through to default.
  }
  return DEFAULT_EDITOR_THEME;
}

export function saveEditorTheme(id: EditorThemeId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Best effort — the choice just won't persist.
  }
}

export function getEditorThemePreset(id: EditorThemeId): EditorThemePreset {
  return EDITOR_THEMES.find(theme => theme.id === id) ?? EDITOR_THEMES[0]!;
}
