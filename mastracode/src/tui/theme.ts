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
  green: '#059669', // #7aff78 too vibrant
  orange: '#fdac53',
  pink: '#ff69cc',
  blue: '#2563eb', // #6ccdfb brand is to washed out
  red: '#DC5663', // #ff4758 too intense
  yellow: '#e7e67b',
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
  darkGray: '#424242',
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
  mainGray: '#6b6b6b',
  darkGray: '#b0b0b0',
  borderAntiGrid: '#e5e5e5',
  borderElevation: '#e0e0e0',
};

type MastraPalette = typeof mastraBrand & MastraSurface;

function getSurface(): MastraSurface {
  return currentThemeMode === 'dark' ? darkSurface : lightSurface;
}

/** Mastra palette — brand colors are constant, surface colors adapt to theme mode. */
export const mastra: MastraPalette = new Proxy({} as MastraPalette, {
  get(_target, prop: string) {
    if (prop in mastraBrand) {
      return mastraBrand[prop as keyof typeof mastraBrand];
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
  | 'toolOutput'
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
  toolOutput: string;
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
  accent: '#7c3aed', // Purple
  border: '#3f3f46',
  borderAccent: '#7c3aed',
  borderMuted: '#27272a',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  muted: '#71717a',
  dim: '#52525b',
  text: '#fafafa',
  thinkingText: '#a1a1aa',
  // User messages
  userMessageBg: '#0f172a', // Slate blue
  userMessageText: '#fafafa',
  // System reminders
  systemReminderBg: '#1a1400', // Dark orange tint
  // Tool execution
  toolPendingBg: '#18152a', // Dark purple (matches tool title accent)
  toolSuccessBg: '#18152a', // Dark purple (same as pending)
  toolErrorBg: '#1f0a0a', // Dark red tint
  toolBorderPending: '#6366f1', // Indigo for pending
  toolBorderSuccess: '#22c55e', // Green for success
  toolBorderError: '#ef4444', // Red for error
  toolTitle: '#a78bfa',
  toolOutput: '#d4d4d8',
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
  accent: '#7c3aed', // Purple stays the same
  border: '#d4d4d8',
  borderAccent: '#7c3aed',
  borderMuted: '#e4e4e7',
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  muted: '#71717a',
  dim: '#a1a1aa',
  text: '#18181b',
  thinkingText: '#71717a',
  // User messages
  userMessageBg: '#eff6ff', // Light blue
  userMessageText: '#18181b',
  // System reminders
  systemReminderBg: '#fefce8', // Light yellow
  // Tool execution
  toolPendingBg: '#f5f3ff', // Light purple
  toolSuccessBg: '#f5f3ff', // Light purple (same as pending)
  toolErrorBg: '#fef2f2', // Light red
  toolBorderPending: '#6366f1', // Indigo for pending
  toolBorderSuccess: '#16a34a', // Green for success
  toolBorderError: '#dc2626', // Red for error
  toolTitle: '#7c3aed',
  toolOutput: '#3f3f46',
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
export function applyThemeMode(mode: ThemeMode): void {
  currentThemeMode = mode;
  currentTheme = mode === 'light' ? lightTheme : darkTheme;
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

/**
 * Returns "#ffffff" or "#000000" depending on which has better contrast
 * against the given hex background color (WCAG relative luminance).
 */
export function getContrastText(hexBg: string): string {
  const hex = hexBg.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.179 ? '#000000' : '#ffffff';
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
    heading: (text: string) => chalk.hex(t.accent).bold(text),
    link: (text: string) => chalk.hex(t.accent)(text),
    linkUrl: (text: string) => chalk.hex(t.muted)(text),
    code: (text: string) => chalk.hex(t.accent)(text),
    codeBlock: (text: string) => text,
    codeBlockBorder: (text: string) => chalk.hex(t.borderMuted)(text),
    quote: (text: string) => chalk.hex(t.muted).italic(text),
    quoteBorder: (text: string) => chalk.hex(t.borderMuted)(text),
    hr: (text: string) => chalk.hex(t.borderMuted)(text),
    listBullet: (text: string) => chalk.hex(t.accent)(text),
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
    borderColor: (text: string) => chalk.hex(t.border)(text),
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
