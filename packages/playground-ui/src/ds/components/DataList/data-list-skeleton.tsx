import { DataListCell } from './data-list-cells';
import { DataListRoot } from './data-list-root';

const widths = ['75%', '50%', '65%', '90%', '60%', '80%'];

export type DataListSkeletonProps = {
  columns?: string;
  numberOfRows?: number;
};

export function DataListSkeleton({ columns = 'auto 1fr auto auto', numberOfRows = 3 }: DataListSkeletonProps) {
  const columnParts = columns.trim().split(/\s+/);
  const columnCount = columnParts.length;
  const skeletonColumns = columnParts.map(col => (col === 'auto' ? 'minmax(6rem, auto)' : col)).join(' ');

  const getPseudoRandomWidth = (rowIdx: number, colIdx: number) => {
    const index = (rowIdx + colIdx + columnCount + numberOfRows) % widths.length;
    return widths[index];
  };

  return (
    <DataListRoot columns={skeletonColumns}>
      {Array.from({ length: numberOfRows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="data-list-row col-span-full grid grid-cols-subgrid gap-6 rounded-lg border-y border-t-transparent border-b-border1 px-5 transition-colors duration-200 2xl:gap-12 3xl:gap-14 lg:gap-8 xl:gap-10"
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <DataListCell key={colIdx}>
              <div
                className="h-4 animate-pulse rounded-md bg-surface4 text-transparent select-none"
                style={{ width: getPseudoRandomWidth(rowIdx, colIdx) }}
              />
            </DataListCell>
          ))}
        </div>
      ))}
    </DataListRoot>
  );
}
