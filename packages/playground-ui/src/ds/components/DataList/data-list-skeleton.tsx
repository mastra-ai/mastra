import { DataListCell } from './data-list-cells';
import { DataListRoot } from './data-list-root';
import type { DataListFit } from './data-list-root';
import { dataListRowOuterStyles } from './shared';
import { cn } from '@/lib/utils';

const widths = ['75%', '50%', '65%', '90%', '60%', '80%'];

export type DataListSkeletonProps = {
  columns?: string;
  numberOfRows?: number;
  fit?: DataListFit;
};

export function DataListSkeleton({ columns = 'auto 1fr auto auto', numberOfRows = 3, fit }: DataListSkeletonProps) {
  const columnParts = columns.trim().split(/\s+/);
  const columnCount = columnParts.length;
  const skeletonColumns = columnParts.map(col => (col === 'auto' ? 'minmax(6rem, auto)' : col)).join(' ');

  const getPseudoRandomWidth = (rowIdx: number, colIdx: number) => {
    const index = (rowIdx + colIdx + columnCount + numberOfRows) % widths.length;
    return widths[index];
  };

  return (
    <DataListRoot columns={skeletonColumns} fit={fit}>
      {Array.from({ length: numberOfRows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={cn(
            'grid grid-cols-subgrid gap-6 px-5 2xl:gap-12 3xl:gap-14 lg:gap-8 xl:gap-10',
            ...dataListRowOuterStyles,
          )}
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <DataListCell key={colIdx}>
              <div
                className="bg-surface6 h-4 animate-pulse rounded-lg text-transparent select-none"
                style={{ width: getPseudoRandomWidth(rowIdx, colIdx) }}
              />
            </DataListCell>
          ))}
        </div>
      ))}
    </DataListRoot>
  );
}
