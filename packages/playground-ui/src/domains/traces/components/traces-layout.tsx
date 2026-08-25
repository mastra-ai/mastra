import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TracesLayoutProps {
  /** The trace list (left column). */
  listSlot: ReactNode;
  /** The trace data panel (right column, top). When null/undefined, the whole right column collapses. */
  tracePanelSlot?: ReactNode;
  /** The span data panel (right column, middle). Only rendered when truthy. */
  spanPanelSlot?: ReactNode;
  /** The score data panel (right column, bottom). Only rendered when truthy. */
  scorePanelSlot?: ReactNode;
  /** When the trace panel is collapsed, the right column's grid-rows squash the trace row to `auto`. */
  traceCollapsed?: boolean;
}

/**
 * Pure 2-column layout shell for the traces page. Owns no state and fetches no data — pass slots in.
 * Right-column row template adapts based on which panels are present.
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
    <div
      className={cn(
        'grid max-h-full min-h-0 items-start gap-4 ',
        hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]',
      )}
    >
      {listSlot}

      {hasSidePanel && (
        <div
          className={cn(
            'relative grid max-h-full overflow-hidden',
            // Fill the page height so the trace panel reaches the bottom; when collapsed
            // (and nothing is stacked on top) the column shrinks to content.
            (!traceCollapsed || spanPanelSlot || scorePanelSlot) && 'h-full',
            traceCollapsed ? 'grid-rows-[auto]' : 'grid-rows-[1fr]',
          )}
        >
          {tracePanelSlot}
          {/* Span and score panels stack over the trace panel like sheets, each offset to
              the left so the panel underneath stays visible at its edge. */}
          {spanPanelSlot && (
            <div className="animate-in fade-in-0 slide-in-from-right-8 absolute inset-y-0 right-0 bottom-0 left-8 z-10 grid shadow-2xl duration-200">
              {spanPanelSlot}
            </div>
          )}
          {scorePanelSlot && (
            <div className="animate-in fade-in-0 slide-in-from-right-8 absolute inset-y-0 right-0 bottom-0 left-16 z-20 grid shadow-2xl duration-200">
              {scorePanelSlot}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
