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
  getEditorKeybindings,
  Input,
  SelectList,
  Spacer,
  visibleWidth,
  wrapTextWithAnsi,
} from '@mariozechner/pi-tui';
import type { Focusable, SelectItem, TUI } from '@mariozechner/pi-tui';
import { BOX_INDENT_STR, theme, getSelectListTheme } from '../theme.js';

export interface AskQuestionInlineOptions {
  question: string;
  options?: Array<{ label: string; description?: string }>;
  /** Format the text shown after an answer is selected. Defaults to `question → answer`. */
  formatResult?: (answer: string) => string;
  /** If provided, determines whether an answer should be shown with error styling (red ✗). */
  isNegativeAnswer?: (answer: string) => boolean;
  /** Allow submitting an empty string in free-text mode. */
  allowEmptyInput?: boolean;
  onSubmit: (answer: string) => void;
  onCancel: () => void;
}

/**
 * A renderable that wraps the ask-question content in a full bordered box
 * (┌─┐ / │ │ / └─┘) including the interactive SelectList or Input.
 */
class AskQuestionBorderedBox {
  questionLines: string[];
  private selectList?: SelectList;
  private input?: Input;
  private hintText: string;
  items: Array<{ label: string; description?: string }>;
  private answered = false;
  private cancelled = false;
  private selectedValue?: string;
  private answerIsNegative = false;
  /** True when created during streaming, before activate() is called */
  private streaming = false;

  constructor(
    questionLines: string[],
    hintText: string,
    items: Array<{ label: string; description?: string }>,
    selectList?: SelectList,
    input?: Input,
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

  setInteractive(selectList?: SelectList, input?: Input, hintText?: string) {
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

    // Helper to add a bordered line
    const addLine = (content: string, contentVisWidth: number) => {
      const pad = Math.max(0, innerWidth - contentVisWidth);
      lines.push(BOX_INDENT_STR + border('│') + ' ' + content + ' '.repeat(pad) + ' ' + border('│'));
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

    if (this.streaming) {
      // Streaming: show option labels as they arrive (dimmed, no interactivity)
      for (const item of this.items) {
        const line = theme.fg('dim', `   ${item.label}`);
        addLine(line, visibleWidth(line));
      }
      // Waiting indicator
      const waiting = theme.fg('dim', '…');
      addLine(waiting, visibleWidth(waiting));
    } else if (this.answered && this.items.length > 0) {
      // Render frozen item list
      if (this.cancelled) {
        // All items dimmed, cancelled notice
        for (const item of this.items) {
          const line = theme.fg('dim', `   ${item.label}`);
          addLine(line, visibleWidth(line));
        }
        const cancelLine = `${theme.fg('error', '✗')}  ${theme.fg('dim', '(cancelled)')}`;
        addLine(cancelLine, visibleWidth(cancelLine));
      } else {
        // ✓/✗ on selected, dimmed unselected
        for (const item of this.items) {
          const isSelected = item.label === this.selectedValue;
          if (isSelected) {
            const icon = this.answerIsNegative ? theme.fg('error', '✗') : theme.fg('success', '✓');
            const label = theme.fg('text', item.label);
            const line = `${icon}  ${label}`;
            addLine(line, visibleWidth(line));
          } else {
            const line = theme.fg('dim', `   ${item.label}`);
            addLine(line, visibleWidth(line));
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
  private selectList?: SelectList;
  private input?: Input;
  private onSubmit?: (answer: string) => void;
  private onCancel?: () => void;
  private isNegativeAnswer?: (answer: string) => boolean;
  private allowEmptyInput = false;
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
  static createStreaming(): AskQuestionInlineComponent {
    const component = new AskQuestionInlineComponent();
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

    if (options) {
      // Full construction with interactive elements
      this.onSubmit = options.onSubmit;
      this.onCancel = options.onCancel;
      this.isNegativeAnswer = options.isNegativeAnswer;
      this.allowEmptyInput = Boolean(options.allowEmptyInput);

      const questionLines = options.question.split('\n');

      let hintText: string;
      if (options.options && options.options.length > 0) {
        hintText = '↑↓ to navigate · Enter to select · Esc to skip';
        this.buildSelectMode(options.options);
      } else {
        hintText = 'Enter to submit · Esc to skip';
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
    this.addChild(new Spacer(1));
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
    isNegativeAnswer?: (answer: string) => boolean;
    allowEmptyInput?: boolean;
    onSubmit: (answer: string) => void;
    onCancel: () => void;
  }): void {
    if (this.answered) return;
    this.onSubmit = options.onSubmit;
    this.onCancel = options.onCancel;
    this.isNegativeAnswer = options.isNegativeAnswer;
    this.allowEmptyInput = Boolean(options.allowEmptyInput);

    // Update question text and items to final values
    this.borderedBox.questionLines = options.question.split('\n');
    this.borderedBox.items = options.options || [];

    // Build interactive elements
    let hintText: string;
    if (options.options && options.options.length > 0) {
      hintText = '↑↓ to navigate · Enter to select · Esc to skip';
      this.buildSelectMode(options.options);
    } else {
      hintText = 'Enter to submit · Esc to skip';
      this.buildInputMode();
    }

    // Switch bordered box out of streaming mode
    this.borderedBox.setInteractive(this.selectList, this.input, hintText);
  }

  private static readonly CUSTOM_RESPONSE_VALUE = '__custom_response__';

  private buildSelectMode(opts: Array<{ label: string; description?: string }>): void {
    const items: SelectItem[] = opts.map(opt => ({
      value: opt.label,
      label: opt.description ? `  ${opt.label}  ${theme.fg('dim', opt.description)}` : `  ${opt.label}`,
    }));

    // Append a "Custom response..." option so the user can type a free-text answer
    items.push({
      value: AskQuestionInlineComponent.CUSTOM_RESPONSE_VALUE,
      label: `  ${theme.fg('dim', '✎ Custom response...')}`,
    });

    this.selectList = new SelectList(items, Math.min(items.length, 8), getSelectListTheme());

    this.selectList.onSelect = (item: SelectItem) => {
      if (item.value === AskQuestionInlineComponent.CUSTOM_RESPONSE_VALUE) {
        this.switchToCustomInput();
        return;
      }
      this.handleAnswer(item.value);
    };
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
    this.borderedBox.setInteractive(undefined, this.input, 'Enter to submit · Esc to skip');
  }

  private buildInputMode(): void {
    this.input = new Input();
    this.input.onSubmit = (value: string) => {
      const trimmed = value.trim();
      if (trimmed || this.allowEmptyInput) {
        this.handleAnswer(trimmed);
      }
    };
    (this.input as any).keybindings = getEditorKeybindings();
  }

  private handleAnswer(answer: string): void {
    if (this.answered) return;
    this.answered = true;

    const isNegative = this.isNegativeAnswer?.(answer) ?? false;

    this.borderedBox.setAnswered(answer, isNegative);

    this.onSubmit?.(answer);
  }

  private handleCancel(): void {
    if (this.answered) return;
    this.answered = true;

    this.borderedBox.setCancelled();

    this.onCancel?.();
  }

  handleInput(data: string): void {
    if (this.answered) return;

    if (this.selectList) {
      this.selectList.handleInput(data);
    } else if (this.input) {
      const kb = getEditorKeybindings();
      if (kb.matches(data, 'selectCancel')) {
        this.handleCancel();
        return;
      }
      this.input.handleInput(data);
    }
  }
}
