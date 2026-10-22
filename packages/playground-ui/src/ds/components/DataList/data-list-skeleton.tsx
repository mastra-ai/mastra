import { DataListCell } from './data-list-cells';
import { DataListRoot } from './data-list-root';
import type { DataListFit, DataListVariant } from './data-list-root';
import { DataListTop } from './data-list-top';
import { DataListTopCell } from './data-list-top-cell';
import { dataListRowOuterStyles, splitColumns } from './shared';
import { cn } from '@/lib/utils';

const widths = ['75%', '50%', '65%', '90%', '60%', '80%'] as const;
const headerWidths = ['3rem', '5rem', '4rem', '3.5rem', '4.5rem', '3rem'] as const;

export type DataListSkeletonProps = {
  columns?: string;
  numberOfRows?: number;
  fit?: DataListFit;
  variant?: DataListVariant;
};

function SkeletonBar({ width, className }: { width: string; className?: string }) {
  return (
    <div
      className={cn('h-4 animate-pulse rounded-lg bg-(--data-list-background) text-transparent select-none', className)}
      style={{ width }}
    />
  );
}

export type DataListSkeletonRowsProps = {
  columnCount: number;
  numberOfRows?: number;
};

/**
 * Placeholder rows only, for lists that keep their real root and header while
 * loading (e.g. virtualized lists that must keep the same scroll container).
 */
export function DataListSkeletonRows({ columnCount, numberOfRows = 3 }: DataListSkeletonRowsProps) {
  const getPseudoRandomWidth = (rowIdx: number, colIdx: number) => {
    const index = (rowIdx + colIdx + columnCount + numberOfRows) % widths.length;
    return widths[index] ?? widths[0];
  };

  return Array.from({ length: numberOfRows }).map((_, rowIdx) => (
    <div key={rowIdx} className={cn('data-list-cells grid grid-cols-subgrid gap-4 px-3', ...dataListRowOuterStyles)}>
      {Array.from({ length: columnCount }).map((_, colIdx) => (
        <DataListCell key={colIdx}>
          <SkeletonBar width={getPseudoRandomWidth(rowIdx, colIdx)} />
        </DataListCell>
      ))}
    </div>
  ));
}

/**
 * Loading placeholder mirroring the real list: same root, a sticky header
 * band with one placeholder label per column, then rows of placeholder cells.
 */
export function DataListSkeleton({
  columns = 'auto 1fr auto auto',
  numberOfRows = 3,
  fit,
  variant,
}: DataListSkeletonProps) {
  const columnParts = splitColumns(columns);
  const columnCount = columnParts.length;
  const skeletonColumns = columnParts.map(col => (col === 'auto' ? 'minmax(6rem, auto)' : col)).join(' ');

  return (
    <DataListRoot columns={skeletonColumns} fit={fit} variant={variant}>
      <DataListTop>
        {Array.from({ length: columnCount }).map((_, colIdx) => (
          <DataListTopCell key={colIdx}>
            <SkeletonBar width={headerWidths[colIdx % headerWidths.length] ?? headerWidths[0]} className="h-3" />
          </DataListTopCell>
        ))}
      </DataListTop>
      <DataListSkeletonRows columnCount={columnCount} numberOfRows={numberOfRows} />
    </DataListRoot>
  );
}
