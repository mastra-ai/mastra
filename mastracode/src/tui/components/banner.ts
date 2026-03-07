/**
 * ASCII art banner for the Mastra Code TUI header.
 * Compact single-line format with gradient diamond, or full block-letter art on wide terminals.
 */
import chalk from 'chalk';

import { theme } from '../theme.js';

// Mastra brand purple gradient stops (left → right)
const GRADIENT_STOPS = ['#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa'];

// Full "MASTRA CODE" banner (42 chars wide)
const FULL_ART = [
  '█▀▄▀█ ▄▀█ █▀ ▀█▀ █▀█ ▄▀█   █▀▀ █▀█ █▀▄ █▀▀',
  '█ ▀ █ █▀█ ▀█  █  █▀▄ █▀█   █   █ █ █ █ █▀▀',
  '▀   ▀ ▀ ▀ ▀▀  ▀  ▀ ▀ ▀ ▀   ▀▀▀ ▀▀▀ ▀▀  ▀▀▀',
];

// Short "MASTRA" banner (24 chars wide)
const SHORT_ART = ['█▀▄▀█ ▄▀█ █▀ ▀█▀ █▀█ ▄▀█', '█ ▀ █ █▀█ ▀█  █  █▀▄ █▀█', '▀   ▀ ▀ ▀ ▀▀  ▀  ▀ ▀ ▀ ▀'];

function lerpColor(hex1: string, hex2: string, t: number): [number, number, number] {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  return [Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t)];
}

function gradientChar(ch: string, colIdx: number, totalCols: number): string {
  if (ch === ' ') return ' ';
  const t = totalCols <= 1 ? 0.5 : colIdx / (totalCols - 1);
  const segmentCount = GRADIENT_STOPS.length - 1;
  const segment = Math.min(Math.floor(t * segmentCount), segmentCount - 1);
  const frac = t * segmentCount - segment;
  const [r, g, b] = lerpColor(GRADIENT_STOPS[segment]!, GRADIENT_STOPS[segment + 1]!, frac);
  return chalk.rgb(r, g, b)(ch);
}

function colorLine(line: string): string {
  const chars = [...line];
  return chars.map((ch, i) => gradientChar(ch, i, chars.length)).join('');
}

/**
 * Render a compact single-line banner: ◆ Mastra Code v0.2.0
 * Used on narrow terminals or as the default compact header.
 */
export function renderCompactBanner(version: string, appName?: string): string {
  const name = appName || 'Mastra Code';
  return theme.fg('accent', '◆') + ' ' + theme.bold(theme.fg('accent', name)) + theme.fg('dim', ` v${version}`);
}

/**
 * Render the banner header for the TUI.
 *
 * Layout strategy:
 * - Wide terminals (≥50 cols): full ASCII art
 * - Medium (30-49): short ASCII art
 * - Narrow (<30) or custom apps: compact single-line
 */
export function renderBanner(version: string, appName?: string): string {
  const name = appName || 'Mastra Code';

  if (name !== 'Mastra Code') {
    return renderCompactBanner(version, name);
  }

  const cols = process.stdout.columns || 80;

  if (cols < 30) {
    return renderCompactBanner(version);
  }

  const art = cols >= 50 ? FULL_ART : SHORT_ART;
  const coloredLines = art.map(line => colorLine(line));
  coloredLines.push(theme.fg('dim', `v${version}`));

  return coloredLines.join('\n');
}
