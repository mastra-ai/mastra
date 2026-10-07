/**
 * Startup header: the Mastra logo in Braille next to the app title and project info.
 *
 * The logo is the icon from LogoWithoutText (playground-ui), traced from its SVG path onto the Braille dot
 * grid, then mirrored around the middle circle so it is exactly symmetric (the source path is slightly
 * uneven). A dot lights when ≥55% of it is covered, which keeps the circles round at this size.
 */
import type { Component } from '@earendil-works/pi-tui';
import { visibleWidth } from '@earendil-works/pi-tui';

import { theme } from '../theme.js';

/** 16 columns × 5 rows: the header logo. */
export const LOGO_HEADER = [
  '   ⣠⣶⣶⣄  ⣠⣶⣶⣄',
  '   ⢻⣿⣿⣿  ⣿⣿⣿⡟',
  ' ⢀⣀ ⠈⠻⣿⣄⣠⣿⠟⢻⣷⣀⡀',
  '⢰⣿⣿⣿⡄ ⣿⣿⣿⣿ ⢸⣿⣿⣿⡆',
  '⠈⠻⠿⠟⠁ ⠙⠿⠿⠋ ⠈⠻⠿⠟⠁',
];

/** 24 columns × 7 rows: setup screens. */
export const LOGO_LARGE = [
  '     ⣴⣾⣿⣷⣦⡀  ⢀⣴⣾⣿⣷⣦',
  '    ⢸⣿⣿⣿⣿⣿⡇  ⢸⣿⣿⣿⣿⣿⡇',
  '     ⠻⢿⣿⣿⣿⡇  ⢸⣿⣿⣿⣿⣿',
  '       ⠈⢻⣿⣷⡀⢀⣾⣿⡟⠙⢿⣿⣆',
  ' ⣴⣾⣿⣿⣶⡀  ⣿⣿⣿⣿⣿⣿  ⢸⣿⣿⣿⣷⣦',
  '⠸⣿⣿⣿⣿⣿⡇  ⣿⣿⣿⣿⣿⣿  ⢸⣿⣿⣿⣿⣿⠇',
  ' ⠹⢿⣿⡿⠟⠁  ⠘⠿⣿⣿⠿⠃  ⠈⠻⢿⣿⡿⠏',
];

/** Logo rows in the accent color, padded to a common width. */
export function renderLogo(rows: string[] = LOGO_HEADER): string[] {
  const w = Math.max(...rows.map(r => visibleWidth(r)));
  return rows.map(r => theme.fg('accent', r) + ' '.repeat(w - visibleWidth(r)));
}

export interface HeaderOptions {
  version: string;
  appName?: string;
  /** Muted info lines (Project, Resource ID, Branch, Worktree of). */
  info: string[];
}

const LOGO_GAP = 3;

/**
 * Header lines for a given width:
 * - wide: logo, then title + info beside it (the info block is padded to the logo's 5 rows)
 * - narrow: logo stacked above title + info
 * - very narrow or a custom app name: one text line
 */
export function renderHeader(width: number, { version, appName, info }: HeaderOptions): string[] {
  const name = appName || 'Mastra Code';
  const compact =
    theme.fg('accent', '◆') + ' ' + theme.bold(theme.fg('accent', name)) + theme.fg('dim', ` v${version}`);
  if (name !== 'Mastra Code' || width < 30) return [compact];

  const title = theme.bold(theme.fg('text', name)) + theme.fg('dim', ` v${version}`);
  // Long info (a branch name, a worktree path) is cut with … so the header never wraps.
  const fit = (room: number) =>
    info.map(l =>
      theme.fg('muted', visibleWidth(l) <= room ? l : [...l].slice(0, Math.max(0, room - 1)).join('') + '…'),
    );
  const logo = renderLogo();
  const logoWidth = visibleWidth(logo[0]!);
  const room = width - logoWidth - LOGO_GAP;

  // Side by side while the title fits next to the logo; the info lines shorten to the space left.
  if (visibleWidth(title) <= room) {
    const infoLines = fit(room);
    // Keep the block as tall as the logo: without a worktree line there are only 3 info lines, so a
    // blank row goes under the title instead.
    const block = infoLines.length + 1 < logo.length ? [title, '', ...infoLines] : [title, ...infoLines];
    const top = Math.floor((logo.length - block.length) / 2);
    return logo.map((row, i) => row + ' '.repeat(LOGO_GAP) + (block[i - top] ?? ''));
  }
  return [...logo, '', title, ...fit(width)];
}

/** Startup header component; re-lays out on resize. */
export class HeaderComponent implements Component {
  constructor(
    private options: HeaderOptions,
    private paddingX = 1,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const pad = ' '.repeat(this.paddingX);
    return renderHeader(width - this.paddingX * 2, this.options).map(l => pad + l);
  }
}
