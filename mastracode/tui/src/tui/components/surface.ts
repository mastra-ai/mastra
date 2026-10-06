/**
 * Shared drawing primitives for the borderless TUI design: half-block panels (prompt, sent messages,
 * tool output), the colored left bar for prompts that wait on the user, and soft keycaps for key hints.
 */
import { visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';

import { surfaceShade, theme } from '../theme.js';
import { truncateAnsi } from './ansi.js';

/** The xterm-256 gray ramp (232-255) plus black (16) and white (231). */
const GRAYS_256: Array<[number, number]> = [
  [16, 0],
  ...Array.from({ length: 24 }, (_, i): [number, number] => [232 + i, 8 + i * 10]),
  [231, 255],
];

/**
 * Nearest xterm-256 gray. Panel shades are a step off the background, and the nearest color of the 6×6×6 cube
 * is often a saturated one (peach on a cream background, teal on Solarized), so panels stay neutral instead.
 */
function nearestGray256(rgb: number[]): number {
  const luma = 0.299 * rgb[0]! + 0.587 * rgb[1]! + 0.114 * rgb[2]!;
  let best = GRAYS_256[0]!;
  for (const gray of GRAYS_256) if (Math.abs(gray[1] - luma) < Math.abs(best[1] - luma)) best = gray;
  return best[0];
}

/** SGR opening a panel color at the terminal's color depth, so panel bodies and their half-block edges match. */
function surfaceOpen(hex: string, layer: 38 | 48): string {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  if (chalk.level === 0) return '';
  if (chalk.level === 2) return `\x1b[${layer};5;${nearestGray256(rgb)}m`;
  // Level 1 is mostly a plain TERM=xterm on a truecolor terminal, so it keeps truecolor like before.
  return `\x1b[${layer};2;${rgb.join(';')}m`;
}

const bgOpen = (hex: string) => surfaceOpen(hex, 48);

/** Fill a line with `bg` across `width` columns, re-applying it after any reset inside the line. */
export function fillBg(line: string, width: number, bg: string): string {
  const open = bgOpen(bg);
  const pad = Math.max(0, width - visibleWidth(line));
  return open + line.replace(/\x1b\[(?:0|49)?m/g, m => m + open) + ' '.repeat(pad) + '\x1b[49m';
}

/**
 * Rows on a solid background framed by half blocks (▄ above, ▀ below), so the panel reads as starting and
 * ending mid-row instead of using a border.
 */
export function halfBlockPanel(rows: string[], width: number, bg: string): string[] {
  return [panelEdge('▄', width, bg), ...rows.map(r => fillBg(r, width, bg)), panelEdge('▀', width, bg)];
}

/** A panel's ▄ or ▀ edge in the panel color. Without colors there's no panel background, so it's blank. */
export function panelEdge(ch: '▄' | '▀', width: number, bg: string): string {
  const open = surfaceOpen(bg, 38);
  const n = Math.max(0, width);
  return open ? `${open}${ch.repeat(n)}\x1b[39m` : ' '.repeat(n);
}

// Panels whose shade fades from `step` at the left edge to the terminal background at the right.
const ESCAPE_TOKEN_RE = /(\x1b(?:\[[0-?]*[ -/]*[@-~]|[\]_][^\x07\x1b]*(?:\x07|\x1b\\)))/;
const RESET_RE = /^\x1b\[(?:0|49)?m$/;
const graphemes = new Intl.Segmenter();
/** Higher = the shade stays strong farther right before fading. 1 is a straight linear fade. */
const FADE_CURVE = 3;

function fadeShades(width: number, step: number): string[] {
  const last = Math.max(1, width - 1);
  // Ease-in curve: the shade holds near full strength across most of the row, then drops off at the end.
  return Array.from({ length: Math.max(0, width) }, (_, col) => surfaceShade(step * (1 - (col / last) ** FADE_CURVE)));
}

function fadeRow(line: string, shades: string[]): string {
  let out = '';
  let col = 0;
  let current = '';
  const cell = (text: string) => {
    const hex = shades[Math.min(col, shades.length - 1)] ?? '';
    if (hex !== current) {
      current = hex;
      out += bgOpen(hex);
    }
    out += text;
    col += visibleWidth(text);
  };
  for (const part of line.split(ESCAPE_TOKEN_RE)) {
    if (!part) continue;
    if (part.startsWith('\x1b')) {
      out += part;
      if (RESET_RE.test(part) && current) out += bgOpen(current);
      continue;
    }
    for (const { segment } of graphemes.segment(part)) cell(segment);
  }
  while (col < shades.length) cell(' ');
  return `${out}\x1b[49m`;
}

function fadeEdge(ch: '▄' | '▀', shades: string[]): string {
  if (chalk.level === 0) return ' '.repeat(shades.length);
  let out = '';
  let current = '';
  for (const hex of shades) {
    if (hex !== current) {
      current = hex;
      out += surfaceOpen(hex, 38);
    }
    out += ch;
  }
  return `${out}\x1b[39m`;
}

/** Like halfBlockPanel, but the shade fades out toward the right edge. */
export function fadePanel(rows: string[], width: number, step: number): string[] {
  // A 256-color terminal only has a few grays near the background, so the fade would show as hard bands.
  if (chalk.level === 2) return halfBlockPanel(rows, width, surfaceShade(step));
  const shades = fadeShades(width, step);
  return [fadeEdge('▄', shades), ...rows.map(r => fadeRow(r, shades)), fadeEdge('▀', shades)];
}

/** Background of the prompt and sent messages. */
export const promptSurface = () => surfaceShade(2);
/** Background of tool output panels. */
export const toolSurface = () => surfaceShade(1);

/** Glyph of the dot in front of a tool-style row; the same small bullet as the Working row's pulse. */
export const TOOL_DOT = '•';

/** Status dot in front of a tool-style row: grey while running, green when done, red on failure. */
export function statusDot(status: 'running' | 'done' | 'error'): string {
  return status === 'running'
    ? theme.fg('muted', TOOL_DOT)
    : theme.fg(status === 'error' ? 'error' : 'success', TOOL_DOT);
}

/**
 * Tool-style block: a "● title" row (further title rows indented under it), then the output on a shade-1
 * panel. No panel when there's no output.
 */
export function toolBlock(dot: string, title: string | string[], output: string[], width: number): string[] {
  const [first = '', ...rest] = Array.isArray(title) ? title : [title];
  const rows = [`${dot} ${first}`, ...rest.map(line => `  ${line}`)];
  if (output.length === 0) return rows;
  const contentWidth = Math.max(1, width - 3);
  return [
    ...rows,
    ...halfBlockPanel(
      output.map(line => `  ${truncateAnsi(line, contentWidth)}`),
      width,
      toolSurface(),
    ),
  ];
}

/** Left-bar card for inline prompts: accent = waiting on you, warning = approval, border = answered. */
export function card(color: string, lines: string[]): string[] {
  const bar = chalk.hex(color)('▎');
  return lines.map(l => (l === '' ? bar : `${bar} ${l}`));
}

/** Soft keycap: key text between the description grey and full white, on a chip one shade up. */
export function keycap(key: string): string {
  const fg = theme.getTheme().secondary;
  return fillBg(chalk.hex(fg)(` ${key} `), visibleWidth(key) + 2, surfaceShade(2));
}

/** "key description" hint, e.g. keyHint('/help', 'info & shortcuts'). */
export function keyHint(key: string, description: string): string {
  return `${keycap(key)} ${theme.fg('muted', description)}`;
}
