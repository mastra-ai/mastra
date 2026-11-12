import { Text, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, mastra, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { card } from './surface.js';
import { WidthAwareContainer } from './width-aware-container.js';

export interface NotificationOptions {
  message: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
  previewLineLimit?: number;
  backgroundCompletion?: {
    taskId?: string;
    kind?: 'process';
    pid?: string;
    exitCode?: number;
    toolName?: string;
    title?: string;
    summary?: string;
    interrupted?: boolean;
    argsSummary?: string;
    errorSummary?: string;
  };
}

/** One-line card for finished background work, e.g. `↳ Shell finished · Running tests (exit 1)`. */
function formatBackgroundCompletionLine(
  completion: NonNullable<NotificationOptions['backgroundCompletion']>,
  status: string | undefined,
): string {
  const title = completion.title ?? completion.toolName ?? 'Background task';
  const summary = completion.summary ? theme.fg('muted', ` · ${completion.summary}`) : '';
  if (completion.kind === 'process') {
    const failed = completion.exitCode !== 0;
    const exit =
      completion.exitCode === undefined ? '' : theme.fg(failed ? 'error' : 'muted', ` (exit ${completion.exitCode})`);
    return `${theme.fg(failed ? 'error' : 'success', '↳')} ${theme.fg('toolTitle', title)} finished${summary}${exit}`;
  }
  const verb = completion.interrupted
    ? 'interrupted by a restart'
    : status === 'cancelled'
      ? 'cancelled'
      : status === 'failed'
        ? 'failed'
        : 'finished';
  const arrowColor = status === 'cancelled' ? 'muted' : status === 'failed' ? 'error' : 'success';
  return `${theme.fg(arrowColor, '↳')} ${theme.fg('toolTitle', title)} ${verb}${summary}`;
}

function normalizePreviewLineLimit(limit: number | undefined): number {
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
  private previewLineLimit: number;
  private expanded = false;

  constructor(options: NotificationOptions) {
    super();
    this.options = options;
    this.previewLineLimit = normalizePreviewLineLimit(options.previewLineLimit);
  }

  setPreviewLineLimit(limit: number): void {
    const normalized = normalizePreviewLineLimit(limit);
    if (this.previewLineLimit === normalized) return;
    this.previewLineLimit = normalized;
    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.rebuild();
  }

  protected rebuildForWidth(width: number): void {
    this.clear();

    const options = this.options;
    // Expanding (ctrl+e) is a request to see everything, so it overrides compact
    // trimming. Collapsed background completions are already a single line —
    // that is their compact form — and their detail rows only exist once expanded.
    const compact = !this.expanded;
    if (options.backgroundCompletion && !this.expanded) {
      const line = formatBackgroundCompletionLine(options.backgroundCompletion, options.status);
      this.addChild(new Text(truncateToWidth(line, Math.max(1, width - BOX_INDENT)), BOX_INDENT, 0));
      return;
    }
    const titleText = options.source ? `notification from ${options.source}` : 'notification';
    // The compact card keeps only the essentials: who it's from and what it says.
    const details = compact ? '' : [options.priority, options.kind, options.status].filter(Boolean).join(' · ');
    const message = options.message.trim();
    const maxContentWidth = Math.max(
      MIN_NOTIFICATION_CONTENT_WIDTH,
      Math.min(MAX_NOTIFICATION_CONTENT_WIDTH, width - BOX_INDENT - 2),
    );
    const titleLines = wrapText(titleText, maxContentWidth);
    const detailLines = details ? wrapText(details, maxContentWidth) : [];
    const messageLines = message
      ? this.limitMessageLines(wrapText(message, maxContentWidth), compact, maxContentWidth)
      : [];
    const backgroundDetailLines = options.backgroundCompletion
      ? [
          options.backgroundCompletion.taskId
            ? `task · ${options.backgroundCompletion.taskId}`
            : `PID · ${options.backgroundCompletion.pid}`,
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
    // Left-bar card in blue: who it's from (in the priority color), details, then the message.
    const lines = [
      ...titleLines.map(line => chalk.hex(priorityColor(options.priority)).bold(line)),
      ...detailLines.map(line => theme.fg('dim', line)),
      // Message body in a soft grey so notifications read differently from assistant text.
      ...messageLines.map(line => theme.fg('thinkingText', line)),
      ...backgroundDetailLines.map(line => theme.fg('dim', line)),
    ];
    this.addChild(new Text(card(mastra.blue, lines).join('\n'), BOX_INDENT, 0));
  }

  private limitMessageLines(lines: string[], compact: boolean, maxWidth: number): string[] {
    if (!compact || lines.length <= this.previewLineLimit) return lines;
    const shown = lines.slice(0, this.previewLineLimit);
    if (shown.length === 0) return shown;
    // The ellipsis must fit inside the content width.
    const last = shown[shown.length - 1]!;
    shown[shown.length - 1] =
      visibleWidth(last) < maxWidth ? `${last}…` : `${truncateToWidth(last, maxWidth - 1, '')}…`;
    return shown;
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}
