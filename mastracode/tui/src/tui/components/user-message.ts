/**
 * Component that renders a sent user message on the same half-block panel as the prompt.
 */

import { Container, Markdown, Text, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { MarkdownTheme } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT_STR, getMarkdownTheme, getThemeGeneration, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { halfBlockPanel, promptSurface } from './surface.js';

/**
 * Strip ANSI escape sequences from a string.
 */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * A renderable wrapper that puts content on the prompt's half-block panel (full width, shaded, no border).
 * `borderColor` tints the → marker; `label` (e.g. "steer") is shown before the text.
 */
export class BorderedBox {
  private child: { render(width: number): string[]; invalidate?(): void };
  private pending: boolean;
  private borderColor?: string;
  private label?: string;
  private cachedLines?: string[];
  private cachedWidth?: number;
  private cachedThemeGeneration?: number;

  constructor(
    child: { render(width: number): string[]; invalidate?(): void },
    options: { pending?: boolean; borderColor?: string; label?: string } = {},
  ) {
    this.child = child;
    this.pending = options.pending ?? false;
    this.borderColor = options.borderColor;
    this.label = options.label;
  }

  invalidate() {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    this.cachedThemeGeneration = undefined;
    this.child.invalidate?.();
  }

  render(width: number): string[] {
    // Content is fixed after construction, so measuring/trimming/padding every
    // line each frame is wasted work on long threads. Cache by (width, theme).
    if (this.cachedLines && this.cachedWidth === width && this.cachedThemeGeneration === getThemeGeneration()) {
      return this.cachedLines;
    }
    const result = this.renderUncached(width);
    this.cachedLines = result;
    this.cachedWidth = width;
    this.cachedThemeGeneration = getThemeGeneration();
    return result;
  }

  private renderUncached(width: number): string[] {
    // Same panel as the prompt (half blocks, shaded background, → marker) so a sent message looks like
    // what was typed. The marker is grey instead of the mode color to tell it apart from the live prompt.
    const markerColor = this.borderColor ?? (this.pending ? theme.getTheme().dim : theme.getTheme().muted);
    const label = this.label ? theme.fg('dim', `${this.label} · `) : '';
    const prefix = `${chalk.hex(markerColor)('→')} ${label}`;
    const prefixWidth = 2 + (this.label ? visibleWidth(this.label) + 3 : 0);
    // " " + prefix + content + " "
    const contentWidth = Math.max(1, width - BOX_INDENT_STR.length - prefixWidth - 2);
    const childLines = this.child.render(contentWidth);
    if (childLines.length === 0) {
      return [];
    }

    const rows = childLines.map((line, i) => {
      // Markdown pads lines with spaces to the full width; trim them, then clamp.
      let content = line.replace(/\s+$/, '');
      if (visibleWidth(stripAnsi(content)) > contentWidth) content = truncateToWidth(content, contentWidth);
      return ` ${i === 0 ? prefix : ' '.repeat(prefixWidth)}${content}`;
    });
    return halfBlockPanel(rows, width - BOX_INDENT_STR.length, promptSurface()).map(l => BOX_INDENT_STR + l);
  }
}

export class UserMessageComponent extends Container {
  constructor(
    text: string,
    markdownTheme: MarkdownTheme = getMarkdownTheme(),
    options: { pending?: boolean; borderColor?: string; label?: string } = {},
  ) {
    super();

    const md = new Markdown(text, 0, 0, markdownTheme, {
      color: (text: string) => (options.pending ? theme.fg('dim', text) : theme.fg('text', text)),
      italic: false,
    });

    this.addChild(
      new BorderedBox(md, { pending: options.pending, borderColor: options.borderColor, label: options.label }),
    );
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'user-message';
  }
}

export class PendingUserMessageComponent extends Container {
  constructor(text: string, imageCount = 0) {
    super();

    const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
    const displayText = `${prefix}${text.replace(/\[image\]\s*/g, '').trim()}`.trim();
    this.addChild(new Text(theme.fg('dim', `↳ ${displayText || 'Message'} pending…`), BOX_INDENT_STR.length, 0));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'user-message';
  }
}
