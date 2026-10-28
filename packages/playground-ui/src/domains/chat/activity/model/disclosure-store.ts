export type DisclosureScope = 'line' | 'group' | 'row';

/** The row a list of calls was scrolled to, and how far its top sat below the list's top. */
export interface RowAnchor {
  key: string;
  offset: number;
}

/**
 * What the reader opened in each stretch, and the row each list was scrolled to. Everything is keyed by member,
 * so a stretch that mounts again (a thought folds its calls into a group, older history moves it) finds its
 * state through any member it still holds.
 */
export class ActivityDisclosureStore {
  readonly #open: Record<DisclosureScope, Set<string>> = { line: new Set(), group: new Set(), row: new Set() };
  readonly #anchors = new Map<string, RowAnchor>();
  readonly #listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  isOpen(scope: DisclosureScope, keys: readonly string[]): boolean {
    return keys.some(key => this.#open[scope].has(key));
  }

  setOpen(scope: DisclosureScope, keys: readonly string[], open: boolean): void {
    const opened = this.#open[scope];
    for (const key of keys) {
      if (open) opened.add(key);
      else opened.delete(key);
    }
    for (const listener of this.#listeners) listener();
  }

  anchorOf(keys: Iterable<string>): RowAnchor | undefined {
    for (const key of keys) {
      const anchor = this.#anchors.get(key);
      if (anchor) return anchor;
    }
    return undefined;
  }

  keepAnchor(keys: Iterable<string>, anchor: RowAnchor | undefined): void {
    for (const key of keys) {
      if (anchor) this.#anchors.set(key, anchor);
      else this.#anchors.delete(key);
    }
  }
}
