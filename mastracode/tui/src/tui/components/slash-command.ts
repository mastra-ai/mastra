/**
 * SlashCommandComponent - renders a "• skill /name" or "• command /name" block for slash command messages
 * showing the command name as a heading; the content stays hidden until
 * expanded with ctrl+e. The full content is still sent to the assistant.
 */

import { Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { statusDot, toolBlock } from './surface.js';
import { WidthAwareContainer } from './width-aware-container.js';

export class SlashCommandComponent extends WidthAwareContainer {
  private commandName: string;
  private contentLines: string[];
  private expanded = false;

  constructor(commandName: string, content?: string) {
    super();
    this.commandName = commandName;
    this.contentLines = content ? content.split('\n').filter(l => l.trim()) : [];
    this.rebuild();
  }

  matches(commandName: string, content: string): boolean {
    return (
      this.commandName === commandName &&
      this.contentLines.join('\n') ===
        content
          .split('\n')
          .filter(l => l.trim())
          .join('\n')
    );
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.rebuild();
  }

  protected rebuildForWidth(termWidth: number): void {
    this.clear();

    const width = Math.max(1, termWidth - BOX_INDENT * 2);
    const maxLineWidth = Math.max(1, width - 3);
    // "• skill /name" or "• command /name", styled like a tool header, with the expanded content on a
    // panel below.
    const dot = statusDot('done');
    const isSkill = this.commandName.startsWith('skill/');
    const name = isSkill ? this.commandName.slice('skill/'.length) : this.commandName;
    const heading = `${theme.bold(theme.fg('success', isSkill ? 'skill' : 'command'))} ${theme.fg('muted', `/${name}`)}`;
    const block = (output: string[]) =>
      this.addChild(new Text(toolBlock(dot, heading, output, width).join('\n'), BOX_INDENT, 0));

    // Collapsed shows only the header; ctrl+e reveals the expanded prompt.
    if (this.contentLines.length === 0 || !this.expanded) {
      block([]);
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

    block(
      wrappedLines.map(line =>
        chalk.hex(mastra.mainGray)(line.length > maxLineWidth ? line.slice(0, maxLineWidth - 1) + '…' : line),
      ),
    );
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
  }
}
