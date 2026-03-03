/**
 * SlashCommandComponent - renders a bordered box for slash command messages
 * showing the command name as a heading and truncated content that can be
 * expanded with ctrl+e. The full content is still sent to the assistant.
 */

import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { mastra } from '../theme.js';

const MAX_COLLAPSED_LINES = 3;
const BORDER_COLOR = mastra.purple;

export class SlashCommandComponent extends Container {
  private commandName: string;
  private contentLines: string[];
  private expanded = false;

  constructor(commandName: string, content?: string) {
    super();
    this.commandName = commandName;
    this.contentLines = content ? content.split('\n').filter(l => l.trim()) : [];
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Spacer(1));

    const border = (char: string) => chalk.bold.hex(BORDER_COLOR)(char);
    const termWidth = process.stdout.columns || 80;
    const maxLineWidth = termWidth - 6;

    // Top border with command name
    const heading = chalk.hex(mastra.specialGray)(`/${this.commandName}`);
    this.addChild(new Text(`${border('┌──')} ${heading}`, 0, 0));

    if (this.contentLines.length === 0) {
      this.addChild(new Text(`${border('└──')}`, 0, 0));
      return;
    }

    // Word-wrap content lines
    const wrappedLines: string[] = [];
    for (const line of this.contentLines) {
      if (line.length > maxLineWidth) {
        let remaining = line;
        while (remaining.length > maxLineWidth) {
          const breakAt = remaining.lastIndexOf(' ', maxLineWidth);
          const splitAt = breakAt > 0 ? breakAt : maxLineWidth;
          wrappedLines.push(remaining.slice(0, splitAt));
          remaining = remaining.slice(splitAt).trimStart();
        }
        if (remaining) wrappedLines.push(remaining);
      } else {
        wrappedLines.push(line);
      }
    }

    const truncated = !this.expanded && wrappedLines.length > MAX_COLLAPSED_LINES + 1;
    const displayLines = truncated ? wrappedLines.slice(0, MAX_COLLAPSED_LINES) : wrappedLines;

    const contentText = displayLines
      .map(
        line =>
          `${border('│')} ${chalk.hex(mastra.mainGray)(line.length > maxLineWidth ? line.slice(0, maxLineWidth - 1) + '…' : line)}`,
      )
      .join('\n');
    this.addChild(new Text(contentText, 0, 0));

    if (truncated) {
      const moreText = chalk.hex(mastra.darkGray)(
        `... ${wrappedLines.length - MAX_COLLAPSED_LINES} more lines (ctrl+e to expand)`,
      );
      this.addChild(new Text(`${border('│')} ${moreText}`, 0, 0));
    }

    // Bottom border
    this.addChild(new Text(`${border('└──')}`, 0, 0));
  }
}
