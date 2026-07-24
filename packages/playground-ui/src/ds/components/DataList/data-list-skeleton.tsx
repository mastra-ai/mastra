import { DataListCell } from './data-list-cells';
import { DataListRoot } from './data-list-root';
import type { DataListFit } from './data-list-root';

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
          className="data-list-row border-b-border1 3xl:gap-14 col-span-full grid grid-cols-subgrid gap-6 rounded-lg border-y border-t-transparent px-5 transition-colors duration-200 lg:gap-8 xl:gap-10 2xl:gap-12"
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <DataListCell key={colIdx}>
              <div
                className="bg-surface4 h-4 animate-pulse rounded-md text-transparent select-none"
                style={{ width: getPseudoRandomWidth(rowIdx, colIdx) }}
              />
            </DataListCell>
          ))}
        </div>
      ))}
    </DataListRoot>
  );
}
