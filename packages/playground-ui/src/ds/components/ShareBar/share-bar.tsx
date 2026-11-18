import { useState } from 'react';
import { ShareBarRowView } from './share-bar-row';
import {
  DEFAULT_COLOR,
  barSegments,
  fmtShare,
  foldRows,
  hoveredSegment,
  isRowDimmed,
  isSegmentDimmed,
  pageRows,
  rankRows,
  sumShares,
} from './share-bar-rows';
import { ShowMore } from './share-bar-show-more';
import { ShareBarSkeleton } from './share-bar-skeleton';
import type { ShareBarColumn, ShareBarProps } from './share-bar-types';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * Each row's share of a total: one 100% bar, then the column headers and the ranked rows that key
 * it. Hovering a segment or a row highlights the pair; every segment has its row, so there is no
 * tooltip. A non-zero share always gets a visible segment; a zero gets none. For a table of
 * figures (many columns, sorting, pages), use `MetricsTable`.
 */
export function ShareBar({ className, ...props }: ShareBarProps) {
  return (
    <div className={cn('grid grid-cols-1', className)}>
      <ShareBarBody {...props} />
    </div>
  );
}

/** A skeleton while loading, the empty message, or the bar, the headers and the rows. */
function ShareBarBody({
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
  emptyState = 'No data in this range.',
  isLoading = false,
  LinkComponent,
}: Omit<ShareBarProps, 'className'>) {
  const [hover, setHover] = useState<string>();
  // Extra pages opened with "Show more", so the row count follows `limit` when it changes.
  const [pages, setPages] = useState(0);
  const count = limit + pages * pageSize;
  const header = <ShareBarHeader columns={columns} valueLabel={valueLabel} valueWidth={valueWidth} />;

  if (isLoading) {
    return (
      <ShareBarSkeleton
        rows={overflow === 'other' ? limit + 1 : limit}
        columns={columns}
        valueWidth={valueWidth}
        header={header}
      />
    );
  }

  const ranked = rankRows(rows);
  if (ranked.length === 0) {
    return (
      <Txt variant="body-sm" tone="muted" className="py-6 text-center">
        {emptyState}
      </Txt>
    );
  }

  const total = sumShares(ranked);
  const paging = overflow === 'more';
  const { shown, bar, rest } = paging
    ? pageRows(ranked, { count, color, palette })
    : foldRows(ranked, { limit, other, color, palette });
  const segments = barSegments(bar, rest);
  const litSegment = hoveredSegment(shown, hover);
  const clearHover = () => setHover(undefined);

  return (
    <>
      <div className="flex h-2 gap-0.5" onMouseLeave={clearHover}>
        {segments.map(s => (
          <span
            key={s.key}
            data-testid="share-bar-segment"
            onMouseEnter={() => setHover(s.key)}
            className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
            style={{
              flex: `${s.grow} 1 0`,
              backgroundColor: s.paint.color,
              opacity: s.paint.alpha * (isSegmentDimmed(s.key, litSegment) ? 0.3 : 1),
            }}
          />
        ))}
      </div>
      {header}
      <ul className="grid min-w-0 grid-cols-1 gap-0.5" onMouseLeave={clearHover}>
        {shown.map(r => (
          <ShareBarRowView
            key={r.key}
            row={r}
            columns={columns}
            valueWidth={valueWidth}
            share={fmtShare(r.share, total)}
            highlighted={hover === r.key}
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
    </>
  );
}

/** Column headers between the bar and the rows, right above the values they label. */
function ShareBarHeader({
  columns,
  valueLabel,
  valueWidth,
}: {
  columns: ShareBarColumn[];
  valueLabel: string;
  valueWidth: string;
}) {
  const cells = [
    ...columns.map(c => ({ label: c.label, width: c.width ?? 'w-16' })),
    { label: 'Share', width: 'w-12' },
    { label: valueLabel, width: valueWidth },
  ];
  return (
    <div aria-hidden className="flex items-center justify-end gap-3 pt-3 pb-0.5 text-column text-placeholder">
      {cells.map(cell => (
        <span key={cell.label} className={cn('shrink-0 text-right whitespace-nowrap', cell.width)}>
          {cell.label}
        </span>
      ))}
    </div>
  );
}
