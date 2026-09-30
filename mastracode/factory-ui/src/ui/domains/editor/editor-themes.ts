import type { CSSProperties } from 'react';

/**
 * Editor theme presets. Each preset (except the default) redefines the CSS
 * variables the editor's chrome and `.tok-*` syntax palette are built from,
 * scoped by a `data-editor-theme` attribute (see editor-syntax.css). The
 * default preset leaves the design-system tokens untouched.
 */
export type EditorThemeId = 'factory-settings' | 'synthwave-overdose' | 'goblin-mode' | 'beige-cubicle';

export interface EditorThemePreset {
  id: EditorThemeId;
  name: string;
  description: string;
  /** Editor pane background. Applied inline so it beats utility classes. */
  background?: string;
}

export const EDITOR_THEMES: EditorThemePreset[] = [
  {
    id: 'factory-settings',
    name: 'Factory Settings',
    description: 'The tokens the design team fought for. Flips with light and dark mode.',
  },
  {
    id: 'synthwave-overdose',
    name: 'Synthwave Overdose',
    description: 'Neon everything. Your retinas signed the waiver.',
    background: '#231733',
  },
  {
    id: 'goblin-mode',
    name: 'Goblin Mode',
    description: 'Green on black. Hoard code in your cave at 3am.',
    background: '#04100a',
  },
  {
    id: 'beige-cubicle',
    name: 'Beige Cubicle',
    description: 'TPS-report chic. Somehow smells like toner.',
    background: '#efe9dc',
  },
];

export const DEFAULT_EDITOR_THEME: EditorThemeId = 'factory-settings';

const STORAGE_KEY = 'mastra-editor-theme';

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

/** Inline style for a themed surface (background only; vars come from CSS). */
export function editorThemeStyle(id: EditorThemeId): CSSProperties | undefined {
  const preset = EDITOR_THEMES.find(theme => theme.id === id);
  return preset?.background ? { background: preset.background } : undefined;
}
