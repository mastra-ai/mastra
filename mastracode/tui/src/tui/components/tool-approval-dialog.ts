/**
 * Tool approval prompt: one inline row in the chat, directly under the pending tool call.
 *
 * Keyboard shortcuts:
 *   y       — approve this one call
 *   n / Esc — decline this call
 *   a       — always allow this category for this thread
 *   Y       — switch to YOLO mode (approve all)
 */
import { getKeybindings, truncateToWidth } from '@earendil-works/pi-tui';
import type { Component, Focusable } from '@earendil-works/pi-tui';
import { safeStringify } from '@mastra/core/utils';
import chalk from 'chalk';
import { decodePrintableShortcut } from '../key-input.js';
import { theme } from '../theme.js';
import { card } from './surface.js';

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
  onAction: (action: ApprovalAction) => void;
}

export class ToolApprovalDialogComponent implements Component, Focusable {
  private toolName: string;
  private args: unknown;
  private categoryLabel: string | undefined;
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
    this.onAction = options.onAction;
  }

  invalidate(): void {}

  /**
   * One inline row under the pending tool call (which already shows the command / path):
   *   ▎ Allow?   y yes  ·  a always allow Execute  ·  Y YOLO  ·  n no
   * Tools without a visible call row (e.g. MCP tools) get the tool name in front.
   */
  render(width: number): string[] {
    const warning = theme.getTheme().warning;
    const key = (k: string, label: string) => `${chalk.bold.hex(warning)(k)} ${theme.fg('muted', label)}`;
    const always = this.categoryLabel ? `always allow ${this.categoryLabel}` : 'always allow category';
    const keys = [key('y', 'yes'), key('a', always), key('Y', 'YOLO'), key('n', 'no')].join(theme.fg('dim', '  ·  '));
    const line = `${theme.bold(theme.fg('text', 'Allow?'))}   ${keys}`;
    return card(warning, [line]).map(l => truncateToWidth(l, width));
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
