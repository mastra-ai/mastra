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
          className="data-list-row grid grid-cols-subgrid gap-6 lg:gap-8 xl:gap-10 2xl:gap-12 3xl:gap-14 col-span-full px-5 border-y border-b-border1 border-t-transparent transition-colors duration-200 rounded-lg"
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <DataListCell key={colIdx}>
              <div
                className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"
                style={{ width: getPseudoRandomWidth(rowIdx, colIdx) }}
              />
            </DataListCell>
          ))}
        </div>
      ))}
    </DataListRoot>
  );
}
