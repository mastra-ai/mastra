/**
 * Component that renders a user message with a thin border that fits the content.
 */

import { Container, Markdown, Spacer, Text, visibleWidth } from '@mariozechner/pi-tui';
import type { MarkdownTheme } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT_STR, getMarkdownTheme, mastra, tintHex, theme } from '../theme.js';

/**
 * Strip ANSI escape sequences from a string.
 */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * A renderable wrapper that adds a thin box-drawing border sized to content.
 */
class BorderedBox {
  private child: { render(width: number): string[]; invalidate?(): void };
  private pending: boolean;

  constructor(child: { render(width: number): string[]; invalidate?(): void }, options: { pending?: boolean } = {}) {
    this.child = child;
    this.pending = options.pending ?? false;
  }

  invalidate() {
    this.child.invalidate?.();
  }

  render(width: number): string[] {
    const borderColor = (s: string) =>
      this.pending ? chalk.hex(theme.getTheme().dim)(s) : chalk.hex(tintHex(mastra.green, 1))(s);

    // Border uses 4 chars: "│ " (2) on left + " │" (2) on right
    // Plus 2 for the "› " prompt prefix on the first line
    // Plus BOX_INDENT_STR.length for the left indent
    // Use the tightest constraint (first line with prompt) for Markdown width
    const maxInnerWidth = Math.max(1, width - 6 - 2 - BOX_INDENT_STR.length - 1);
    const childLines = this.child.render(maxInnerWidth);

    if (childLines.length === 0) {
      return [];
    }

    // Trim trailing whitespace padding that Markdown adds, and measure true content width
    const trimmedLines: string[] = [];
    let maxContentWidth = 0;
    for (const line of childLines) {
      // Markdown appends plain spaces to pad to full width — trim them
      const trimmed = line.replace(/\s+$/, '');
      trimmedLines.push(trimmed);
      const w = visibleWidth(stripAnsi(trimmed));
      if (w > maxContentWidth) maxContentWidth = w;
    }

    // Box inner width = content width + prompt prefix (the "│ " and " │" add the padding)
    const boxInner = maxContentWidth + 2;
    // Total box width: "│" + " " + content + " " + "│" = boxInner + 4
    const boxWidth = boxInner + 4;

    const lines: string[] = [];

    const promptPrefix = chalk.hex(tintHex(mastra.green, 1))('»') + ' ';
    const promptWidth = 2;

    // Top border: ╭──...──╮
    lines.push(borderColor(`╭${'─'.repeat(boxWidth - 2)}╮`));

    // Content lines with side borders, first line gets "> " prefix
    for (let i = 0; i < trimmedLines.length; i++) {
      const trimmed = trimmedLines[i]!;
      const vis = visibleWidth(stripAnsi(trimmed));
      if (i === 0) {
        const padNeeded = Math.max(0, boxInner - vis - promptWidth);
        lines.push(borderColor('│') + ' ' + promptPrefix + trimmed + ' '.repeat(padNeeded) + ' ' + borderColor('│'));
      } else {
        const padNeeded = Math.max(0, boxInner - vis);
        lines.push(borderColor('│') + ' ' + trimmed + ' '.repeat(padNeeded) + ' ' + borderColor('│'));
      }
    }

    // Bottom border: ╰──...──╯
    lines.push(borderColor(`╰${'─'.repeat(boxWidth - 2)}╯`));

    return lines.map(l => BOX_INDENT_STR + l);
  }
}

export class UserMessageComponent extends Container {
  constructor(text: string, markdownTheme: MarkdownTheme = getMarkdownTheme(), options: { pending?: boolean } = {}) {
    super();

    const md = new Markdown(text, 0, 0, markdownTheme, {
      color: (text: string) => (options.pending ? theme.fg('dim', text) : theme.fg('text', text)),
      italic: false,
    });

    this.addChild(new BorderedBox(md, { pending: options.pending }));
    this.addChild(new Spacer(1));
  }
}

export class PendingUserMessageComponent extends Container {
  constructor(text: string, imageCount = 0) {
    super();

    const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
    const displayText = `${prefix}${text.replace(/\[image\]\s*/g, '').trim()}`.trim();
    this.addChild(new Text(theme.fg('dim', `↳ ${displayText || 'Message'} pending…`), BOX_INDENT_STR.length, 0));
    this.addChild(new Spacer(1));
  }
}
