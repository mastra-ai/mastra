/**
 * Tool approval prompt: one inline row in the chat, directly under the pending tool call.
 *
 * Keyboard shortcuts:
 *   y       — approve this one call
 *   n / Esc — decline this call
 *   a       — always allow this category for this thread
 *   Y       — switch to YOLO mode (approve all)
 */
import { getKeybindings, truncateToWidth, visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { Component, Focusable } from '@earendil-works/pi-tui';
import { safeStringify } from '@mastra/core/utils';
import chalk from 'chalk';
import { decodePrintableShortcut } from '../key-input.js';
import { theme } from '../theme.js';
import { card } from './surface.js';

/** Long argument values (e.g. file contents) in the approval card stop after this many lines. */
const TARGET_MAX_LINES = 40;

export type ApprovalAction =
  | { type: 'approve' }
  | { type: 'decline' }
  | { type: 'always_allow_category' }
  | { type: 'yolo' };

export interface ToolApprovalDialogOptions {
  toolCallId: string;
  toolName: string;
  args: unknown;
  /** Human-readable category label, e.g. "Edit" or "Execute" */
  categoryLabel?: string;
  /**
   * Name the tool and list its arguments in the card. Set when no visible tool row shows this exact call,
   * e.g. a wrapper tool asking approval for an inner tool, or a tool without a call row.
   */
  showTarget?: boolean;
  onAction: (action: ApprovalAction) => void;
}

export class ToolApprovalDialogComponent implements Component, Focusable {
  private toolName: string;
  private args: unknown;
  private categoryLabel: string | undefined;
  private showTarget: boolean;
  private onAction: (action: ApprovalAction) => void;
  private resolved = false;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(options: ToolApprovalDialogOptions) {
    this.toolName = options.toolName;
    this.args = options.args;
    this.categoryLabel = options.categoryLabel;
    this.showTarget = options.showTarget ?? false;
    this.onAction = options.onAction;
  }

  invalidate(): void {}

  /**
   * One inline row under the pending tool call (which already shows the command / path):
   *   ▎ Allow?   y yes  ·  a always allow Execute  ·  Y YOLO  ·  n no
   * On narrow terminals the options wrap under "Allow?".
   * When no visible row shows this exact call (`showTarget`), the card names the tool and lists its arguments:
   *   ▎ Allow write_file?
   *   ▎   path: src/auth.ts
   *   ▎ y yes  ·  a always allow Edit  ·  Y YOLO  ·  n no
   */
  render(width: number): string[] {
    const warning = theme.getTheme().warning;
    const key = (k: string, label: string) => `${chalk.bold.hex(warning)(k)} ${theme.fg('muted', label)}`;
    const always = this.categoryLabel ? `always allow ${this.categoryLabel}` : 'always allow category';
    const options = [key('y', 'yes'), key('a', always), key('Y', 'YOLO'), key('n', 'no')];
    const sep = theme.fg('dim', '  ·  ');
    const room = width - 2; // "▎ "
    if (!this.showTarget) {
      const label = theme.bold(theme.fg('text', 'Allow?'));
      const line = `${label}   ${options.join(sep)}`;
      if (visibleWidth(line) <= room) return card(warning, [line]);
    }
    const label = this.showTarget
      ? theme.bold(theme.fg('text', `Allow ${this.toolName}?`))
      : theme.bold(theme.fg('text', 'Allow?'));
    const argRows = this.showTarget ? this.targetArgRows(room - 2).map(row => theme.fg('muted', `  ${row}`)) : [];
    // The question on its own row (then the arguments), then the options packed into as few rows as fit.
    const rows = [label, ...argRows];
    let row = '';
    for (const option of options) {
      const next = row ? `${row}${sep}${option}` : option;
      if (row && visibleWidth(next) > room) {
        rows.push(row);
        row = option;
      } else {
        row = next;
      }
    }
    rows.push(row);
    return card(warning, rows).map(l => truncateToWidth(l, width));
  }

  /**
   * Every argument in full, wrapped to `width`: this is what gets approved, so nothing is cut to one line.
   * Only very long values (file contents and the like) stop after TARGET_MAX_LINES with a count.
   */
  private targetArgRows(width: number): string[] {
    const args = this.args;
    if (args === null || args === undefined || typeof args !== 'object') return [String(args ?? '(none)')];
    const entries = Object.entries(args as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) return ['(none)'];
    const rows: string[] = [];
    for (const [key, value] of entries) {
      const text = `${key}: ${typeof value === 'string' ? value : safeStringify(value)}`;
      const wrapped = text.split('\n').flatMap(line => (line ? wrapTextWithAnsi(line, Math.max(10, width)) : ['']));
      rows.push(...wrapped.slice(0, TARGET_MAX_LINES));
      if (wrapped.length > TARGET_MAX_LINES) rows.push(`… ${wrapped.length - TARGET_MAX_LINES} more lines`);
    }
    return rows;
  }

  /** Arguments as "key: value" lines (used by tests and for tools without a call row). */
  describeArgs(): string {
    return this.formatArgs(this.args);
  }

  get tool(): string {
    return this.toolName;
  }

  private formatArgs(args: unknown): string {
    if (args === null || args === undefined) {
      return '(none)';
    }

    if (typeof args !== 'object') {
      return String(args);
    }

    const entries = Object.entries(args as Record<string, unknown>);
    if (entries.length === 0) return '(none)';

    const lines: string[] = [];
    for (const [key, value] of entries) {
      let str: string;
      if (typeof value === 'string') {
        str = value;
      } else {
        str = safeStringify(value);
      }
      const maxLen = 120;
      const firstLine = str.split('\n')[0] ?? '';
      const lineCount = typeof value === 'string' ? str.split('\n').length : 0;
      const suffix = lineCount > 1 ? ` (${lineCount} lines)` : '';
      const display = firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '…' : firstLine;
      lines.push(`${key}: ${display}${suffix}`);
    }
    return lines.join('\n');
  }

  private emit(action: ApprovalAction): void {
    if (this.resolved) return;
    this.resolved = true;
    this.onAction(action);
  }

  handleInput(data: string): void {
    if (this.resolved) return;
    const kb = getKeybindings();

    // Escape to decline
    if (kb.matches(data, 'tui.select.cancel')) {
      this.emit({ type: 'decline' });
      return;
    }

    switch (decodePrintableShortcut(data)) {
      case 'y':
        this.emit({ type: 'approve' });
        break;
      case 'n':
        this.emit({ type: 'decline' });
        break;
      case 'a':
        this.emit({ type: 'always_allow_category' });
        break;
      case 'Y':
        this.emit({ type: 'yolo' });
        break;
    }
  }
}
