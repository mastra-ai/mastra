/**
 * Ask question dialog component.
 * Shows a question with either selectable options or free-text input.
 * Used by the ask_user tool to collect structured answers from the user.
 */

import { Box, getEditorKeybindings, Input, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, SelectItem } from '@mariozechner/pi-tui';
import { theme, getSelectListTheme } from '../theme.js';

export interface AskQuestionDialogOptions {
  question: string;
  options?: Array<{ label: string; description?: string }>;
  onSubmit: (answer: string) => void;
  onCancel: () => void;
}

export class AskQuestionDialogComponent extends Box implements Focusable {
  private selectList?: SelectList;
  private input?: Input;
  private onSubmit: (answer: string) => void;
  private onCancel: () => void;

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

    this.selectList = new SelectList(items, Math.min(items.length, 8), getSelectListTheme());

    this.selectList.onSelect = (item: SelectItem) => {
      this.onSubmit(item.value);
    };
    this.selectList.onCancel = this.onCancel;

    this.addChild(this.selectList);
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', '  ↑↓ to navigate · Enter to select · Esc to skip'), 0, 0));
  }

  private buildInputMode(): void {
    this.input = new Input();
    this.input.onSubmit = (value: string) => {
      const trimmed = value.trim();
      if (trimmed) {
        this.onSubmit(trimmed);
      }
    };

    this.addChild(this.input);
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', '  Enter to submit · Esc to skip'), 0, 0));
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
