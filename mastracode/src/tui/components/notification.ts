import { Container, Spacer, Text, visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, getTermWidth, mastra, theme } from '../theme.js';
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

export class NotificationComponent extends Container {
  constructor(options: NotificationOptions) {
    super();

    const titleText = options.source ? `notification from ${options.source}` : 'notification';
    const details = [options.priority, options.kind, options.status].filter(Boolean).join(' · ');
    const message = options.message.trim();
    const maxContentWidth = Math.max(
      MIN_NOTIFICATION_CONTENT_WIDTH,
      Math.min(MAX_NOTIFICATION_CONTENT_WIDTH, getTermWidth() - BOX_INDENT - 4),
    );
    const titleLines = wrapText(titleText, maxContentWidth);
    const detailLines = details ? wrapText(details, maxContentWidth) : [];
    const messageLines = message ? wrapText(message, maxContentWidth) : [];
    const allLines = [...titleLines, ...detailLines, ...messageLines];
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

    this.addChild(new Text(borderColor(bottom), BOX_INDENT, 0));
    this.addChild(new Spacer(1));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
