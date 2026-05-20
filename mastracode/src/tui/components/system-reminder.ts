/**
 * SystemReminderComponent - renders system-generated reminder messages
 * inline with a bordered amber notice style.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { BOX_INDENT, getTermWidth, mastraBrand, theme } from '../theme.js';

const MAX_COLLAPSED_LINES = 10;
const GENERIC_DYNAMIC_REMINDER_PREFIX = 'When using guidance from a discovered instruction file';

export interface SystemReminderOptions {
  message?: string;
  reminderType?: string;
  path?: string;
  goalMaxTurns?: number;
  judgeModelId?: string;
}

export class SystemReminderComponent extends Container {
  private readonly messageLines: string[];
  private readonly reminderType?: string;
  private readonly path?: string;
  private readonly goalMaxTurns?: number;
  private readonly judgeModelId?: string;
  private expanded = false;

  isExpanded(): boolean {
    return this.expanded;
  }

  constructor(options: SystemReminderOptions) {
    super();

    const resolvedMessage = resolveReminderMessage(options.message, options.path);
    this.messageLines = resolvedMessage.length
      ? resolvedMessage
          .split('\n')
          .map(line => line.trimEnd())
          .filter(line => line.length > 0)
      : [getLoadingMessage(options.reminderType, options.path)];
    this.reminderType = options.reminderType;
    this.path = options.path;
    this.goalMaxTurns = options.goalMaxTurns;
    this.judgeModelId = options.judgeModelId;

    this.rebuild();
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) {
      return;
    }

    this.expanded = expanded;
    this.rebuild();
  }

  toggleExpanded(): void {
    this.setExpanded(!this.expanded);
  }

  private rebuild(): void {
    this.clear();

    const accent = getReminderAccent(this.reminderType);
    const border = (char: string) => (accent ? chalk.hex(accent).bold(char) : theme.bold(theme.fg('toolTitle', char)));
    const titleText = getReminderTitle(this.reminderType, this.path, {
      goalMaxTurns: this.goalMaxTurns,
      judgeModelId: this.judgeModelId,
    });
    const title = accent ? chalk.hex(accent).bold(titleText) : theme.bold(theme.fg('toolTitle', titleText));
    const metadataColor = (text: string) => theme.fg('dim', text);
    const bodyColor = (text: string) => theme.fg('text', text);
    const hintColor = (text: string) => theme.fg('dim', text);
    const termWidth = getTermWidth();
    const innerWidth = Math.max(20, termWidth - BOX_INDENT * 2 - 4);
    const horizontal = '─'.repeat(innerWidth + 1);

    const metadataLines = [this.path ? formatReminderPath(this.path) : undefined].filter((line): line is string =>
      Boolean(line),
    );

    const wrappedMessageLines = wrapLines(this.messageLines, innerWidth);
    const shouldCollapse = wrappedMessageLines.length > MAX_COLLAPSED_LINES;
    const visibleMessageLines =
      shouldCollapse && !this.expanded ? wrappedMessageLines.slice(0, MAX_COLLAPSED_LINES) : wrappedMessageLines;

    this.addChild(new Text(`${border('╭')}${border(horizontal)}${border('╮')}`, BOX_INDENT, 0));
    this.addChild(new Text(renderRow(title, innerWidth, border), BOX_INDENT, 0));

    for (const line of metadataLines) {
      this.addChild(new Text(renderRow(metadataColor(line), innerWidth, border), BOX_INDENT, 0));
    }

    if (metadataLines.length > 0 && visibleMessageLines.length > 0) {
      this.addChild(new Text(renderRow('', innerWidth, border), BOX_INDENT, 0));
    }

    for (const line of visibleMessageLines) {
      this.addChild(new Text(renderRow(bodyColor(line), innerWidth, border), BOX_INDENT, 0));
    }

    if (shouldCollapse && !this.expanded) {
      const remaining = wrappedMessageLines.length - visibleMessageLines.length;
      const hint = hintColor(`... ${remaining} more lines (ctrl+e to expand)`);
      this.addChild(new Text(renderRow(hint, innerWidth, border), BOX_INDENT, 0));
    }

    this.addChild(new Text(`${border('╰')}${border(horizontal)}${border('╯')}`, BOX_INDENT, 0));
    this.addChild(new Spacer(1));
  }
}

function renderRow(text: string, width: number, border: (char: string) => string): string {
  const content = padLine(text, width);
  const rightPadding = hasWideGlyph(stripAnsi(text)) ? ' ' : '';
  return `${border('│')} ${content}${rightPadding}${border('│')}`;
}

function resolveReminderMessage(message: string | undefined, path: string | undefined): string {
  const trimmedMessage = message?.trim();
  if (trimmedMessage && trimmedMessage !== 'undefined' && !trimmedMessage.startsWith(GENERIC_DYNAMIC_REMINDER_PREFIX)) {
    return trimmedMessage;
  }

  if (!path) {
    return trimmedMessage && trimmedMessage !== 'undefined' ? trimmedMessage : '';
  }

  try {
    const fileContent = readFileSync(path, 'utf-8').trim();
    if (fileContent.length > 0) {
      return fileContent;
    }
  } catch {
    // Fall back to streamed/persisted message when local file content is unavailable.
  }

  return trimmedMessage && trimmedMessage !== 'undefined' ? trimmedMessage : '';
}

function getReminderTitle(
  reminderType: string | undefined,
  path: string | undefined,
  metadata: { goalMaxTurns?: number; judgeModelId?: string } = {},
): string {
  if (reminderType === 'goal') {
    const details = [
      typeof metadata.goalMaxTurns === 'number' ? `${metadata.goalMaxTurns} max attempts` : undefined,
      metadata.judgeModelId ? `judge: ${metadata.judgeModelId}` : undefined,
    ].filter(Boolean);
    return details.length > 0 ? `Goal (${details.join(', ')})` : 'Goal';
  }
  if (reminderType === 'goal-judge') return 'Goal';
  return reminderType === 'dynamic-agents-md' || isAgentsInstructionPath(path) ? 'Loaded AGENTS.md' : 'System Reminder';
}

function getReminderAccent(reminderType: string | undefined): string | undefined {
  return reminderType === 'goal' || reminderType === 'goal-judge' ? mastraBrand.blue : undefined;
}

function getLoadingMessage(reminderType: string | undefined, path: string | undefined): string {
  if (reminderType === 'goal' || reminderType === 'goal-judge') return 'Loading goal reminder…';
  return reminderType === 'dynamic-agents-md' || isAgentsInstructionPath(path)
    ? 'Loading instruction file contents…'
    : 'Loading reminder…';
}

function isAgentsInstructionPath(path: string | undefined): boolean {
  return typeof path === 'string' && /(?:^|\/)AGENTS\.md$/i.test(path);
}

function formatReminderPath(path: string): string {
  const cwd = process.cwd();
  if (path === cwd) {
    return '.';
  }

  const cwdPrefix = `${cwd}/`;
  return path.startsWith(cwdPrefix) ? path.slice(cwdPrefix.length) : path;
}

function hasWideGlyph(text: string): boolean {
  return [...text].some(char =>
    /[\p{Extended_Pictographic}\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u.test(
      char,
    ),
  );
}

function wrapLines(lines: string[], maxLineWidth: number): string[] {
  if (lines.length === 0) {
    return [''];
  }

  const wrappedLines: string[] = [];

  for (const line of lines) {
    if (line.length <= maxLineWidth) {
      wrappedLines.push(line);
      continue;
    }

    let remaining = line;
    while (remaining.length > maxLineWidth) {
      const breakAt = remaining.lastIndexOf(' ', maxLineWidth);
      const splitAt = breakAt > 0 ? breakAt : maxLineWidth;
      wrappedLines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    if (remaining.length > 0) {
      wrappedLines.push(remaining);
    }
  }

  return wrappedLines;
}

function padLine(text: string, width: number): string {
  const visibleLength = stripAnsi(text).length;
  if (visibleLength === width) {
    return text;
  }

  if (visibleLength > width) {
    return truncateLine(text, width);
  }

  return text + ' '.repeat(width - visibleLength);
}

function truncateLine(text: string, width: number): string {
  const plain = stripAnsi(text);
  return plain.length <= width ? text : plain.slice(0, Math.max(0, width - 1)) + '…';
}
