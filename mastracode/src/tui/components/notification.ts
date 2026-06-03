import { Container, Spacer, Text } from '@mariozechner/pi-tui';
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
  switch (priority) {
    case 'urgent':
      return mastra.red;
    case 'high':
      return mastra.orange;
    case 'medium':
      return mastra.blue;
    default:
      return theme.getTheme().dim;
  }
}

export class NotificationComponent extends Container {
  constructor(options: NotificationOptions) {
    super();

    const titleParts = ['Notification'];
    if (options.source) titleParts.push(options.source);
    if (options.kind) titleParts.push(options.kind);

    const title = chalk.hex(mastra.orange).bold(titleParts.join(': '));
    const badges = [options.priority, options.status].filter((part): part is string => Boolean(part));
    const suffix = badges.length ? ` ${chalk.hex(priorityColor(options.priority))(`[${badges.join(' · ')}]`)}` : '';
    this.addChild(new Text(`${title}${suffix}`, BOX_INDENT, 0));

    if (options.message.trim()) {
      this.addChild(new Text(theme.fg('dim', options.message.trim()), BOX_INDENT + 2, 0));
    }

    this.addChild(new Spacer(1));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
