import { getKeybindings, visibleWidth } from '@mariozechner/pi-tui';
import type { Component, SelectItem, SelectListTheme } from '@mariozechner/pi-tui';

/**
 * Multi-select counterpart to pi-tui's `SelectList`. Cursor and rendering rules
 * match `SelectList` so the two feel consistent; the difference is that Space
 * toggles a checkbox per item and Enter submits the set of toggled values as
 * `string[]` instead of selecting the cursor row.
 *
 * Used by `AskQuestionInlineComponent` and `AskQuestionDialogComponent` when
 * the underlying ask_question event arrives with `selectionMode: 'multi_select'`.
 */
export class MultiSelectList implements Component {
  private items: SelectItem[];
  private selectedIndex = 0;
  private maxVisible: number;
  private theme: SelectListTheme;
  private toggled = new Set<string>();

  /** Fires when the user submits with Enter. Receives the values selected, in items order. */
  onSubmit?: (values: string[]) => void;
  /** Fires when the user cancels with Esc / Ctrl+C. */
  onCancel?: () => void;

  constructor(items: SelectItem[], maxVisible: number, theme: SelectListTheme) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
  }

  invalidate(): void {
    // No cached state to invalidate.
  }

  /** Pre-toggle a set of values (e.g. from streaming defaults). */
  setToggled(values: Iterable<string>): void {
    this.toggled = new Set(values);
  }

  /** Snapshot of currently-toggled values, ordered to match `items`. */
  getToggled(): string[] {
    return this.items.filter(item => this.toggled.has(item.value)).map(item => item.value);
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    if (kb.matches(keyData, 'tui.select.up')) {
      this.selectedIndex = this.selectedIndex === 0 ? this.items.length - 1 : this.selectedIndex - 1;
      return;
    }
    if (kb.matches(keyData, 'tui.select.down')) {
      this.selectedIndex = this.selectedIndex === this.items.length - 1 ? 0 : this.selectedIndex + 1;
      return;
    }
    if (keyData === ' ') {
      const item = this.items[this.selectedIndex];
      if (item) {
        if (this.toggled.has(item.value)) {
          this.toggled.delete(item.value);
        } else {
          this.toggled.add(item.value);
        }
      }
      return;
    }
    if (kb.matches(keyData, 'tui.select.confirm')) {
      this.onSubmit?.(this.getToggled());
      return;
    }
    if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];
    if (this.items.length === 0) {
      lines.push(this.theme.noMatch('  No options'));
      return lines;
    }

    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.items.length - this.maxVisible),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.items.length);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      if (!item) continue;
      const isCursor = i === this.selectedIndex;
      const isToggled = this.toggled.has(item.value);
      const cursor = isCursor ? '→ ' : '  ';
      const checkbox = isToggled ? '[x] ' : '[ ] ';
      const label = item.label;
      const styled = isCursor
        ? this.theme.selectedText(`${cursor}${checkbox}${label}`)
        : `${cursor}${checkbox}${label}`;
      const truncated = visibleWidth(styled) > width ? styled.slice(0, Math.max(0, width)) : styled;
      lines.push(truncated);
    }

    if (startIndex > 0 || endIndex < this.items.length) {
      const scroll = `  (${this.selectedIndex + 1}/${this.items.length})`;
      lines.push(this.theme.scrollInfo(scroll));
    }

    return lines;
  }
}
