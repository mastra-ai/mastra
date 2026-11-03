/**
 * Which rows of a scrolled list are visible. The window stays still while the cursor moves and only
 * scrolls once the cursor reaches its top or bottom edge, like most pickers (pi-tui centers the
 * selection instead, which moves every row under a fixed cursor).
 */
export class ListWindow {
  private start = 0;

  range(selected: number, total: number, visible: number): { startIndex: number; endIndex: number } {
    if (selected < this.start) this.start = selected;
    else if (selected >= this.start + visible) this.start = selected - visible + 1;
    this.start = Math.max(0, Math.min(this.start, total - visible));
    return { startIndex: this.start, endIndex: Math.min(this.start + visible, total) };
  }
}
