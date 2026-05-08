/**
 * MultilineInput - wraps pi-tui's Editor to provide multiline text input
 * with the same interface as the single-line Input component.
 *
 * Supports:
 * - Enter to submit
 * - Shift+Enter for new line
 * - \\+Enter for new line (pi-tui convention)
 * - Text wrapping and scrolling
 */

import { Editor, matchesKey } from '@mariozechner/pi-tui';
import type { EditorTheme, TUI } from '@mariozechner/pi-tui';

const ANSI_STRIP_RE = /\x1b\[[0-9;]*m/g;

export class MultilineInput {
  private editor: Editor;
  private _focused = false;
  public onSubmit?: (value: string) => void;
  public onEscape?: () => void;
  public allowEmptySubmit = false;

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
  }

  constructor(tui: TUI, editorTheme: EditorTheme) {
    this.editor = new Editor(tui, editorTheme);
  }

  getText(): string {
    return this.editor.getText();
  }

  setText(text: string): void {
    this.editor.setText(text);
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'escape')) {
      this.onEscape?.();
      return;
    }

    if (matchesKey(data, 'enter')) {
      // Check if cursor is preceded by backslash (\+Enter newline workaround)
      const lines = (this.editor as any).state?.lines;
      const cursorCol = (this.editor as any).state?.cursorCol;
      const currentLine = lines?.[(this.editor as any).state?.cursorLine] || '';
      if (cursorCol > 0 && currentLine[cursorCol - 1] === '\\') {
        this.editor.handleInput(data);
        return;
      }

      // Submit on plain Enter. Use trim() only to decide emptiness;
      // forward the raw buffer so leading indentation and trailing
      // newlines reach the caller intact.
      const rawText = this.editor.getText();
      if (rawText.trim() || this.allowEmptySubmit) {
        this.onSubmit?.(rawText);
      }
      return;
    }

    // Shift+Enter inserts a newline
    if (matchesKey(data, 'shift+enter')) {
      this.editor.handleInput('\n');
      return;
    }

    this.editor.handleInput(data);
  }

  invalidate(): void {
    this.editor.invalidate();
  }

  /**
   * Render the editor content, stripping the Editor's own border chrome
   * so it can be embedded inside an existing bordered box.
   */
  render(width: number): string[] {
    const editorLines = this.editor.render(width);

    // The Editor wraps lines with its own borders: ─── top/bottom, │ sides
    // We strip these to embed content in the ask-question bordered box.
    const contentLines: string[] = [];
    let pastFirstBorder = false;

    for (const line of editorLines) {
      const stripped = line.replace(ANSI_STRIP_RE, '');

      // Skip horizontal rule border lines (───)
      if (stripped.length > 0 && /^─+$/.test(stripped)) {
        if (!pastFirstBorder) {
          pastFirstBorder = true;
        }
        continue;
      }

      // Skip dedicated scroll-indicator chrome (e.g. "── ↑ ──").
      // Match only full-line indicator format so user content with
      // arrow characters in it is preserved.
      if (/^─+\s*[↑↓]\s*─+$/.test(stripped.trim())) {
        continue;
      }

      if (pastFirstBorder) {
        contentLines.push(line);
      }
    }

    // If no content lines, return at least one empty line for the cursor
    if (contentLines.length === 0) {
      contentLines.push('');
    }

    return contentLines;
  }
}
