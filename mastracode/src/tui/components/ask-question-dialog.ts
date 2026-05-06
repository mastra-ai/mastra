/**
 * Ask question dialog component.
 * Shows a question with either selectable options or free-text input.
 * Used by the ask_user tool to collect structured answers from the user.
 */

import { Box, getEditorKeybindings, Input, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, SelectItem, Component, TUI } from '@mariozechner/pi-tui';
import { theme, getSelectListTheme, getEditorTheme } from '../theme.js';
import { MultilineInput } from './multiline-input.js';

export interface AskQuestionDialogOptions {
  question: string;
  options?: Array<{ label: string; description?: string }>;
  /**
   * Use a multiline editor for free-text input (Shift+Enter / \+Enter for new lines).
   * Defaults to false. Enable for prompts that legitimately want paragraph-length replies.
   */
  multiline?: boolean;
  tui?: TUI;
  onSubmit: (answer: string) => void;
  onCancel: () => void;
}

export class AskQuestionDialogComponent extends Box implements Focusable {
  private static readonly CUSTOM_RESPONSE_VALUE = '__custom_response__';

  private selectList?: SelectList;
  private input?: Input | MultilineInput;
  private tui?: TUI;
  private multiline = false;
  private onSubmit: (answer: string) => void;
  private onCancel: () => void;

  /** Children added by buildSelectMode/buildInputMode, tracked for removal on mode switch */
  private modeChildren: Component[] = [];

  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    if (this.input) this.input.focused = value;
  }

  constructor(options: AskQuestionDialogOptions) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.onSubmit = options.onSubmit;
    this.onCancel = options.onCancel;
    this.tui = options.tui;
    this.multiline = Boolean(options.multiline);

    // Title
    this.addChild(new Text(theme.bold(theme.fg('accent', 'Question')), 0, 0));
    this.addChild(new Spacer(1));

    // Question text (may be multi-line)
    for (const line of options.question.split('\n')) {
      this.addChild(new Text(theme.fg('text', line), 0, 0));
    }
    this.addChild(new Spacer(1));

    if (options.options && options.options.length > 0) {
      this.buildSelectMode(options.options);
    } else {
      this.buildInputMode();
    }
  }

  private buildSelectMode(opts: Array<{ label: string; description?: string }>): void {
    const items: SelectItem[] = opts.map(opt => ({
      value: opt.label,
      label: opt.description ? `  ${opt.label}  ${theme.fg('dim', opt.description)}` : `  ${opt.label}`,
    }));

    // Append a "Custom response..." option so the user can type a free-text answer
    items.push({
      value: AskQuestionDialogComponent.CUSTOM_RESPONSE_VALUE,
      label: `  ${theme.fg('dim', '✎ Custom response...')}`,
    });

    this.selectList = new SelectList(items, Math.min(items.length, 8), getSelectListTheme());

    this.selectList.onSelect = (item: SelectItem) => {
      if (item.value === AskQuestionDialogComponent.CUSTOM_RESPONSE_VALUE) {
        this.switchToCustomInput();
        return;
      }
      this.onSubmit(item.value);
    };
    this.selectList.onCancel = this.onCancel;

    this.modeChildren = [];
    const selectChild = this.selectList;
    this.addChild(selectChild);
    this.modeChildren.push(selectChild);
    const spacer = new Spacer(1);
    this.addChild(spacer);
    this.modeChildren.push(spacer);
    const hint = new Text(theme.fg('dim', '  ↑↓ to navigate · Enter to select · Esc to skip'), 0, 0);
    this.addChild(hint);
    this.modeChildren.push(hint);
  }

  /** Whether this prompt should render a multiline editor (vs a single-line input). */
  private useMultiline(): boolean {
    return this.multiline && Boolean(this.tui);
  }

  private buildInputMode(): void {
    if (this.useMultiline()) {
      const multilineInput = new MultilineInput(this.tui!, getEditorTheme());
      multilineInput.onSubmit = (value: string) => {
        // Trim only for the emptiness decision; forward the raw value
        // so leading indentation / trailing newlines survive.
        if (value.trim()) {
          this.onSubmit(value);
        }
      };
      multilineInput.onEscape = () => {
        this.onCancel();
      };
      this.input = multilineInput;
    } else {
      this.input = new Input();
      this.input.onSubmit = (value: string) => {
        const trimmed = value.trim();
        if (trimmed) {
          this.onSubmit(trimmed);
        }
      };
    }

    this.modeChildren = [];
    const inputChild = this.input;
    this.addChild(inputChild);
    this.modeChildren.push(inputChild);
    const spacer = new Spacer(1);
    this.addChild(spacer);
    this.modeChildren.push(spacer);
    const hintText = this.useMultiline()
      ? '  Enter to submit · Shift+Enter for new line · \\+Enter for new line · Esc to skip'
      : '  Enter to submit · Esc to skip';
    const hint = new Text(theme.fg('dim', hintText), 0, 0);
    this.addChild(hint);
    this.modeChildren.push(hint);

    // Carry focus over so switchToCustomInput() yields a focused input.
    this.input.focused = this._focused;
  }

  private switchToCustomInput(): void {
    // Remove select mode children
    for (const child of this.modeChildren) {
      this.removeChild(child);
    }
    this.selectList = undefined;
    this.buildInputMode();
  }

  handleInput(data: string): void {
    if (this.selectList) {
      this.selectList.handleInput(data);
    } else if (this.input) {
      const kb = getEditorKeybindings();
      if (kb.matches(data, 'selectCancel')) {
        this.onCancel();
        return;
      }
      this.input.handleInput(data);
    }
  }
}
