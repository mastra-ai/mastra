import { Container, Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export interface NotificationSummaryOptions {
  message: string;
  pending: number;
  bySource: Record<string, number>;
}

export class NotificationSummaryComponent extends Container {
  constructor(options: NotificationSummaryOptions) {
    super();

    const title = chalk.hex(mastra.orange).bold(`Notification summary: ${options.pending} pending`);
    this.addChild(new Text(title, BOX_INDENT, 0));

    const sourceSummary = Object.entries(options.bySource)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ');
    const message = sourceSummary || options.message.trim();

    if (message) {
      this.addChild(new Text(theme.fg('dim', message), BOX_INDENT + 2, 0));
    }

    this.addChild(
      new Text(theme.fg('dim', 'Use notification_inbox to inspect pending notifications.'), BOX_INDENT + 2, 0),
    );
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
