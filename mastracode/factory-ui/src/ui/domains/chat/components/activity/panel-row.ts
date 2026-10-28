import type { PanelView, RowAnchor } from './activity-view';

function rowsOf(viewport: HTMLElement): HTMLElement[] {
  return Array.from(viewport.querySelectorAll<HTMLElement>('[data-activity-key]'));
}

function readingRow(viewport: HTMLElement): RowAnchor | undefined {
  const top = viewport.getBoundingClientRect().top;
  const row = rowsOf(viewport).find(candidate => candidate.getBoundingClientRect().bottom > top);
  const key = row?.dataset.activityKey;
  if (!row || !key) return undefined;
  return { key, offset: row.getBoundingClientRect().top - top };
}

function scrollBackTo(viewport: HTMLElement, anchor: RowAnchor) {
  const row = rowsOf(viewport).find(candidate => candidate.dataset.activityKey === anchor.key);
  if (!row) return;
  viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset;
}

/**
 * A ref for a panel's viewport that keeps the reader on the row they were reading. The panel mounts again
 * when a thought joins its calls and they fold into a group, or when older history moves its stretch.
 */
export function keepReadingRow(panel: PanelView) {
  return (viewport: HTMLDivElement | null) => {
    if (!viewport) return;
    if (panel.anchor) scrollBackTo(viewport, panel.anchor);
    const remember = () => {
      panel.anchor = readingRow(viewport);
    };
    viewport.addEventListener('scroll', remember, { passive: true });
    return () => viewport.removeEventListener('scroll', remember);
  };
}
