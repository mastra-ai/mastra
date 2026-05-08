import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface LogsLayoutProps {
  /** The logs list (left column). */
  listSlot: ReactNode;
  /** The log data panel (right column, top). When null/undefined, the whole right column collapses. */
  logPanelSlot?: ReactNode;
  /** The trace data panel (right column, middle). Only rendered when truthy. */
  tracePanelSlot?: ReactNode;
  /** The span data panel (right column, bottom). Only rendered when truthy. */
  spanPanelSlot?: ReactNode;
  /** When the log panel is collapsed, the right column's grid-rows squash the log row to `auto`. */
  logCollapsed?: boolean;
}

/**
 * Pure 2-column layout shell for the logs page. Owns no state and fetches no data — pass slots in.
 * Right-column row template adapts based on which panels are present and whether the log panel is
 * collapsed.
 */
export function LogsLayout({ listSlot, logPanelSlot, tracePanelSlot, spanPanelSlot, logCollapsed }: LogsLayoutProps) {
  const hasSidePanel = !!logPanelSlot;

  return (
    <div
      className={cn('grid h-full min-h-0 gap-4 items-start', hasSidePanel ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}
    >
      {listSlot}

      {hasSidePanel && (
        <div
          className={cn(
            'grid gap-4 h-full overflow-auto',
            tracePanelSlot && spanPanelSlot
              ? logCollapsed
                ? 'grid-rows-[auto_1fr_1fr]'
                : 'grid-rows-[1fr_1fr_1fr]'
              : tracePanelSlot
                ? logCollapsed
                  ? 'grid-rows-[auto_1fr]'
                  : 'grid-rows-[1fr_1fr]'
                : logCollapsed
                  ? 'grid-rows-[auto]'
                  : 'grid-rows-[1fr]',
          )}
        >
          {logPanelSlot}
          {tracePanelSlot}
          {spanPanelSlot}
        </div>
      )}
    </div>
  );
}
