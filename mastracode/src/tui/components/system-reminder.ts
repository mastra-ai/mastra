/**
 * SystemReminderComponent - renders system-generated reminder messages
 * with a distinct orange/dim style to differentiate from user messages.
 */

import { Container, Markdown } from '@mariozechner/pi-tui';
import { getMarkdownTheme, theme } from '../theme.js';

export interface SystemReminderOptions {
  message: string;
}

export class SystemReminderComponent extends Container {
  constructor(options: SystemReminderOptions) {
    super();

    // Title and message combined with full-width background
    const title = theme.fg('warning', '⚡ System Notice');
    const content = `${title}\n${options.message.trim()}`;

    this.addChild(
      new Markdown(content, 1, 1, getMarkdownTheme(), {
        bgColor: (text: string) => theme.bg('systemReminderBg', text),
        color: (text: string) => theme.fg('muted', text),
      }),
    );
  }
}
