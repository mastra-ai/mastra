/**
 * Theme system for the Mastra Code TUI.
 * Simplified from pi-mono's theme system.
 */

import type { MarkdownTheme, EditorTheme, SettingsListTheme, SelectListTheme } from '@mariozechner/pi-tui';
import chalk from 'chalk';

// =============================================================================
// Theme Mode
// =============================================================================

export type ThemeMode = 'dark' | 'light';

let currentThemeMode: ThemeMode = 'dark';

export function getThemeMode(): ThemeMode {
  return currentThemeMode;
}

// =============================================================================
// Mastra Brand Palette (immutable — stays constant regardless of theme)
// =============================================================================

export const mastraBrand = {
  purple: '#7f45e0', // #b588fe brand is too washed out for terminal
  green: '#16c858', // brand green (dark mode primary)
  orange: '#fdac53',
  pink: '#ff69cc',
  blue: '#2563eb', // #6ccdfb brand is to washed out
  red: '#DC5663', // #ff4758 too intense
  yellow: '#e7e67b',
} as const;

// =============================================================================
// Extended Color Palette (additional colors for future use)
// =============================================================================

export const extendedColors = {
  // Teals / Cyans
  teal: '#14b8a6',
  cyan: '#06b6d4',
  lightCyan: '#22d3ee',
  // Blues
  skyBlue: '#38bdf8',
  indigo: '#6366f1',
  // Purples / Violets
  violet: '#a855f7',
  lavender: '#c084fc',
  fuchsia: '#d946ef',
  // Pinks / Roses
  rose: '#f472b6',
  coral: '#fb7185',
  // Warm Tones
  amber: '#fb923c',
  lime: '#a3e635',
  gold: '#facc15',
  // Earthy / Muted
  stone: '#a8a29e',
  warmGray: '#78716c',
  copper: '#b45309',
} as const;

export const greens = {
  // Bright / Vivid
  emerald: '#4ade80',
  seafoam: '#34d399',
  jade: '#10b981',
  springGreen: '#00ff7f',
  neonGreen: '#50fa7b',
  // Warm Greens
  chartreuse: '#84cc16',
  lightLime: '#bef264',
  electricLime: '#caff33',
  // Cool / Deep
  aquamarine: '#2dd4bf',
  mint: '#5eead4',
  pastelMint: '#6ee7b7',
  // Forest / Muted
  forest: '#16a34a',
  deepForest: '#15803d',
  sage: '#059669',
  pine: '#047857',
  evergreen: '#065f46',
  // Neon / Electric
  neonLime: '#39ff14',
  pureGreen: '#00ff00',
  hacker: '#00ff41',
  lawnGreen: '#66ff00',
} as const;

// =============================================================================
// Mastra Surface Palette (theme-dependent)
// =============================================================================

interface MastraSurface {
  bg: string;
  antiGrid: string;
  elevationSm: string;
  elevationLg: string;
  hover: string;
  white: string;
  specialGray: string;
  mainGray: string;
  darkGray: string;
  borderAntiGrid: string;
  borderElevation: string;
}

const darkSurface: MastraSurface = {
  bg: '#020202',
  antiGrid: '#0d0d0d',
  elevationSm: '#1a1a1a',
  elevationLg: '#141414',
  hover: '#262626',
  white: '#f0f0f0',
  specialGray: '#cccccc',
  mainGray: '#939393',
  darkGray: '#848484',
  borderAntiGrid: '#141414',
  borderElevation: '#1a1a1a',
};

const lightSurface: MastraSurface = {
  bg: '#ffffff',
  antiGrid: '#eaeaea',
  elevationSm: '#ebebeb',
  elevationLg: '#f0f0f0',
  hover: '#e0e0e0',
  white: '#1a1a1a',
  specialGray: '#444444',
  mainGray: '#636363',
  darkGray: '#666666',
  borderAntiGrid: '#e5e5e5',
  borderElevation: '#e0e0e0',
};

type MastraPalette = typeof mastraBrand & MastraSurface;

function getSurface(): MastraSurface {
  return currentThemeMode === 'dark' ? darkSurface : lightSurface;
}

// The actual terminal background color detected via OSC 11.
// Falls back to the surface palette bg if not detected.
let detectedTerminalBg: string | undefined;

/** The effective background color used for contrast calculations. */
function getContrastBg(): string {
  return detectedTerminalBg ?? getSurface().bg;
}

// Theme-adapted brand colors — precomputed for contrast against the actual terminal bg.
let adaptedBrand: Record<string, string> = {};

// Theme-adapted surface colors — precomputed for contrast against the actual terminal bg.
let adaptedSurface: Partial<Record<string, string>> = {};

// Surface keys that represent text colors (not backgrounds/borders)
const textSurfaceKeys: (keyof MastraSurface)[] = ['white', 'specialGray', 'mainGray', 'darkGray'];

// Theme keys that are used as foreground text colors (not backgrounds/borders)
const textThemeKeys: (keyof ThemeColors)[] = [
  'accent',
  'success',
  'error',
  'warning',
  'muted',
  'dim',
  'text',
  'thinkingText',
  'userMessageText',
  'toolTitle',
  'toolOutput',
  'textHighlight',
  'path',
  'number',
  'function',
];

// Comfortable minimum contrast for TUI body text — above WCAG AA (4.5:1) for better readability
export const TUI_MIN_CONTRAST = 5.5;

/** Terminal width buffer applied at the framework level to prevent wrapping in nested terminals */
export const TERM_WIDTH_BUFFER = 3;
/** Get the effective terminal width (matching the framework's reduced width) */
export const getTermWidth = () => (process.stdout.columns || 80) - TERM_WIDTH_BUFFER;

/** Left indent (in spaces) applied to assistant text (Markdown body) */
export const CHAT_INDENT = 2;
/** Precomputed indent string for assistant text */
export const CHAT_INDENT_STR = ' '.repeat(2);
/** Left indent (in spaces) applied to user messages and tool call boxes */
export const BOX_INDENT = 0;
/** Precomputed indent string for boxes */
export const BOX_INDENT_STR = '';

// Brand accent colors (purple, blue, etc.) use standard WCAG AA to preserve vibrancy
const BRAND_MIN_CONTRAST = 4.5;

function computeAdaptedColors(): void {
  const bg = getContrastBg();

  adaptedBrand = {};
  for (const [key, value] of Object.entries(mastraBrand)) {
    adaptedBrand[key] = ensureContrast(value, bg, BRAND_MIN_CONTRAST);
  }
  adaptedSurface = {};
  const surface = getSurface();
  for (const key of textSurfaceKeys) {
    adaptedSurface[key] = ensureContrast(surface[key], bg, TUI_MIN_CONTRAST);
  }

  // Adapt theme foreground colors against actual terminal bg
  const baseTheme = currentThemeMode === 'light' ? lightTheme : darkTheme;
  const adapted = { ...baseTheme };
  for (const key of textThemeKeys) {
    adapted[key] = ensureContrast(baseTheme[key], bg, TUI_MIN_CONTRAST);
  }
  currentTheme = adapted;
}

// Note: computeAdaptedColors() is called after darkTheme/lightTheme are defined (see below)

/** Mastra palette — brand + text surface colors are contrast-adapted, other surface colors adapt to theme mode. */
export const mastra: MastraPalette = new Proxy({} as MastraPalette, {
  get(_target, prop: string) {
    if (prop in mastraBrand) {
      return adaptedBrand[prop] ?? mastraBrand[prop as keyof typeof mastraBrand];
    }
    // For text surface colors, return the contrast-adapted version
    if (prop in adaptedSurface) {
      return adaptedSurface[prop];
    }
    const surface = getSurface();
    if (prop in surface) {
      return surface[prop as keyof MastraSurface];
    }
    return undefined;
  },
});

/** Tint a hex color by a brightness factor (0–1). e.g. tintHex("#ff8800", 0.15) → near-black orange */
export function tintHex(hex: string, factor: number): string {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// =============================================================================
// Theme Colors
// =============================================================================

export type ThemeColor =
  | 'accent'
  | 'border'
  | 'borderAccent'
  | 'borderMuted'
  | 'success'
  | 'error'
  | 'warning'
  | 'muted'
  | 'dim'
  | 'text'
  | 'thinkingText'
  | 'userMessageText'
  | 'toolTitle'
  | 'toolArgs'
  | 'toolOutput'
  | 'textHighlight'
  | 'toolBorderPending'
  | 'toolBorderSuccess'
  | 'toolBorderError'
  | 'function'
  | 'path'
  | 'number';

export type ThemeBg =
  | 'selectedBg'
  | 'userMessageBg'
  | 'systemReminderBg'
  | 'toolPendingBg'
  | 'toolSuccessBg'
  | 'toolErrorBg'
  | 'overlayBg'
  | 'errorBg';

export interface ThemeColors {
  // Core UI
  accent: string;
  border: string;
  borderAccent: string;
  borderMuted: string;
  success: string;
  error: string;
  warning: string;
  muted: string;
  dim: string;
  text: string;
  thinkingText: string;
  // User messages
  userMessageBg: string;
  userMessageText: string;
  // System reminders
  systemReminderBg: string;
  // Tool execution
  toolPendingBg: string;
  toolSuccessBg: string;
  toolErrorBg: string;
  toolBorderPending: string;
  toolBorderSuccess: string;
  toolBorderError: string;
  toolTitle: string;
  toolArgs: string;
  toolOutput: string;
  textHighlight: string;
  // Selection
  selectedBg: string;
  // Overlays
  overlayBg: string;
  // Error display
  errorBg: string;
  path: string;
  number: string;
  function: string;
}

// =============================================================================
// Dark Theme
// =============================================================================

export const darkTheme: ThemeColors = {
  // Core UI
  accent: '#16c858', // Brand green
  border: '#3f3f46',
  borderAccent: '#16c858',
  borderMuted: '#27272a',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  muted: '#8c8c94',
  dim: '#84848c',
  text: '#fafafa',
  thinkingText: '#a1a1aa',
  // User messages
  userMessageBg: '#0f172a', // Slate blue
  userMessageText: '#fafafa',
  // System reminders
  systemReminderBg: '#1a1400', // Dark orange tint
  // Tool execution
  toolPendingBg: '#0a1a10', // Dark green tint (matches brand accent)
  toolSuccessBg: '#0a1a10', // Dark green tint (same as pending)
  toolErrorBg: '#1f0a0a', // Dark red tint
  toolBorderPending: '#52525b', // Zinc-600 dim grey for pending
  toolBorderSuccess: '#52525b', // Zinc-600 dim grey for success
  toolBorderError: '#ef4444', // Red for error
  toolTitle: '#fb923c', // Amber for tool names
  toolArgs: '#ffe4c4', // Bisque (warm cream) for tool arguments
  toolOutput: '#d4d4d8',
  textHighlight: '#c084fc', // Lavender for inline code, headings, links
  // Error display
  errorBg: '#291415', // Slightly lighter than toolErrorBg for contrast
  path: '#9ca3af', // Gray for file paths
  number: '#fbbf24', // Yellow for line numbers
  function: '#60a5fa', // Light blue for function names
  // Selection
  selectedBg: darkSurface.hover,
  // Overlays
  overlayBg: darkSurface.antiGrid,
};

// =============================================================================
// Light Theme
// =============================================================================

export const lightTheme: ThemeColors = {
  // Core UI
  accent: '#0d8020', // Brand green (light mode)
  border: '#d4d4d8',
  borderAccent: '#0d8020',
  borderMuted: '#e4e4e7',
  success: '#15803d',
  error: '#dc2626',
  warning: '#d97706',
  muted: '#595961',
  dim: '#67676f',
  text: '#18181b',
  thinkingText: '#595961',
  // User messages
  userMessageBg: '#f0fdf4', // Light green tint
  userMessageText: '#18181b',
  // System reminders
  systemReminderBg: '#fefce8', // Light yellow
  // Tool execution
  toolPendingBg: '#f0fdf4', // Light green tint (matches brand accent)
  toolSuccessBg: '#f0fdf4', // Light green tint (same as pending)
  toolErrorBg: '#fef2f2', // Light red
  toolBorderPending: '#a1a1aa', // Zinc-400 dim grey for pending
  toolBorderSuccess: '#a1a1aa', // Zinc-400 dim grey for success
  toolBorderError: '#dc2626', // Red for error
  toolTitle: '#c2410c', // Deep amber for light backgrounds
  toolArgs: '#92400e', // Deep amber-brown for light backgrounds
  toolOutput: '#3f3f46',
  textHighlight: '#7c3aed', // Deep violet for light backgrounds
  // Error display
  errorBg: '#fef2f2', // Light red
  path: '#6b7280', // Gray for file paths
  number: '#b45309', // Amber for line numbers
  function: '#2563eb', // Blue for function names
  // Selection
  selectedBg: lightSurface.hover,
  // Overlays
  overlayBg: lightSurface.antiGrid,
};

// =============================================================================
// Theme Instance
// =============================================================================

let currentTheme: ThemeColors = darkTheme;

// Initialize adapted colors now that darkTheme/lightTheme are defined
computeAdaptedColors();

/**
 * Get the current theme colors.
 */
function getTheme(): ThemeColors {
  return currentTheme;
}

/**
 * Set the current theme.
 */
function setTheme(colors: ThemeColors): void {
  currentTheme = colors;
}

/**
 * Apply a theme mode, updating both the surface palette and the theme colors.
 */
export function applyThemeMode(mode: ThemeMode, terminalBgHex?: string): void {
  currentThemeMode = mode;
  currentTheme = mode === 'light' ? lightTheme : darkTheme;
  detectedTerminalBg = terminalBgHex;
  computeAdaptedColors();
  // Set terminal default foreground via OSC 10 so unstyled text (e.g. editor input)
  // adapts to the theme. Convert hex to rgb/ format for OSC.
  if (process.stdout.isTTY) {
    const textHex = currentTheme.text;
    const r = parseInt(textHex.slice(1, 3), 16);
    const g = parseInt(textHex.slice(3, 5), 16);
    const b = parseInt(textHex.slice(5, 7), 16);
    process.stdout.write(
      `\x1b]10;rgb:${r.toString(16).padStart(2, '0')}/${g.toString(16).padStart(2, '0')}/${b.toString(16).padStart(2, '0')}\x07`,
    );
  }
}

/**
 * Restore terminal foreground to default. Call on exit to undo OSC 10 changes.
 */
export function restoreTerminalForeground(): void {
  if (process.stdout.isTTY) {
    // OSC 110 resets the terminal's default foreground to its original value.
    process.stdout.write('\x1b]110\x07');
  }
}

// =============================================================================
// Theme Helper Functions
// =============================================================================

/**
 * Apply foreground color from theme.
 */
function fg(color: ThemeColor, text: string): string {
  const hex = currentTheme[color];
  if (!hex) return text;
  return chalk.hex(hex)(text);
}

/**
 * Apply background color from theme.
 */
function bg(color: ThemeBg, text: string): string {
  const hex = currentTheme[color];
  if (!hex) return text;
  return chalk.bgHex(hex)(text);
}

/**
 * Apply bold styling.
 */
function bold(text: string): string {
  return chalk.bold(text);
}

/**
 * Apply italic styling.
 */
function italic(text: string): string {
  return chalk.italic(text);
}

/**
 * Apply dim styling.
 */
function dim(text: string): string {
  return chalk.dim(text);
}

// =============================================================================
// Contrast Utilities (WCAG 2.1)
// =============================================================================

/** Convert a single sRGB channel (0–1) to linear light. */
function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Parse a hex color string into [r, g, b] in 0–1 range. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** Convert [r, g, b] (0–255) to a hex color string. */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/** WCAG relative luminance of a hex color. Returns 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two hex colors. Returns 1 (identical) to 21 (black/white). */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convert RGB (0–1) to HSL. Returns [h (0–360), s (0–1), l (0–1)]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Convert HSL to RGB (0–1). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360;
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

/**
 * Adjust a foreground color to ensure sufficient contrast against a background.
 * Adjusts lightness in HSL space to preserve hue and saturation.
 * Returns the original color if it already has sufficient contrast.
 */
export function ensureContrast(fgHex: string, bgHex: string, minRatio = 4.5): string {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;

  const [r, g, b] = parseHex(fgHex);
  const [h, s, origL] = rgbToHsl(r, g, b);
  const origCR = contrastRatio(fgHex, bgHex);

  function searchDirection(lighten: boolean): { hex: string; contrast: number } {
    const targetL = lighten ? 1 : 0;
    const extreme = lighten ? '#ffffff' : '#000000';
    const extremeCR = contrastRatio(extreme, bgHex);
    if (extremeCR <= origCR) return { hex: fgHex, contrast: origCR };

    let lo = 0;
    let hi = 1;
    let best = fgHex;
    let bestCR = origCR;

    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const newL = origL + (targetL - origL) * mid;
      const [nr, ng, nb] = hslToRgb(h, s, newL);
      const candidate = toHex(nr * 255, ng * 255, nb * 255);
      const cr = contrastRatio(candidate, bgHex);
      if (cr >= minRatio) {
        best = candidate;
        bestCR = cr;
        hi = mid;
      } else {
        lo = mid;
      }
    }

    if (bestCR < minRatio && extremeCR > bestCR) {
      // If the best hue-preserving result is reasonably close to the target,
      // keep it to preserve color identity rather than collapsing to black/white.
      if (bestCR >= minRatio * 0.65) {
        return { hex: best, contrast: bestCR };
      }
      return { hex: extreme, contrast: extremeCR };
    }

    return { hex: best, contrast: bestCR };
  }

  const whiteContrast = contrastRatio('#ffffff', bgHex);
  const blackContrast = contrastRatio('#000000', bgHex);
  const primaryLighten = whiteContrast >= blackContrast;

  const primaryResult = searchDirection(primaryLighten);
  if (primaryResult.contrast >= minRatio) return primaryResult.hex;

  const altResult = searchDirection(!primaryLighten);
  if (altResult.contrast >= minRatio) return altResult.hex;

  return primaryResult.contrast >= altResult.contrast ? primaryResult.hex : altResult.hex;
}

/**
 * Returns "#ffffff" or "#000000" depending on which has better contrast
 * against the given hex background color (WCAG relative luminance).
 */
export function getContrastText(hexBg: string): string {
  return luminance(hexBg) > 0.179 ? '#000000' : '#ffffff';
}

// =============================================================================
// Theme Object
// =============================================================================

export const theme = {
  fg,
  bg,
  bold,
  italic,
  dim,
  getTheme,
  setTheme,
};

// =============================================================================
// Markdown Theme (for pi-tui Markdown component)
// =============================================================================

export function getMarkdownTheme(): MarkdownTheme {
  const t = getTheme();
  return {
    heading: (text: string) => chalk.hex(t.textHighlight).bold(text),
    link: (text: string) => chalk.hex(t.textHighlight)(text),
    linkUrl: (text: string) => chalk.hex(t.muted)(text),
    code: (text: string) => chalk.hex(t.textHighlight).bold(text),
    codeBlock: (text: string) => chalk.hex(t.text)(text),
    codeBlockBorder: (text: string) => chalk.hex(t.dim)(text),
    quote: (text: string) => chalk.hex(t.muted).italic(text),
    quoteBorder: (text: string) => chalk.hex(t.borderMuted)(text),
    hr: (text: string) => chalk.hex(t.borderMuted)(text),
    listBullet: (text: string) => chalk.hex(t.textHighlight)(text),
    // Required by MarkdownTheme interface
    bold: (text: string) => chalk.bold(text),
    italic: (text: string) => chalk.italic(text),
    strikethrough: (text: string) => chalk.strikethrough(text),
    underline: (text: string) => chalk.underline(text),
  };
}

// =============================================================================
// Editor Theme (for pi-tui Editor component)
// =============================================================================

export function getEditorTheme(): EditorTheme {
  const t = getTheme();
  return {
    borderColor: (text: string) => chalk.hex(getContrastBg())(text),
    selectList: {
      selectedPrefix: (text: string) => chalk.hex(t.accent)(text),
      selectedText: (text: string) => chalk.bgHex(t.selectedBg)(text),
      description: (text: string) => chalk.hex(t.muted)(text),
      scrollInfo: (text: string) => chalk.hex(t.dim)(text),
      noMatch: (text: string) => chalk.hex(t.muted)(text),
    },
  };
}

// =============================================================================
// Settings List Theme (for pi-tui SettingsList component)
// =============================================================================

export function getSettingsListTheme(): SettingsListTheme {
  const t = getTheme();
  return {
    label: (text: string, selected: boolean) => (selected ? chalk.hex(t.text).bold(text) : chalk.hex(t.muted)(text)),
    value: (text: string, selected: boolean) => (selected ? chalk.hex(t.accent)(text) : chalk.hex(t.dim)(text)),
    description: (text: string) => chalk.hex(t.muted).italic(text),
    cursor: chalk.hex(t.accent)('→ '),
    hint: (text: string) => chalk.hex(t.dim)(text),
  };
}

export function getSelectListTheme(): SelectListTheme {
  const t = getTheme();
  return {
    selectedPrefix: (text: string) => chalk.hex(t.accent)(text),
    selectedText: (text: string) => chalk.bgHex(t.selectedBg)(text),
    description: (text: string) => chalk.hex(t.muted)(text),
    scrollInfo: (text: string) => chalk.hex(t.dim)(text),
    noMatch: (text: string) => chalk.hex(t.muted)(text),
  };
}
