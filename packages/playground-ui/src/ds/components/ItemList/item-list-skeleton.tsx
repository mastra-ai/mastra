import { ItemListItemsSkeleton, type ItemListItemsSkeletonProps } from './item-list-items-skeleton';
import { ItemList } from './item-list';
import { ItemListHeader } from './item-list-header';

export function ItemListSkeleton({ columns, numberOfRows }: ItemListItemsSkeletonProps) {
  return (
    <ItemList>
      <ItemListHeader columns={columns} />
      <ItemListItemsSkeleton columns={columns} numberOfRows={numberOfRows} />
    </ItemList>
  );
}
