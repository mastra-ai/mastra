/**
 * Which rows of a scrolled list are visible. The window stays still while the cursor moves and only
 * scrolls once the cursor reaches its top or bottom edge, like most pickers (pi-tui centers the
 * selection instead, which moves every row under a fixed cursor).
 */
export class ListWindow {
  private start = 0;
  private limit = Number.POSITIVE_INFINITY;
  private shown = 0;

  /** Items drawn by the last `range` call. */
  get shownItems(): number {
    return this.shown;
  }

  /** Shows at most `items` items however many the list asks for (a short terminal); undefined lifts it. */
  setLimit(items: number | undefined): void {
    this.limit = items ?? Number.POSITIVE_INFINITY;
  }

  range(selected: number, total: number, wanted: number): { startIndex: number; endIndex: number } {
    const visible = Math.min(wanted, this.limit);
    if (selected < this.start) this.start = selected;
    else if (selected >= this.start + visible) this.start = selected - visible + 1;
    this.start = Math.max(0, Math.min(this.start, total - visible));
    const endIndex = Math.min(this.start + visible, total);
    this.shown = Math.max(0, endIndex - this.start);
    return { startIndex: this.start, endIndex };
  }
}
