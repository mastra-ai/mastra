import { ItemList } from './item-list';
import { ItemListHeader } from './item-list-header';
import { ItemListItemsSkeleton } from './item-list-items-skeleton';
import type { ItemListItemsSkeletonProps } from './item-list-items-skeleton';

export function ItemListSkeleton({ columns, numberOfRows }: ItemListItemsSkeletonProps) {
  return (
    <ItemList>
      <ItemListHeader columns={columns} />
      <ItemListItemsSkeleton columns={columns} numberOfRows={numberOfRows} />
    </ItemList>
  );
}
