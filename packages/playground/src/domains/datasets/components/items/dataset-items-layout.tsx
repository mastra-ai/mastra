import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export interface DatasetItemsLayoutProps {
  /** The left column: toolbar + optional notice + items list. */
  listSlot: ReactNode;
  /** Right column when an item is selected. Takes precedence over the versions panel. */
  detailPanelSlot?: ReactNode;
  /** Right column when the versions panel is open. Suppressed if `detailPanelSlot` is set. */
  versionsPanelSlot?: ReactNode;
}

/**
 * Pure 2-column layout shell for the dataset items view. Owns no state and
 * fetches no data — pass slots in. The right column shows the detail panel
 * (preferred) or the versions panel (fallback), and collapses entirely when
 * neither is present.
 */
export function DatasetItemsLayout({ listSlot, detailPanelSlot, versionsPanelSlot }: DatasetItemsLayoutProps) {
  const showDetail = !!detailPanelSlot;
  const showVersions = !showDetail && !!versionsPanelSlot;

  return (
    <div
      className={cn('grid max-h-full min-h-0 gap-4 items-start', {
        'grid-cols-[1fr_1fr]': showDetail,
        'grid-cols-[1fr_auto]': showVersions,
      })}
    >
      <div className="grid gap-8 content-start max-w-full overflow-y-auto">{listSlot}</div>
      {showDetail && detailPanelSlot}
      {showVersions && versionsPanelSlot}
    </div>
  );
}
