import { useState } from 'react';
import { MetricsShareListHeader } from './metrics-share-list-header';
import { ShareListRow } from './metrics-share-list-row';
import {
  DEFAULT_COLOR,
  fmtShare,
  foldRows,
  hoveredSegment,
  isRowDimmed,
  isSegmentDimmed,
  pageRows,
  rankRows,
  stripSegments,
  sumShares,
} from './metrics-share-list-rows';
import { ShowMore } from './metrics-share-list-show-more';
import { ShareListSkeleton } from './metrics-share-list-skeleton';
import type { MetricsShareListProps } from './metrics-share-list-types';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * Each row's share of a total: one 100% strip on top, the ranked rows below with their share
 * and values. Hovering a segment or a row highlights the pair; every segment has its row, so
 * there is no tooltip. A non-zero share always gets a visible segment; a zero gets none.
 */
export function MetricsShareList({
  rows,
  columns = [],
  valueLabel,
  valueWidth = 'w-14',
  palette = 'shades',
  color = DEFAULT_COLOR,
  limit = 5,
  overflow = 'other',
  pageSize = 50,
  other,
  activeKey,
  showHeader = true,
  emptyState = 'No data in this range.',
  isLoading = false,
  LinkComponent,
  className,
}: MetricsShareListProps) {
  const [hover, setHover] = useState<string>();
  // Extra pages opened with "Show more", so the row count follows `limit` when it changes.
  const [pages, setPages] = useState(0);
  const count = limit + pages * pageSize;
  const header = showHeader && (
    <div className="flex justify-end">
      <MetricsShareListHeader columns={columns} valueLabel={valueLabel} valueWidth={valueWidth} />
    </div>
  );

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-1 gap-4', className)}>
        {header}
        <ShareListSkeleton rows={overflow === 'other' ? limit + 1 : limit} columns={columns} valueWidth={valueWidth} />
      </div>
    );
  }

  const ranked = rankRows(rows);
  if (ranked.length === 0) {
    return (
      <div className={cn('grid grid-cols-1 gap-4', className)}>
        {header}
        <Txt variant="body-sm" tone="muted" className="py-6 text-center">
          {emptyState}
        </Txt>
      </div>
    );
  }

  const total = sumShares(ranked);
  const paging = overflow === 'more';
  const { shown, rest } = paging
    ? pageRows(ranked, { count, activeKey, color, palette })
    : foldRows(ranked, { limit, other, color, palette });
  const segments = stripSegments(shown, rest);
  const litSegment = hoveredSegment(shown, hover);
  const clearHover = () => setHover(undefined);

  return (
    <div className={cn('grid grid-cols-1 gap-4', className)}>
      {header}
      <div className="flex h-2 gap-0.5" onMouseLeave={clearHover}>
        {segments.map(s => (
          <span
            key={s.key}
            data-testid="metrics-share-segment"
            onMouseEnter={() => setHover(s.key)}
            className="h-full min-w-[3px] transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
            style={{
              flex: `${s.grow} 1 0`,
              backgroundColor: s.paint.color,
              opacity: s.paint.alpha * (isSegmentDimmed(s.key, litSegment) ? 0.3 : 1),
            }}
          />
        ))}
      </div>
      <ul className="grid min-w-0 grid-cols-1 gap-0.5" onMouseLeave={clearHover}>
        {shown.map(r => (
          <ShareListRow
            key={r.key}
            row={r}
            columns={columns}
            valueWidth={valueWidth}
            share={fmtShare(r.share, total)}
            highlighted={hover === r.key || activeKey === r.key}
            dimmed={isRowDimmed(r, hover)}
            onHover={() => setHover(r.key)}
            LinkComponent={LinkComponent}
          />
        ))}
        {paging && (
          <ShowMore
            shown={Math.min(count, ranked.length)}
            total={ranked.length}
            limit={limit}
            pageSize={pageSize}
            onMore={() => setPages(p => p + 1)}
            onLess={() => setPages(0)}
          />
        )}
      </ul>
    </div>
  );
}

MetricsShareList.Header = MetricsShareListHeader;
