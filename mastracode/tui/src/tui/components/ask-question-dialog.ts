/**
 * Ask question dialog component.
 * Shows a question with either selectable options or free-text input.
 * Used by the ask_user tool to collect structured answers from the user.
 */

import { Container, getKeybindings, Spacer, Text } from '@earendil-works/pi-tui';
import type { Focusable, SelectItem, Component, TUI, Input } from '@earendil-works/pi-tui';
import { theme, getSelectListTheme, getEditorTheme } from '../theme.js';
import type { AskQuestionSelectionMode } from './ask-question-inline.js';
import type { MenuChrome, MenuHint } from './menu-chrome.js';
import { MenuList } from './menu-list.js';
import { MultilineInput } from './multiline-input.js';
import { TextInput } from './text-input.js';
import { WrappingSelectList } from './wrapping-select-list.js';

export interface AskQuestionDialogOptions {
  question: string;
  /** Dialog heading. Defaults to "Question". */
  title?: string;
  options?: Array<{ label: string; description?: string }>;
  /** Controls whether options are single- or multi-select. Defaults to single_select. */
  selectionMode?: AskQuestionSelectionMode;
  /**
   * Use a multiline editor for free-text input (Shift+Enter / \+Enter for new lines).
   * Defaults to false. Enable for prompts that legitimately want paragraph-length replies.
   */
  multiline?: boolean;
  allowEmptyInput?: boolean;
  defaultValue?: string;
  allowCustomResponse?: boolean;
  selectedOptionLabel?: string;
  tui?: TUI;
  onSubmit: (answer: string) => void;
  /**
   * Called instead of `onSubmit` when the prompt is multi-select, with every selected
   * option label. Falls back to `onSubmit` with a comma-joined string when omitted.
   */
  onSubmitMulti?: (answers: string[]) => void;
  onCancel: () => void;
}

export class AskQuestionDialogComponent extends Container implements Focusable, MenuChrome {
  private static readonly CUSTOM_RESPONSE_VALUE = '__custom_response__';

  private selectList?: MenuList | WrappingSelectList;
  private readonly title: string;
  private input?: Input | MultilineInput;
  private tui?: TUI;
  private multiline = false;
  private multiSelect = false;
  private allowEmptyInput = false;
  private defaultValue?: string;
  private allowCustomResponse = true;
  private selectedOptionLabel?: string;
  private onSubmit: (answer: string) => void;
  private onSubmitMulti?: (answers: string[]) => void;
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
    super();

    this.onSubmit = options.onSubmit;
    this.onSubmitMulti = options.onSubmitMulti;
    this.onCancel = options.onCancel;
    this.tui = options.tui;
    this.multiline = Boolean(options.multiline);
    this.multiSelect = options.selectionMode === 'multi_select';
    this.allowEmptyInput = Boolean(options.allowEmptyInput);
    this.defaultValue = options.defaultValue;
    this.allowCustomResponse = options.allowCustomResponse ?? true;
    this.selectedOptionLabel = options.selectedOptionLabel;

    // A short one-line question is the menu's title (its search placeholder); otherwise the title is
    // shown there and the question above the options.
    const shortQuestion = !options.title && !options.question.includes('\n') && options.question.length <= 70;
    this.title = shortQuestion ? options.question.replace(/[:?]$/, '') : (options.title ?? 'Question');
    if (!shortQuestion) {
      for (const line of options.question.split('\n')) {
        this.addChild(new Text(theme.fg('text', line), 0, 0));
      }
      this.addChild(new Spacer(1));
    }

    if (options.options && options.options.length > 0) {
      this.buildSelectMode(options.options);
    } else {
      this.buildInputMode();
    }
  }

  private buildSelectMode(opts: Array<{ label: string; description?: string }>): void {
    const items: SelectItem[] = opts.map(opt => ({ value: opt.label, label: opt.label, description: opt.description }));

    // "Custom response..." only applies to single-select: it switches to free-text.
    if (this.allowCustomResponse && !this.multiSelect) {
      items.push({
        value: AskQuestionDialogComponent.CUSTOM_RESPONSE_VALUE,
        label: theme.fg('dim', '✎ Custom response...'),
      });
    }

    if (this.multiSelect) {
      // The multi-select list has no description column, so descriptions follow the label.
      const multiItems = items.map(item => ({
        ...item,
        label: item.description ? `${item.label}  ${theme.fg('dim', item.description)}` : item.label,
      }));
      const list = new WrappingSelectList(multiItems, Math.min(items.length, 8), getSelectListTheme(), true);
      list.onConfirmMulti = (selected: SelectItem[]) => {
        const values = selected.map(item => item.value);
        if (this.onSubmitMulti) {
          this.onSubmitMulti(values);
        } else {
          this.onSubmit(values.join(', '));
        }
      };
      list.onCancel = this.onCancel;
      this.selectList = list;
    } else {
      const list = new MenuList(items, Math.min(items.length, 8));
      const selectedIndex = items.findIndex(item => item.value === this.selectedOptionLabel);
      if (selectedIndex >= 0) list.setSelectedIndex(selectedIndex);
      list.onSelect = (item: SelectItem) => {
        if (item.value === AskQuestionDialogComponent.CUSTOM_RESPONSE_VALUE) {
          this.switchToCustomInput();
          return;
        }
        this.onSubmit(item.value);
      };
      list.onCancel = this.onCancel;
      this.selectList = list;
    }

    const selectChild = this.selectList as Component;
    this.addChild(selectChild);
    this.modeChildren = [selectChild];
  }

  /** Backspace never skips the question (Esc does). */
  readonly menuKeepsBackspace = true;

  menuTitle(): string {
    return this.title;
  }

  menuHints(): readonly MenuHint[] {
    if (this.selectList instanceof WrappingSelectList) return [{ key: 'space', label: 'toggle' }];
    if (this.input && this.useMultiline()) return [{ key: 'shift+enter', label: 'new line' }];
    return [];
  }

  /** Whether this prompt should render a multiline editor (vs a single-line input). */
  private useMultiline(): boolean {
    return this.multiline && Boolean(this.tui);
  }

  private buildInputMode(): void {
    if (this.useMultiline()) {
      const multilineInput = new MultilineInput(this.tui!, getEditorTheme());
      multilineInput.allowEmptySubmit = this.allowEmptyInput;
      multilineInput.onSubmit = (value: string) => {
        // Trim only for the emptiness decision; forward the raw value
        // so leading indentation / trailing newlines survive.
        if (value.trim() || this.allowEmptyInput) {
          this.onSubmit(value);
        }
      };
      multilineInput.onEscape = () => {
        this.onCancel();
      };
      this.input = multilineInput;
    } else {
      this.input = new TextInput();
      this.input.onSubmit = (value: string) => {
        const trimmed = value.trim();
        if (trimmed || this.allowEmptyInput) {
          this.onSubmit(trimmed);
        }
      };
    }

    this.addChild(this.input);
    this.modeChildren = [this.input];

    if (this.defaultValue) {
      (this.input as Input).setValue?.(this.defaultValue);
    }

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
      const kb = getKeybindings();
      if (kb.matches(data, 'tui.select.cancel')) {
        this.onCancel();
        return;
      }
      this.input.handleInput(data);
    }
  }
}
