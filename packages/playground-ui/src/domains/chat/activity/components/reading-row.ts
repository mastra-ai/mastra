import type { ActivityDisclosureStore, RowAnchor } from '../model/disclosure-store';

function readingRow(viewport: HTMLElement, rows: ReadonlyMap<string, HTMLElement>): RowAnchor | undefined {
  const top = viewport.getBoundingClientRect().top;
  const first = [...rows]
    .map(([key, row]) => ({ key, box: row.getBoundingClientRect() }))
    .filter(({ box }) => box.bottom > top)
    .toSorted((a, b) => a.box.top - b.box.top)
    .at(0);
  return first && { key: first.key, offset: first.box.top - top };
}

function scrollBackTo(viewport: HTMLElement, row: HTMLElement | undefined, offset: number) {
  if (!row) return;
  viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - offset;
}

/** A ref for one row of a list, so the list can measure it. */
export function listRow(rows: Map<string, HTMLElement>, key: string) {
  return (row: HTMLElement | null) => {
    if (!row) return;
    rows.set(key, row);
    return () => {
      rows.delete(key);
    };
  };
}

/**
 * A ref for a list's viewport that keeps the reader on the row they were reading. The list mounts again when a
 * thought folds its calls into a group, when older history moves its stretch, and each time it is reopened.
 */
export function keepReadingRow(rows: ReadonlyMap<string, HTMLElement>, store: ActivityDisclosureStore) {
  return (viewport: HTMLElement | null) => {
    if (!viewport) return;
    const anchor = store.anchorOf(rows.keys());
    if (anchor) scrollBackTo(viewport, rows.get(anchor.key), anchor.offset);
    const remember = () => store.keepAnchor(rows.keys(), readingRow(viewport, rows));
    viewport.addEventListener('scroll', remember, { passive: true });
    return () => viewport.removeEventListener('scroll', remember);
  };
}
