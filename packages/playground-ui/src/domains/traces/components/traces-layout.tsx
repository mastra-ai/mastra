import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TracesLayoutProps {
  /** The trace list (left column). */
  listSlot: ReactNode;
  /** The trace data panel (side panel, top). When null/undefined, the side panel is not rendered. */
  tracePanelSlot?: ReactNode;
  /** The span data panel (side panel, middle). Only rendered when truthy. */
  spanPanelSlot?: ReactNode;
  /** The score data panel (side panel, bottom). Only rendered when truthy. */
  scorePanelSlot?: ReactNode;
  /** When the trace panel is collapsed, the side panel's grid-rows squash the trace row to `auto`. */
  traceCollapsed?: boolean;
  /**
   * Side panel width, driven by how many columns the trace panel shows:
   * `half` (trace only), `wide` (trace + one side column), `full` (messages + trace + span —
   * covers the whole positioned ancestor, i.e. stops at the main nav).
   */
  sidePanelWidth?: TracesSidePanelWidth;
}

export type TracesSidePanelWidth = 'half' | 'wide' | 'full';

const SIDE_PANEL_WIDTH_CLASS: Record<TracesSidePanelWidth, string> = {
  half: 'w-1/2',
  wide: 'w-4/5',
  full: 'w-full',
};

/**
 * Layout shell for the traces page. Owns no state and fetches no data — pass slots in.
 *
 * The list lives in a 2-column grid whose right column is an empty spacer; the side panel
 * is rendered as an `absolute inset-y-0 right-0` overlay whose width mirrors the spacer
 * column, so it spans the full height of its nearest positioned ancestor while the list
 * stays interactive on the left. Consumers control the coverage by choosing which ancestor
 * is `relative` (e.g. the app frame, so the overlay also covers the route header).
 */
export function TracesLayout({
  listSlot,
  tracePanelSlot,
  spanPanelSlot,
  scorePanelSlot,
  traceCollapsed,
  sidePanelWidth = 'half',
}: TracesLayoutProps) {
  const hasSidePanel = !!tracePanelSlot;
  const isHalf = sidePanelWidth === 'half';

  return (
    <>
      <div
        className={cn(
          'grid h-full min-h-0 items-start gap-4 transition-[grid-template-columns] duration-300 ease-in-out',
          hasSidePanel ? (isHalf ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr_4fr]') : 'grid-cols-[1fr]',
        )}
      >
        {listSlot}
        {hasSidePanel && <div aria-hidden />}
      </div>

      {hasSidePanel && (
        <div
          role="dialog"
          aria-label="Trace details"
          data-trace-side-panel
          className={cn(
            // z-50 matches the route Header (a z-50 grid sibling in the app frame) so the panel,
            // rendered later in the DOM, paints above it while body-level portals stay on top.
            'absolute inset-y-0 right-0 z-50 min-w-0 p-3',
            'transition-[width] duration-300 ease-in-out',
            SIDE_PANEL_WIDTH_CLASS[sidePanelWidth],
            'grid gap-4 overflow-auto [&>*]:rounded-lg [&>*]:bg-surface3 [&>*]:shadow-lg',
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
      )}
    </>
  );
}
