import { Container, Text } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme';
import type { ChatSpacingKind } from './chat-spacing';

export interface ReactiveSignalOptions {
  tagName: string;
  message?: string;
}

export class ReactiveSignalComponent extends Container {
  constructor(options: ReactiveSignalOptions) {
    super();

    this.addChild(new Text(chalk.hex(mastra.orange).bold(`Signal: ${options.tagName}`), BOX_INDENT, 0));
    if (options.message?.trim()) {
      this.addChild(new Text(theme.fg('dim', options.message.trim()), BOX_INDENT + 2, 0));
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
