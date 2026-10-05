/**
 * Shared drawing primitives for the borderless TUI design: half-block panels (prompt, sent messages,
 * tool output), the colored left bar for prompts that wait on the user, and soft keycaps for key hints.
 */
import { visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';

import { surfaceShade, theme } from '../theme.js';

const bgOpen = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `\x1b[48;2;${r};${g};${b}m`;
};

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
  const edge = (ch: string) => chalk.hex(bg)(ch.repeat(Math.max(0, width)));
  return [edge('▄'), ...rows.map(r => fillBg(r, width, bg)), edge('▀')];
}

/** Background of the prompt and sent messages. */
export const promptSurface = () => surfaceShade(2);
/** Background of tool output panels. */
export const toolSurface = () => surfaceShade(1);

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
