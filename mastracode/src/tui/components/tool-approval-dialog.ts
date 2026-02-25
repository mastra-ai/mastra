/**
 * Tool approval dialog component.
 * Shows tool details and prompts user to approve or decline execution.
 *
 * Keyboard shortcuts:
 *   y       — approve this one call
 *   n / Esc — decline this call
 *   a       — always allow this category for the session
 *   Y       — switch to YOLO mode (approve all)
 */
import { Box, getEditorKeybindings, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable } from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { theme } from '../theme.js';

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

export class ToolApprovalDialogComponent extends Box implements Focusable {
  private toolName: string;
  private args: unknown;
  private categoryLabel: string | undefined;
  private onAction: (action: ApprovalAction) => void;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(options: ToolApprovalDialogOptions) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.toolName = options.toolName;
    this.args = options.args;
    this.categoryLabel = options.categoryLabel;
    this.onAction = options.onAction;

    this.buildUI();
  }

  private buildUI(): void {
    // Title
    this.addChild(new Text(theme.fg('warning', '⚠ Tool Approval Required'), 0, 0));
    this.addChild(new Spacer(1));

    // Tool name
    this.addChild(new Text(theme.fg('accent', `Tool: `) + theme.fg('text', this.toolName), 0, 0));
    if (this.categoryLabel) {
      this.addChild(new Text(theme.fg('accent', `Category: `) + theme.fg('text', this.categoryLabel), 0, 0));
    }
    this.addChild(new Spacer(1));

    // Arguments (formatted)
    this.addChild(new Text(theme.fg('muted', 'Arguments:'), 0, 0));
    const argsText = this.formatArgs(this.args);
    for (const line of argsText.split('\n').slice(0, 10)) {
      this.addChild(new Text(theme.fg('text', '  ' + line), 0, 0));
    }
    if (argsText.split('\n').length > 10) {
      this.addChild(new Text(theme.fg('muted', '  ... (truncated)'), 0, 0));
    }

    this.addChild(new Spacer(1));
    // Prompt text with keyboard shortcuts
    const categoryHint = this.categoryLabel
      ? `lways allow ${this.categoryLabel.toLowerCase()}`
      : 'lways allow category';
    const dimColor = chalk.hex(theme.getTheme().dim);
    const key = chalk.hex(theme.getTheme().text).bold;
    this.addChild(
      new Text(
        theme.fg('accent', 'Allow? ') +
          key('y') +
          dimColor('es  ') +
          key('n') +
          dimColor('o  ') +
          key('a') +
          dimColor(categoryHint + '  ') +
          key('Y') +
          dimColor('olo'),
        0,
        0,
      ),
    );
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
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      const maxLen = 120;
      const firstLine = str.split('\n')[0] ?? '';
      const lineCount = typeof value === 'string' ? str.split('\n').length : 0;
      const suffix = lineCount > 1 ? ` (${lineCount} lines)` : '';
      const display = firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '…' : firstLine;
      lines.push(`${key}: ${display}${suffix}`);
    }
    return lines.join('\n');
  }

  handleInput(data: string): void {
    const kb = getEditorKeybindings();

    // Escape to decline
    if (kb.matches(data, 'selectCancel')) {
      this.onAction({ type: 'decline' });
      return;
    }

    // Single keypress shortcuts
    if (data === 'y') {
      this.onAction({ type: 'approve' });
    } else if (data === 'n') {
      this.onAction({ type: 'decline' });
    } else if (data === 'a') {
      this.onAction({ type: 'always_allow_category' });
    } else if (data === 'Y') {
      this.onAction({ type: 'yolo' });
    }
  }

  render(maxWidth: number): string[] {
    return super.render(maxWidth);
  }
}
