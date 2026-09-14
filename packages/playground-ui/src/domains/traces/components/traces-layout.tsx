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
}

/**
 * Layout shell for the traces page. Owns no state and fetches no data — pass slots in.
 *
 * The side panel is rendered as an `absolute inset-0` overlay that covers its nearest
 * positioned ancestor entirely. Consumers control the coverage by choosing which ancestor
 * is `relative` (e.g. the app frame, so the overlay also covers the route header).
 */
export function TracesLayout({
  listSlot,
  tracePanelSlot,
  spanPanelSlot,
  scorePanelSlot,
  traceCollapsed,
}: TracesLayoutProps) {
  const hasSidePanel = !!tracePanelSlot;

  return (
    <>
      <div className="h-full min-h-0">{listSlot}</div>

      {hasSidePanel && (
        <div
          role="dialog"
          aria-label="Trace details"
          data-trace-side-panel
          className={cn(
            // z-50 matches the route Header (a z-50 grid sibling in the app frame) so the panel,
            // rendered later in the DOM, paints above it while body-level portals stay on top.
            'absolute inset-0 z-50 min-w-0 p-3',
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
