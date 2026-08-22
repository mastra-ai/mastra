import { Text, visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { WidthAwareContainer } from './width-aware-container.js';

export interface NotificationOptions {
  message: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
  backgroundCompletion?: {
    taskId: string;
    toolName?: string;
    argsSummary?: string;
    errorSummary?: string;
  };
}

function priorityColor(priority?: string): string {
  if (priority === 'urgent' || priority === 'high') return mastra.orange;
  if (priority === 'medium') return mastra.blue;
  return mastra.darkGray;
}

const MAX_NOTIFICATION_CONTENT_WIDTH = 100;
const MIN_NOTIFICATION_CONTENT_WIDTH = 24;

function padLine(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - visibleWidth(value)));
}

function splitLongWord(word: string, maxWidth: number): string[] {
  const segments: string[] = [];
  let current = '';

  for (const char of word) {
    if (current && visibleWidth(current + char) > maxWidth) {
      segments.push(current);
      current = char;
    } else {
      current += char;
    }
  }

  if (current) segments.push(current);
  return segments;
}

function wrapText(value: string, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of value.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const wordSegments = visibleWidth(word) > maxWidth ? splitLongWord(word, maxWidth) : [word];
      for (const segment of wordSegments) {
        const next = current ? `${current} ${segment}` : segment;
        if (current && visibleWidth(next) > maxWidth) {
          lines.push(current);
          current = segment;
        } else {
          current = next;
        }
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

export class NotificationComponent extends WidthAwareContainer {
  private readonly options: NotificationOptions;
  private expanded = false;

  constructor(options: NotificationOptions) {
    super();
    this.options = options;
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  protected rebuildForWidth(width: number): void {
    this.clear();

    const options = this.options;
    if (options.backgroundCompletion && !this.expanded) {
      const completion = options.backgroundCompletion;
      const failed = options.status === 'failed';
      const cancelled = options.status === 'cancelled';
      const icon = cancelled ? theme.fg('muted', '■') : failed ? theme.fg('error', '✗') : theme.fg('success', '✓');
      const toolName = theme.fg('toolTitle', completion.toolName ?? 'background task');
      const status = cancelled
        ? 'cancelled in background'
        : failed
          ? 'failed in background'
          : 'completed in background';
      const taskId = theme.fg('muted', ` · ${completion.taskId}`);
      this.addChild(new Text(`${icon} ${toolName} ${status}${taskId}`, BOX_INDENT, 0));
      return;
    }
    const titleText = options.source ? `notification from ${options.source}` : 'notification';
    const details = [options.priority, options.kind, options.status].filter(Boolean).join(' · ');
    const message = options.message.trim();
    const maxContentWidth = Math.max(
      MIN_NOTIFICATION_CONTENT_WIDTH,
      Math.min(MAX_NOTIFICATION_CONTENT_WIDTH, width - BOX_INDENT - 4),
    );
    const titleLines = wrapText(titleText, maxContentWidth);
    const detailLines = details ? wrapText(details, maxContentWidth) : [];
    const messageLines = message ? wrapText(message, maxContentWidth) : [];
    const backgroundDetailLines = options.backgroundCompletion
      ? [
          `task · ${options.backgroundCompletion.taskId}`,
          options.backgroundCompletion.argsSummary
            ? `invocation · ${options.backgroundCompletion.argsSummary}`
            : undefined,
          options.backgroundCompletion.errorSummary
            ? `failure · ${options.backgroundCompletion.errorSummary}`
            : undefined,
        ]
          .filter((line): line is string => Boolean(line))
          .flatMap(line => wrapText(line, maxContentWidth))
      : [];
    const allLines = [...titleLines, ...detailLines, ...messageLines, ...backgroundDetailLines];
    const contentWidth = Math.max(...allLines.map(line => visibleWidth(line)), 1);
    const borderColor = chalk.hex(mastra.blue);
    const top = `╭${'─'.repeat(contentWidth + 2)}╮`;
    const bottom = `╰${'─'.repeat(contentWidth + 2)}╯`;

    this.addChild(new Text(borderColor(top), BOX_INDENT, 0));
    for (const line of titleLines) {
      this.addChild(
        new Text(
          `${borderColor('│')} ${chalk.hex(priorityColor(options.priority)).bold(padLine(line, contentWidth))} ${borderColor('│')}`,
          BOX_INDENT,
          0,
        ),
      );
    }

    for (const line of detailLines) {
      this.addChild(
        new Text(
          `${borderColor('│')} ${theme.fg('dim', padLine(line, contentWidth))} ${borderColor('│')}`,
          BOX_INDENT,
          0,
        ),
      );
    }

    for (const line of messageLines) {
      this.addChild(new Text(`${borderColor('│')} ${padLine(line, contentWidth)} ${borderColor('│')}`, BOX_INDENT, 0));
    }

    for (const line of backgroundDetailLines) {
      this.addChild(
        new Text(
          `${borderColor('│')} ${theme.fg('dim', padLine(line, contentWidth))} ${borderColor('│')}`,
          BOX_INDENT,
          0,
        ),
      );
    }

    this.addChild(new Text(borderColor(bottom), BOX_INDENT, 0));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
