/**
 * Custom theme files for the mastracode TUI.
 *
 * Themes are JSON files in ~/.mastracode/themes/<name>.json:
 *
 *   {
 *     "name": "my-theme",
 *     "appearance": "dark",
 *     "bg": "#1a1b26",
 *     "vars": { "green": "#62f69d" },
 *     "colors": { "accent": "green", "border": "#3f3f46" }
 *   }
 *
 * - `appearance` selects the surface palette and the built-in theme
 *   (dark/light) used as a fallback for any color not specified.
 * - `bg` (optional) is the terminal background the theme expects; panel shades
 *   and contrast adaptation derive from it. The terminal's own background is
 *   left untouched.
 * - `vars` is an optional named palette; `colors` and `bg` values may be a
 *   hex string (#rrggbb) or the name of a var.
 * - Unknown color keys are ignored so newer themes degrade gracefully
 *   on older versions.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BUNDLED_THEMES } from './bundled-themes.js';
import type { ThemeColors } from './theme.js';
import { darkTheme, lightTheme } from './theme.js';

export interface CustomTheme {
  /** Theme name (from the file's `name` field, falls back to the filename). */
  name: string;
  /** Base appearance: picks the surface palette and fallback colors. */
  appearance: 'dark' | 'light';
  /** Terminal background the theme expects; panels and contrast derive from it. */
  bg?: string;
  /** Fully-resolved colors: file overrides merged over the built-in base. */
  colors: ThemeColors;
}

export type CustomThemeResult = { ok: true; theme: CustomTheme } | { ok: false; error: string };

/** All valid keys in `colors`, type-checked against ThemeColors. */
export const THEME_COLOR_KEYS = [
  'accent',
  'border',
  'borderAccent',
  'borderMuted',
  'success',
  'error',
  'warning',
  'muted',
  'dim',
  'text',
  'secondary',
  'thinkingText',
  'userMessageBg',
  'userMessageText',
  'systemReminderBg',
  'toolPendingBg',
  'toolSuccessBg',
  'toolErrorBg',
  'toolBorderPending',
  'toolBorderSuccess',
  'toolBorderError',
  'toolTitle',
  'toolArgs',
  'toolOutput',
  'textHighlight',
  'selectedBg',
  'overlayBg',
  'errorBg',
  'path',
  'number',
  'function',
] as const satisfies readonly (keyof ThemeColors)[];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Directory that holds user theme files. */
export function getThemesDir(): string {
  return path.join(os.homedir(), '.mastracode', 'themes');
}

/** Expand 3-digit hex (#abc) to 6-digit (#aabbcc); pass 6-digit through lowercased. */
function normalizeHex(value: string): string | undefined {
  const v = value.trim();
  if (HEX_RE.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const [r, g, b] = [v[1], v[2], v[3]];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return undefined;
}

/**
 * Parse and validate a theme file's JSON contents.
 * Exposed separately from file loading so it can be unit-tested directly.
 */
export function parseCustomTheme(json: string, fallbackName: string): CustomThemeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'theme file must be a JSON object' };
  }
  const obj = raw as Record<string, unknown>;

  const appearance = obj.appearance;
  if (appearance !== 'dark' && appearance !== 'light') {
    return { ok: false, error: `"appearance" must be "dark" or "light"` };
  }

  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : fallbackName;

  // Resolve the optional named palette
  // Prototype-free so lookups like vars['constructor'] can't resolve to
  // inherited Object.prototype members.
  const vars: Record<string, string> = Object.create(null);
  if (obj.vars !== undefined) {
    if (!obj.vars || typeof obj.vars !== 'object' || Array.isArray(obj.vars)) {
      return { ok: false, error: '"vars" must be an object of name → hex color' };
    }
    for (const [key, value] of Object.entries(obj.vars as Record<string, unknown>)) {
      if (typeof value !== 'string') return { ok: false, error: `var "${key}" must be a hex color string` };
      const hex = normalizeHex(value);
      if (!hex) return { ok: false, error: `var "${key}" is not a valid hex color: "${value}"` };
      vars[key] = hex;
    }
  }

  if (obj.colors !== undefined && (!obj.colors || typeof obj.colors !== 'object' || Array.isArray(obj.colors))) {
    return { ok: false, error: '"colors" must be an object' };
  }
  const rawColors = (obj.colors ?? {}) as Record<string, unknown>;

  let bg: string | undefined;
  if (obj.bg !== undefined) {
    if (typeof obj.bg !== 'string') return { ok: false, error: '"bg" must be a hex color string or a var name' };
    bg = normalizeHex(obj.bg) ?? vars[obj.bg.trim()];
    if (!bg) return { ok: false, error: `"bg" is not a hex color or a known var: "${obj.bg}"` };
  }

  const base = appearance === 'light' ? lightTheme : darkTheme;
  const colors: ThemeColors = { ...base };
  const explicit = new Set<keyof ThemeColors>();
  for (const key of THEME_COLOR_KEYS) {
    const value = rawColors[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return { ok: false, error: `color "${key}" must be a string` };
    const resolved = normalizeHex(value) ?? vars[value.trim()];
    if (!resolved) {
      return { ok: false, error: `color "${key}" is not a hex color or a known var: "${value}"` };
    }
    colors[key] = resolved;
    explicit.add(key);
  }

  if (bg) deriveBackgrounds(colors, bg, appearance, explicit);

  return { ok: true, theme: { name, appearance, bg, colors } };
}

/** Linear blend between two hex colors; t=0 returns a, t=1 returns b. */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((c, i) => Math.round(c + ((pb[i] ?? 0) - c) * t));
  return `#${out.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Derive panel/overlay backgrounds from the theme's `bg` for any background
 * key the file didn't set explicitly. Without this, a theme that repaints the
 * terminal background still gets the built-in near-black (or white) panels,
 * which clash with the new background.
 */
function deriveBackgrounds(
  colors: ThemeColors,
  bg: string,
  appearance: 'dark' | 'light',
  explicit: Set<keyof ThemeColors>,
): void {
  const lift = appearance === 'dark' ? '#ffffff' : '#000000';
  const derived: Partial<Record<keyof ThemeColors, string>> = {
    toolPendingBg: mixHex(bg, lift, 0.06),
    toolSuccessBg: mixHex(bg, lift, 0.06),
    overlayBg: mixHex(bg, lift, 0.08),
    selectedBg: mixHex(bg, lift, 0.16),
    userMessageBg: mixHex(bg, colors.accent, 0.12),
    systemReminderBg: mixHex(bg, colors.warning, 0.12),
    toolErrorBg: mixHex(bg, colors.error, 0.12),
    errorBg: mixHex(bg, colors.error, 0.12),
  };
  for (const [key, value] of Object.entries(derived) as [keyof ThemeColors, string][]) {
    if (!explicit.has(key)) colors[key] = value;
  }
}

/** Edit distance, used only for "did you mean" suggestions on theme names. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (next[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = next;
  }
  return prev[b.length] ?? 0;
}

/** Closest known theme name within a small edit distance, if any. */
function closestThemeName(name: string, themesDir: string): string | undefined {
  const candidates = [...Object.keys(BUNDLED_THEMES), ...listCustomThemes(themesDir)];
  let best: string | undefined;
  let bestDistance = 4; // allow up to 3 edits
  for (const candidate of candidates) {
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Load a theme by name. A user file in the themes directory wins over a
 * bundled theme of the same name.
 */
export function loadCustomTheme(name: string, themesDir: string = getThemesDir()): CustomThemeResult {
  // The name can come from MASTRA_THEME or saved settings — never let it
  // escape the themes directory.
  if (name !== path.basename(name) || name.includes('\0')) {
    return { ok: false, error: `invalid theme name "${name}"` };
  }
  const filePath = path.join(themesDir, `${name}.json`);
  let json: string | undefined;
  try {
    json = fs.readFileSync(filePath, 'utf-8');
  } catch {
    // fall through to bundled themes
  }
  if (json === undefined) {
    const bundled = Object.hasOwn(BUNDLED_THEMES, name) ? BUNDLED_THEMES[name] : undefined;
    if (!bundled) {
      const suggestion = closestThemeName(name, themesDir);
      const hint = suggestion ? `did you mean "${suggestion}"?` : `run /theme list to see available themes`;
      return { ok: false, error: `theme "${name}" not found — ${hint}` };
    }
    json = JSON.stringify(bundled);
  }
  return parseCustomTheme(json, name);
}

/** Names of the themes that ship with mastracode. */
export function listBundledThemes(): string[] {
  return Object.keys(BUNDLED_THEMES).sort();
}

/** List the names of all user theme files in the themes directory (without validating them). */
export function listCustomThemes(themesDir: string = getThemesDir()): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(themesDir);
  } catch {
    return [];
  }
  return entries
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -'.json'.length))
    .sort();
}
