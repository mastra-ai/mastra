import { Container, Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import type { QuietToolDisplayMode } from './tool-execution-interface.js';

export interface NotificationSummaryOptions {
  message: string;
  pending: number;
  bySource: Record<string, number>;
  quietDisplayMode?: QuietToolDisplayMode;
}

export class NotificationSummaryComponent extends Container {
  private readonly options: NotificationSummaryOptions;
  private quietDisplayMode: QuietToolDisplayMode;

  constructor(options: NotificationSummaryOptions) {
    super();
    this.options = options;
    this.quietDisplayMode = options.quietDisplayMode ?? 'normal';
    this.rebuild();
  }

  setQuietModeDisplay(mode: QuietToolDisplayMode): void {
    if (this.quietDisplayMode === mode) return;
    this.quietDisplayMode = mode;
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

    // Quiet mode keeps the summary but drops the usage hint.
    if (this.quietDisplayMode === 'quiet') return;
    this.addChild(
      new Text(theme.fg('dim', 'Use notification_inbox to inspect pending notifications.'), BOX_INDENT + 2, 0),
    );
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
