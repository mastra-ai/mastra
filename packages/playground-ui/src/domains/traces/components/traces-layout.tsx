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

function getTracesPanelGridRows({
  spanPanelSlot,
  scorePanelSlot,
  traceCollapsed,
}: Pick<TracesLayoutProps, 'spanPanelSlot' | 'scorePanelSlot' | 'traceCollapsed'>) {
  if (scorePanelSlot) {
    if (traceCollapsed) {
      return 'grid-rows-[auto_3fr_3fr]';
    }
    return 'grid-rows-[2fr_3fr_3fr]';
  }
  if (spanPanelSlot) {
    if (traceCollapsed) {
      return 'grid-rows-[auto_3fr]';
    }
    return 'grid-rows-[2fr_3fr]';
  }
  if (traceCollapsed) {
    return 'grid-rows-[auto]';
  }
  return 'grid-rows-[1fr]';
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
        'grid max-h-full min-h-0 gap-4 items-start ',
        hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]',
      )}
    >
      {listSlot}

      {hasSidePanel && (
        <div
          className={cn(
            'grid gap-4 max-h-full overflow-auto',
            getTracesPanelGridRows({ spanPanelSlot, scorePanelSlot, traceCollapsed }),
          )}
        >
          {tracePanelSlot}
          {spanPanelSlot}
          {scorePanelSlot}
        </div>
      )}
    </div>
  );
}
