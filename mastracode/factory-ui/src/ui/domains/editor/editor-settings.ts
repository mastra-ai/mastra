/**
 * User-configurable editor settings, persisted to localStorage. Everything
 * here applies live — no reloads.
 */

export interface EditorSettings {
  /** Editor font size in px. */
  fontSize: number;
  /** Spaces per indent step. */
  tabSize: 2 | 4 | 8;
  wordWrap: boolean;
  lineNumbers: boolean;
  autocomplete: boolean;
  /** LSP hover tooltips. */
  hoverDocs: boolean;
  /** LSP diagnostics squiggles + gutter markers. */
  diagnostics: boolean;
  /** Run the language server's formatter before every save. */
  formatOnSave: boolean;
  /** Real-time shared editing + presence. The display name comes from the signed-in identity. */
  multiplayer: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  autocomplete: true,
  hoverDocs: true,
  diagnostics: true,
  formatOnSave: false,
  multiplayer: true,
};

export const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18] as const;
export const TAB_SIZES = [2, 4, 8] as const;

const STORAGE_KEY = 'editor-settings';

export function loadEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EditorSettings>;
    // Merge over defaults so settings added in later versions pick up their
    // default instead of coming back undefined.
    return { ...DEFAULT_EDITOR_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_EDITOR_SETTINGS;
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable — settings stay in-memory for this session.
  }
}
