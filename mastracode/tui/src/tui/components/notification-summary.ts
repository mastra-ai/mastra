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
  private readonly options: NotificationSummaryOptions;

  constructor(options: NotificationSummaryOptions) {
    super();
    this.options = options;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();

    const { options } = this;
    const sourceSummary = Object.entries(options.bySource)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ');
    const message = sourceSummary || options.message.trim();
    const title = `Notification summary: ${options.pending} pending`;

    this.addChild(new Text(chalk.hex(mastra.orange).bold(title), BOX_INDENT, 0));

    if (message) {
      this.addChild(new Text(theme.fg('dim', message), BOX_INDENT + 2, 0));
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
