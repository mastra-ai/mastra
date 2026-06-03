import { Container, Spacer, Text, visibleWidth } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export interface NotificationOptions {
  message: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
}

function priorityColor(priority?: string): string {
  if (priority === 'urgent' || priority === 'high') return mastra.orange;
  if (priority === 'medium') return mastra.blue;
  return mastra.darkGray;
}

function padLine(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - visibleWidth(value)));
}

export class NotificationComponent extends Container {
  constructor(options: NotificationOptions) {
    super();

    const titleText = options.source ? `notification from ${options.source}` : 'notification';
    const details = [options.priority, options.kind, options.status].filter(Boolean).join(' · ');
    const message = options.message.trim();
    const contentWidth = Math.max(visibleWidth(titleText), visibleWidth(details), visibleWidth(message));
    const borderColor = chalk.hex(mastra.blue);
    const top = `╭${'─'.repeat(contentWidth + 2)}╮`;
    const bottom = `╰${'─'.repeat(contentWidth + 2)}╯`;

    this.addChild(new Text(borderColor(top), BOX_INDENT, 0));
    this.addChild(
      new Text(
        `${borderColor('│')} ${chalk.hex(priorityColor(options.priority)).bold(padLine(titleText, contentWidth))} ${borderColor('│')}`,
        BOX_INDENT,
        0,
      ),
    );

    if (details) {
      this.addChild(
        new Text(
          `${borderColor('│')} ${theme.fg('dim', padLine(details, contentWidth))} ${borderColor('│')}`,
          BOX_INDENT,
          0,
        ),
      );
    }

    if (message) {
      this.addChild(
        new Text(`${borderColor('│')} ${padLine(message, contentWidth)} ${borderColor('│')}`, BOX_INDENT, 0),
      );
    }

    this.addChild(new Text(borderColor(bottom), BOX_INDENT, 0));
    this.addChild(new Spacer(1));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
