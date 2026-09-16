import { Text, visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import type { QuietToolDisplayMode } from './tool-execution-interface.js';
import { WidthAwareContainer } from './width-aware-container.js';

export interface NotificationOptions {
  message: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
  quietDisplayMode?: QuietToolDisplayMode;
  quietPreviewLineLimit?: number;
}

function normalizeQuietPreviewLineLimit(limit: number | undefined): number {
  const normalized = Number.isFinite(limit) ? (limit as number) : 2;
  return Math.min(8, Math.max(0, Math.floor(normalized)));
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
  private quietDisplayMode: QuietToolDisplayMode;
  private quietPreviewLineLimit: number;

  constructor(options: NotificationOptions) {
    super();
    this.options = options;
    this.quietDisplayMode = options.quietDisplayMode ?? 'normal';
    this.quietPreviewLineLimit = normalizeQuietPreviewLineLimit(options.quietPreviewLineLimit);
  }

  setQuietModeDisplay(mode: QuietToolDisplayMode): void {
    if (this.quietDisplayMode === mode) return;
    this.quietDisplayMode = mode;
    this.rebuild();
  }

  setQuietPreviewLineLimit(limit: number): void {
    const normalized = normalizeQuietPreviewLineLimit(limit);
    if (this.quietPreviewLineLimit === normalized) return;
    this.quietPreviewLineLimit = normalized;
    this.rebuild();
  }

  protected rebuildForWidth(width: number): void {
    this.clear();

    const options = this.options;
    const quiet = this.quietDisplayMode === 'quiet';
    const titleText = options.source ? `notification from ${options.source}` : 'notification';
    // Quiet mode keeps the box but only the essentials: who it's from and what it says.
    const details = quiet ? '' : [options.priority, options.kind, options.status].filter(Boolean).join(' · ');
    const message = options.message.trim();
    const maxContentWidth = Math.max(
      MIN_NOTIFICATION_CONTENT_WIDTH,
      Math.min(MAX_NOTIFICATION_CONTENT_WIDTH, width - BOX_INDENT - 4),
    );
    const titleLines = wrapText(titleText, maxContentWidth);
    const detailLines = details ? wrapText(details, maxContentWidth) : [];
    const messageLines = message ? this.limitMessageLines(wrapText(message, maxContentWidth), quiet) : [];
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
  }

  private limitMessageLines(lines: string[], quiet: boolean): string[] {
    if (!quiet || lines.length <= this.quietPreviewLineLimit) return lines;
    const shown = lines.slice(0, this.quietPreviewLineLimit);
    if (shown.length === 0) return shown;
    shown[shown.length - 1] = `${shown[shown.length - 1]}…`;
    return shown;
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
