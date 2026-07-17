/**
 * Inline ask question component.
 * Shows a question with either selectable options or free-text input
 * directly in the conversation flow instead of as an overlay dialog.
 *
 * Supports three lifecycle phases:
 * 1. **Streaming** — Created early by handleToolInputStart with no args.
 *    As partial JSON arrives via handleToolInputDelta, `updateArgs()` feeds
 *    the question text and option labels into the bordered box progressively.
 * 2. **Active** — When handleAskQuestion fires, `activate()` wires up the
 *    interactive SelectList / Input and the submit/cancel callbacks.
 * 3. **Answered** — After the user responds, the box freezes with ✓/✗ icons.
 */

import {
  Container,
  getKeybindings,
  Input,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from '@earendil-works/pi-tui';
import type { Focusable, SelectItem, TUI } from '@earendil-works/pi-tui';
import { BOX_INDENT_STR, theme, getSelectListTheme, getEditorTheme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';
import { MultilineInput } from './multiline-input.js';
import { WrappingSelectList } from './wrapping-select-list.js';

/**
 * Selection mode for option prompts. `single_select` selects one option on Enter
 * (the default). `multi_select` lets the user toggle several options with Space and
 * confirm them together with Enter, returning all selected labels as an array.
 */
export type AskQuestionSelectionMode = 'single_select' | 'multi_select';

export interface AskQuestionInlineOptions {
  question: string;
  options?: Array<{ label: string; description?: string }>;
  /** Controls whether options are single- or multi-select. Defaults to single_select. */
  selectionMode?: AskQuestionSelectionMode;
  /** Format the text shown after an answer is selected. Defaults to `question → answer`. */
  formatResult?: (answer: string) => string;
  /** If provided, determines whether an answer should be shown with error styling (red ✗). */
  isNegativeAnswer?: (answer: string) => boolean;
  /** Allow submitting an empty string in free-text mode. */
  allowEmptyInput?: boolean;
  /** Show the "Custom response..." option in select mode. Defaults to true. */
  allowCustomResponse?: boolean;
  /**
   * Use a multiline editor for free-text input (Shift+Enter / \+Enter for new lines).
   * Defaults to false — most prompts ask for short answers like names, paths, or yes/no.
   * Enable for prompts that legitimately want paragraph-length replies (e.g. ask_user).
   */
  multiline?: boolean;
  onSubmit: (answer: string) => void;
  /**
   * Called instead of `onSubmit` when the prompt is multi-select, with every selected
   * option label. Falls back to `onSubmit` with a comma-joined string when omitted.
   */
  onSubmitMulti?: (answers: string[]) => void;
  onCancel: () => void;
}

/**
 * A renderable that wraps the ask-question content in a full bordered box
 * (┌─┐ / │ │ / └─┘) including the interactive SelectList or Input.
 */
class AskQuestionBorderedBox {
  questionLines: string[];
  private selectList?: WrappingSelectList;
  private input?: Input | MultilineInput;
  private hintText: string;
  items: Array<{ label: string; description?: string }>;
  private answered = false;
  private cancelled = false;
  private selectedValue?: string;
  /** Selected option labels when the box was answered in multi-select mode. */
  private selectedValues?: string[];
  private answerIsNegative = false;
  /** True when created during streaming, before activate() is called */
  private streaming = false;

  constructor(
    questionLines: string[],
    hintText: string,
    items: Array<{ label: string; description?: string }>,
    selectList?: WrappingSelectList,
    input?: Input | MultilineInput,
    streaming?: boolean,
  ) {
    this.questionLines = questionLines;
    this.hintText = hintText;
    this.items = items;
    this.selectList = selectList;
    this.input = input;
    this.streaming = streaming ?? false;
  }

  invalidate() {
    this.selectList?.invalidate();
  }

  setInteractive(selectList?: WrappingSelectList, input?: Input | MultilineInput, hintText?: string) {
    this.streaming = false;
    this.selectList = selectList;
    this.input = input;
    if (hintText) this.hintText = hintText;
  }

  setAnswered(selectedValue: string, isNegative: boolean) {
    this.streaming = false;
    this.answered = true;
    this.selectedValue = selectedValue;
    this.answerIsNegative = isNegative;
  }

  setAnsweredMulti(selectedValues: string[]) {
    this.streaming = false;
    this.answered = true;
    this.selectedValues = selectedValues;
    this.answerIsNegative = false;
  }

  setCancelled() {
    this.streaming = false;
    this.answered = true;
    this.cancelled = true;
  }

  render(width: number): string[] {
    try {
      return this._render(width);
    } catch {
      // Fallback: render a minimal box so the TUI doesn't crash
      return [
        BOX_INDENT_STR + theme.fg('dim', '╭──── Question ────╮'),
        BOX_INDENT_STR + theme.fg('dim', '│ (render error)   │'),
        BOX_INDENT_STR + theme.fg('dim', '╰──────────────────╯'),
      ];
    }
  }

  private _render(width: number): string[] {
    const border = (s: string) => theme.fg('dim', s);

    // Inner width: total width minus indent, minus 4 for "│ " + " │"
    const innerWidth = Math.max(1, width - BOX_INDENT_STR.length - 4);
    const boxWidth = innerWidth + 4; // "│ " + content + " │"

    const lines: string[] = [];

    // Top border: ╭──...──╮
    lines.push(BOX_INDENT_STR + border(`╭${'─'.repeat(boxWidth - 2)}╮`));

    // Helper to add a bordered line (truncates content that exceeds innerWidth)
    const addLine = (content: string, contentVisWidth: number) => {
      let finalContent = content;
      let finalWidth = contentVisWidth;
      if (finalWidth > innerWidth) {
        finalContent = truncateToWidth(content, innerWidth);
        finalWidth = visibleWidth(finalContent);
      }
      const pad = Math.max(0, innerWidth - finalWidth);
      lines.push(BOX_INDENT_STR + border('│') + ' ' + finalContent + ' '.repeat(pad) + ' ' + border('│'));
    };

    // Question header
    const header = theme.bold(theme.fg('accent', 'Question'));
    addLine(header, visibleWidth(header));

    // Question text (word-wrap to fit inside bordered box)
    for (const qLine of this.questionLines) {
      const wrapped = wrapTextWithAnsi(qLine, innerWidth);
      for (const wLine of wrapped) {
        const text = theme.fg('text', wLine);
        addLine(text, visibleWidth(wLine));
      }
    }

    // Empty separator
    addLine('', 0);

    // Wrap a labelled option line so long labels don't overflow the bordered box.
    // Mirrors the free-text answered branch below: first wrapped line keeps the
    // styled prefix (icon/spaces), continuation lines indent 3 spaces.
    const continuationPrefix = '   ';
    const addWrappedOptionLine = (prefix: string, label: string, style: (s: string) => string) => {
      const prefixVis = visibleWidth(prefix);
      const wrapped = wrapTextWithAnsi(label, Math.max(1, innerWidth - prefixVis));
      wrapped.forEach((line, index) => {
        const linePrefix = index === 0 ? prefix : continuationPrefix;
        const content = `${linePrefix}${style(line)}`;
        addLine(content, visibleWidth(linePrefix) + visibleWidth(line));
      });
    };

    if (this.streaming) {
      // Streaming: show option labels as they arrive (dimmed, no interactivity)
      const dim = (s: string) => theme.fg('dim', s);
      for (const item of this.items) {
        addWrappedOptionLine(continuationPrefix, item.label, dim);
      }
      // Waiting indicator
      const waiting = theme.fg('dim', '…');
      addLine(waiting, visibleWidth(waiting));
    } else if (this.answered && this.items.length > 0) {
      // Render frozen item list
      const dim = (s: string) => theme.fg('dim', s);
      if (this.cancelled) {
        // All items dimmed, cancelled notice
        for (const item of this.items) {
          addWrappedOptionLine(continuationPrefix, item.label, dim);
        }
        const cancelLine = `${theme.fg('error', '✗')}  ${theme.fg('dim', '(cancelled)')}`;
        addLine(cancelLine, visibleWidth(cancelLine));
      } else {
        // ✓/✗ on selected, dimmed unselected
        const text = (s: string) => theme.fg('text', s);
        for (const item of this.items) {
          const isSelected = this.selectedValues
            ? this.selectedValues.includes(item.label)
            : item.label === this.selectedValue;
          if (isSelected) {
            const icon = this.answerIsNegative ? theme.fg('error', '✗') : theme.fg('success', '✓');
            addWrappedOptionLine(`${icon}  `, item.label, text);
          } else {
            addWrappedOptionLine(continuationPrefix, item.label, dim);
          }
        }
      }
      addLine('', 0);
    } else if (this.answered && this.selectedValue != null) {
      // Free-text input answered
      const icon = this.answerIsNegative ? theme.fg('error', '✗') : theme.fg('success', '✓');
      const iconPrefix = `${icon}  `;
      const continuationPrefix = '   ';
      const wrappedAnswer = wrapTextWithAnsi(this.selectedValue!, Math.max(1, innerWidth - visibleWidth(iconPrefix)));

      wrappedAnswer.forEach((line, index) => {
        const prefix = index === 0 ? iconPrefix : continuationPrefix;
        const content = `${prefix}${theme.fg('text', line)}`;
        addLine(content, visibleWidth(prefix) + visibleWidth(line));
      });
    } else if (this.answered && this.cancelled) {
      // Free-text cancelled
      const cancelLine = `${theme.fg('error', '✗')}  ${theme.fg('dim', '(cancelled)')}`;
      addLine(cancelLine, visibleWidth(cancelLine));
    } else {
      // Interactive content (SelectList or Input)
      if (this.selectList) {
        // SelectList renders its own lines — wrap each one with borders
        const selectLines = this.selectList.render(innerWidth);
        for (const sLine of selectLines) {
          addLine(sLine, visibleWidth(sLine));
        }
      } else if (this.input) {
        const inputLines = this.input.render(innerWidth);
        for (const iLine of inputLines) {
          addLine(iLine, visibleWidth(iLine));
        }
      }

      // Hint text
      const hint = theme.fg('dim', this.hintText);
      addLine(hint, visibleWidth(hint));
    }

    // Bottom border: ╰──...──╯
    lines.push(BOX_INDENT_STR + border(`╰${'─'.repeat(boxWidth - 2)}╯`));

    return lines;
  }
}

export class AskQuestionInlineComponent extends Container implements Focusable {
  private borderedBox: AskQuestionBorderedBox;
  private selectList?: WrappingSelectList;
  private input?: Input | MultilineInput;
  private tui?: TUI;
  private onSubmit?: (answer: string) => void;
  private onSubmitMulti?: (answers: string[]) => void;
  private onCancel?: () => void;
  private isNegativeAnswer?: (answer: string) => boolean;
  private allowEmptyInput = false;
  private multiline = false;
  private allowCustomResponse = true;
  private multiSelect = false;
  private answered = false;

  /**
   * Create a pre-answered instance for rendering from chat history.
   * No interactive elements — just shows the question and the answer in the bordered box.
   */
  static fromHistory(
    question: string,
    options: Array<{ label: string; description?: string }> | undefined,
    answer: string,
    cancelled: boolean,
  ): AskQuestionInlineComponent {
    const component = AskQuestionInlineComponent.createStreaming();
    component.updateArgs({ question, options });
    component.answered = true;
    if (cancelled) {
      component.borderedBox.setCancelled();
    } else {
      component.borderedBox.setAnswered(answer, false);
    }
    return component;
  }

  /**
   * Create a streaming instance for early rendering during tool input streaming.
   * Shows the bordered box with "…" indicator. Call updateArgs() as partial JSON
   * arrives, then activate() when the question event fires.
   */
  static createStreaming(tui?: TUI): AskQuestionInlineComponent {
    const component = new AskQuestionInlineComponent();
    component.tui = tui;
    return component;
  }

  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    if (!this.answered && this.input) {
      this.input.focused = value;
    }
  }

  render(width: number): string[] {
    try {
      return super.render(width);
    } catch {
      return [
        BOX_INDENT_STR + theme.fg('dim', '╭──── Question ────╮'),
        BOX_INDENT_STR + theme.fg('dim', '│ (render error)   │'),
        BOX_INDENT_STR + theme.fg('dim', '╰──────────────────╯'),
      ];
    }
  }

  /**
   * Private constructor — use static factories or the options constructor.
   */
  constructor(options?: AskQuestionInlineOptions, _ui?: TUI) {
    super();

    this.tui = _ui;

    if (options) {
      // Full construction with interactive elements
      this.onSubmit = options.onSubmit;
      this.onSubmitMulti = options.onSubmitMulti;
      this.onCancel = options.onCancel;
      this.isNegativeAnswer = options.isNegativeAnswer;
      this.allowEmptyInput = Boolean(options.allowEmptyInput);
      this.multiline = Boolean(options.multiline);
      this.allowCustomResponse = options.allowCustomResponse ?? true;
      this.multiSelect = options.selectionMode === 'multi_select';

      const questionLines = options.question.split('\n');

      let hintText: string;
      if (options.options && options.options.length > 0) {
        hintText = this.selectHintText();
        this.buildSelectMode(options.options);
      } else {
        hintText = this.useMultiline()
          ? 'Enter to submit · Shift+Enter/\\+Enter for new line · Esc to skip'
          : 'Enter to submit · Esc to skip';
        this.buildInputMode();
      }

      this.borderedBox = new AskQuestionBorderedBox(
        questionLines,
        hintText,
        options.options || [],
        this.selectList,
        this.input,
      );
    } else {
      // Streaming mode — empty bordered box, will be populated by updateArgs()
      this.borderedBox = new AskQuestionBorderedBox([], '', [], undefined, undefined, true);
    }

    this.addChild(this.borderedBox as any);
  }

  /**
   * Update the question text and options from streaming partial args.
   * Called during tool input delta streaming.
   */
  updateArgs(args: unknown): void {
    if (this.answered) return;
    if (!args || typeof args !== 'object') return;
    const a = args as Record<string, unknown>;
    if (typeof a.question === 'string') {
      this.borderedBox.questionLines = a.question.split('\n');
    }
    if (Array.isArray(a.options)) {
      this.borderedBox.items = a.options.filter(
        (o: unknown): o is { label: string; description?: string } =>
          typeof o === 'object' && o !== null && typeof (o as any).label === 'string',
      );
    }
  }

  /**
   * Activate the interactive elements (SelectList or Input) and wire up callbacks.
   * Called by handleAskQuestion when the question event fires after streaming.
   */
  activate(options: {
    question: string;
    options?: Array<{ label: string; description?: string }>;
    selectionMode?: AskQuestionSelectionMode;
    isNegativeAnswer?: (answer: string) => boolean;
    allowEmptyInput?: boolean;
    allowCustomResponse?: boolean;
    multiline?: boolean;
    tui?: TUI;
    onSubmit: (answer: string) => void;
    onSubmitMulti?: (answers: string[]) => void;
    onCancel: () => void;
  }): void {
    if (this.answered) return;
    if (options.tui) this.tui = options.tui;
    this.onSubmit = options.onSubmit;
    this.onSubmitMulti = options.onSubmitMulti;
    this.onCancel = options.onCancel;
    this.isNegativeAnswer = options.isNegativeAnswer;
    this.allowEmptyInput = Boolean(options.allowEmptyInput);
    this.allowCustomResponse = options.allowCustomResponse ?? true;
    this.multiline = Boolean(options.multiline);
    this.multiSelect = options.selectionMode === 'multi_select';

    // Update question text and items to final values
    this.borderedBox.questionLines = options.question.split('\n');
    this.borderedBox.items = options.options || [];

    // Build interactive elements
    let hintText: string;
    if (options.options && options.options.length > 0) {
      hintText = this.selectHintText();
      this.buildSelectMode(options.options);
    } else {
      hintText = this.useMultiline()
        ? 'Enter to submit · Shift+Enter/\\+Enter for new line · Esc to skip'
        : 'Enter to submit · Esc to skip';
      this.buildInputMode();
    }

    // Switch bordered box out of streaming mode
    this.borderedBox.setInteractive(this.selectList, this.input, hintText);
  }

  private static readonly CUSTOM_RESPONSE_VALUE = '__custom_response__';

  /** Hint line shown under an option list, tailored to single- vs multi-select. */
  private selectHintText(): string {
    return this.multiSelect
      ? 'Space to toggle · Enter to confirm · Esc to skip'
      : '↑↓ to navigate · Enter to select · Esc to skip';
  }

  private buildSelectMode(opts: Array<{ label: string; description?: string }>): void {
    const items: SelectItem[] = opts.map(opt => ({
      value: opt.label,
      label: opt.description ? `${opt.label}  ${theme.fg('dim', opt.description)}` : opt.label,
    }));

    // "Custom response..." only applies to single-select: it switches to free-text.
    // Multi-select toggles a fixed option set, so the escape hatch doesn't apply.
    if (this.allowCustomResponse && !this.multiSelect) {
      items.push({
        value: AskQuestionInlineComponent.CUSTOM_RESPONSE_VALUE,
        label: theme.fg('dim', '✎ Custom response...'),
      });
    }

    this.selectList = new WrappingSelectList(items, Math.min(items.length, 8), getSelectListTheme(), this.multiSelect);

    if (this.multiSelect) {
      this.selectList.onConfirmMulti = (selected: SelectItem[]) => {
        this.handleMultiAnswer(selected.map(item => item.value));
      };
    } else {
      this.selectList.onSelect = (item: SelectItem) => {
        if (item.value === AskQuestionInlineComponent.CUSTOM_RESPONSE_VALUE) {
          this.switchToCustomInput();
          return;
        }
        this.handleAnswer(item.value);
      };
    }
    this.selectList.onCancel = () => {
      this.handleCancel();
    };
  }

  private switchToCustomInput(): void {
    // Tear down the select list and switch to free-text input
    this.selectList = undefined;
    this.buildInputMode();

    // Clear items so the answered state renders as free-text, not select
    this.borderedBox.items = [];
    this.borderedBox.setInteractive(
      undefined,
      this.input,
      this.useMultiline()
        ? 'Enter to submit · Shift+Enter/\\+Enter for new line · Esc to skip'
        : 'Enter to submit · Esc to skip',
    );
  }

  /** Whether this prompt should render a multiline editor (vs a single-line input). */
  private useMultiline(): boolean {
    return this.multiline && Boolean(this.tui);
  }

  private buildInputMode(): void {
    if (this.useMultiline()) {
      // Multiline editor — opted in by callers that expect paragraph-length answers.
      const multilineInput = new MultilineInput(this.tui!, getEditorTheme());
      multilineInput.allowEmptySubmit = this.allowEmptyInput;
      multilineInput.onSubmit = (value: string) => {
        // Trim only for the emptiness decision; forward the raw value
        // so leading indentation / trailing newlines survive.
        if (value.trim() || this.allowEmptyInput) {
          this.handleAnswer(value);
        }
      };
      multilineInput.onEscape = () => {
        this.handleCancel();
      };
      this.input = multilineInput;
    } else {
      // Single-line input — the right default for short answers (paths, names, yes/no).
      this.input = new Input();
      this.input.onSubmit = (value: string) => {
        const trimmed = value.trim();
        if (trimmed || this.allowEmptyInput) {
          this.handleAnswer(trimmed);
        }
      };
      (this.input as any).keybindings = getKeybindings();
    }

    // Carry focus over so callers (constructor, activate, switchToCustomInput)
    // don't have to reapply it manually after rebuilding the input.
    this.input.focused = this._focused;
  }

  answer(answer: string, isNegative = false): void {
    if (this.answered) return;
    this.answered = true;

    this.borderedBox.setAnswered(answer, isNegative);
  }

  private handleAnswer(answer: string): void {
    if (this.answered) return;
    const isNegative = this.isNegativeAnswer?.(answer) ?? false;
    this.answer(answer, isNegative);

    this.onSubmit?.(answer);
  }

  private handleMultiAnswer(answers: string[]): void {
    if (this.answered) return;
    this.answered = true;
    this.borderedBox.setAnsweredMulti(answers);

    // Prefer the array-shaped callback; fall back to a comma-joined string so
    // single-select-only callers still receive a usable answer.
    if (this.onSubmitMulti) {
      this.onSubmitMulti(answers);
    } else {
      this.onSubmit?.(answers.join(', '));
    }
  }

  private handleCancel(): void {
    if (this.answered) return;
    this.answered = true;

    this.borderedBox.setCancelled();

    this.onCancel?.();
  }

  /**
   * Retract the question without invoking any submit/cancel callback. Used when
   * the underlying tool suspension was cancelled (the suspended run died, e.g.
   * its snapshot failed to persist), so an answer could never be delivered.
   */
  dismiss(): void {
    if (this.answered) return;
    this.answered = true;
    this.focused = false;

    this.borderedBox.setCancelled();
  }

  handleInput(data: string): void {
    if (this.answered) return;

    if (this.selectList) {
      this.selectList.handleInput(data);
    } else if (this.input) {
      const kb = getKeybindings();
      if (kb.matches(data, 'tui.select.cancel')) {
        this.handleCancel();
        return;
      }
      this.input.handleInput(data);
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
  }
}
