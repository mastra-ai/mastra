import { EntityListCell } from './entity-list-cells';
import { EntityListRoot } from './entity-list-root';

const widths = ['75%', '50%', '65%', '90%', '60%', '80%'];

export type EntityListSkeletonProps = {
  columns: string;
  numberOfRows?: number;
};

export function EntityListSkeleton({ columns, numberOfRows = 3 }: EntityListSkeletonProps) {
  const columnParts = columns.trim().split(/\s+/);
  const columnCount = columnParts.length;
  const skeletonColumns = columnParts.map(col => (col === 'auto' ? 'minmax(6rem, auto)' : col)).join(' ');

  const getPseudoRandomWidth = (rowIdx: number, colIdx: number) => {
    const index = (rowIdx + colIdx + columnCount + numberOfRows) % widths.length;
    return widths[index];
  };

  return (
    <EntityListRoot columns={skeletonColumns}>
      {Array.from({ length: numberOfRows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="entity-list-row grid grid-cols-subgrid gap-6 lg:gap-8 xl:gap-10 2xl:gap-12 3xl:gap-14 col-span-full px-5 border-y border-b-border1 border-t-transparent transition-colors duration-200 rounded-lg"
        >
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <EntityListCell key={colIdx}>
              <div
                className="bg-surface4 rounded-md animate-pulse text-transparent h-4 select-none"
                style={{ width: getPseudoRandomWidth(rowIdx, colIdx) }}
              />
            </EntityListCell>
          ))}
        </div>
      ))}
    </EntityListRoot>
  );
}
