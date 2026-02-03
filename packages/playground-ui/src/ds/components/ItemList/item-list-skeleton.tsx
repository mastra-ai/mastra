import { ItemListItemsSkeleton, type ItemListItemsSkeletonProps } from './item-list-items-skeleton';
import { ItemList } from './item-list';
import { ItemListTrim } from './item-list-trim';
import { ItemListHeader } from './item-list-header';

export function ItemListSkeleton({ columns, numberOfRows }: ItemListItemsSkeletonProps) {
  return (
    <ItemList>
      <ItemListTrim>
        <ItemListHeader columns={columns} />
        <ItemListItemsSkeleton columns={columns} numberOfRows={numberOfRows} />
      </ItemListTrim>
    </ItemList>
  );
}
