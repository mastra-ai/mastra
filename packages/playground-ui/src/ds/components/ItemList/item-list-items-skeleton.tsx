import { type ItemListColumn } from './types';
import { ItemListItems } from './item-list-items';
import { ItemListRow } from './item-list-row';
import { ItemListRowButton } from './item-list-row-button';

const widths = ['75%', '50%', '65%', '90%', '60%', '80%'];

export type ItemListItemsSkeletonProps = {
  columns?: ItemListColumn[];
  numberOfRows?: number;
};

export function ItemListItemsSkeleton({ columns, numberOfRows = 3 }: ItemListItemsSkeletonProps) {
  const getPseudoRandomWidth = (rowIdx: number, colIdx: number) => {
    const index = (rowIdx + colIdx + (columns?.length || 0) + (numberOfRows || 0)) % widths.length;
    return widths[index];
  };

  return (
    <ItemListItems>
      {Array.from({ length: numberOfRows }).map((_, rowIdx) => (
        <ItemListRow key={rowIdx}>
          <ItemListRowButton columns={columns}>
            {(columns || []).map((col, colIdx) => {
              const key = `${col.name}-${colIdx}`;
              return (
                <div
                  key={key}
                  className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"
                  style={{ width: `${getPseudoRandomWidth(rowIdx, colIdx)}` }}
                ></div>
              );
            })}
          </ItemListRowButton>
        </ItemListRow>
      ))}
    </ItemListItems>
  );
}
