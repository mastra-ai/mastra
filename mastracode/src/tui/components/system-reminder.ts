/**
 * SystemReminderComponent - renders system-generated reminder messages
 * with a distinct orange/dim style to differentiate from user messages.
 */

import { Container, Markdown, Spacer } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, ensureContrast, getMarkdownTheme, theme } from '../theme.js';

export interface SystemReminderOptions {
  message: string;
}

export class SystemReminderComponent extends Container {
  constructor(options: SystemReminderOptions) {
    super();

    // Title and message combined with full-width background
    const bgHex = theme.getTheme().systemReminderBg;
    const textColor = ensureContrast(theme.getTheme().text, bgHex);
    const warningColor = ensureContrast(theme.getTheme().warning, bgHex);
    const title = chalk.hex(warningColor)('⚡ System Notice');
    const content = `${title}\n${options.message.trim()}`;

    this.addChild(
      new Markdown(content, BOX_INDENT, 1, getMarkdownTheme(), {
        bgColor: (text: string) => theme.bg('systemReminderBg', text),
        color: (text: string) => chalk.hex(textColor)(text),
      }),
    );
    this.addChild(new Spacer(1));
  }
}
