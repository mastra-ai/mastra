import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TracesLayoutProps {
  /** The trace list (left column). */
  listSlot: ReactNode;
  /** The trace data panel (right column, top). When null/undefined, the whole right column collapses. */
  tracePanelSlot?: ReactNode;
  /** The thread this trace belongs to, shown left of the panels. Needs an open trace panel. */
  threadSlot?: ReactNode;
  /** The span data panel (right column, middle). Only rendered when truthy. */
  spanPanelSlot?: ReactNode;
  /** The score data panel (right column, bottom). Only rendered when truthy. */
  scorePanelSlot?: ReactNode;
  /** When the trace panel is collapsed, the right column's grid-rows squash the trace row to `auto`. */
  traceCollapsed?: boolean;
  /** Widens the side panel column (e.g. when the span detail is shown inside the trace panel). */
  sidePanelWide?: boolean;
}

/**
 * Pure 2-column layout shell for the traces page. Owns no state and fetches no data — pass slots in.
 * Right-column row template adapts based on which panels are present.
 */
export function TracesLayout({
  listSlot,
  tracePanelSlot,
  threadSlot,
  spanPanelSlot,
  scorePanelSlot,
  traceCollapsed,
  sidePanelWide,
}: TracesLayoutProps) {
  const hasSidePanel = !!tracePanelSlot;
  // The thread reads as prose, so it only earns its place next to an open trace — and once it is
  // there, both it and the panels need the room the list was holding.
  const hasThread = hasSidePanel && !!threadSlot;
  // The span detail may be a slot here or nested inside the trace panel, in which case the page
  // only signals it through `sidePanelWide` — either way it is what earns the extra width.
  const hasSpanDetail = !!spanPanelSlot || !!sidePanelWide;

  // Reading a thread is the task, so the card takes 70% of the page — and all of it once the span
  // detail opens, collapsing the list away. Templates are inline: a `minmax(0,…)` arbitrary class
  // is not always emitted from this package, and a silently missing rule reads as a broken layout.
  const columns = !hasSidePanel
    ? '1fr'
    : hasThread
      ? hasSpanDetail
        ? '0fr 1fr'
        : 'minmax(0, 3fr) minmax(0, 7fr)'
      : sidePanelWide
        ? 'minmax(0, 1fr) minmax(0, 4fr)'
        : 'minmax(0, 1fr) minmax(0, 1fr)';

  return (
    <div
      style={{ gridTemplateColumns: columns }}
      className={cn(
        'grid max-h-full min-h-0 gap-4 transition-[grid-template-columns] duration-300 ease-in-out',
        // The thread is a full-height reading surface; without one the panels may shrink to content.
        hasThread ? 'h-full items-stretch' : 'items-start',
        // A grid item's `auto` min-width would keep the collapsed track open, and the gap with it.
        hasThread && hasSpanDetail && 'gap-0 [&>*:first-child]:min-w-0 [&>*:first-child]:overflow-hidden',
      )}
    >
      {listSlot}

      {hasSidePanel && (
        <div
          style={{
            // With a thread, both columns live in one card, so they are divided by a rule instead
            // of a gap. The thread keeps a steady share while the panels take the width the span
            // detail needs.
            gridTemplateColumns: hasThread
              ? hasSpanDetail
                ? 'minmax(0, 1fr) minmax(0, 2fr)'
                : 'minmax(0, 1fr) minmax(0, 1fr)'
              : 'minmax(0, 1fr)',
          }}
          className={cn(
            'grid max-h-full min-h-0 transition-[grid-template-columns] duration-300 ease-in-out',
            hasThread ? 'overflow-hidden rounded-xl border border-border1 bg-surface2' : 'gap-4',
            // The thread anchors the card to the top of the page even when the trace panel collapses.
            (!traceCollapsed || hasThread) && 'h-full',
          )}
        >
          {hasThread && <div className="border-border1 min-h-0 overflow-auto border-r p-4">{threadSlot}</div>}

          <div
            className={cn(
              'grid max-h-full min-h-0 gap-4 overflow-auto',
              // Fill the page height so the trace panel reaches the bottom; when collapsed
              // the column shrinks to content (items-start on the outer grid).
              !traceCollapsed && 'h-full',
              scorePanelSlot
                ? traceCollapsed
                  ? 'grid-rows-[auto_3fr_3fr]'
                  : 'grid-rows-[2fr_3fr_3fr]'
                : spanPanelSlot
                  ? traceCollapsed
                    ? 'grid-rows-[auto_3fr]'
                    : 'grid-rows-[2fr_3fr]'
                  : traceCollapsed
                    ? 'grid-rows-[auto]'
                    : 'grid-rows-[1fr]',
            )}
          >
            {tracePanelSlot}
            {spanPanelSlot}
            {scorePanelSlot}
          </div>
        </div>
      )}
    </div>
  );
}
