import { ItemListRoot } from './item-list-root';
import { ItemListHeader } from './item-list-header';
import { ItemListHeaderCol } from './item-list-header-col';
import { ItemListItems } from './item-list-items';
import { ItemListTrim } from './item-list-trim';
import { ItemListRow } from './item-list-row';
import { ItemListRowButton } from './item-list-row-button';
import { ItemListMessage } from './item-list-message';
import { ItemListNextPageLoading } from './item-list-next-page-loading';
import { ItemListPagination } from './item-list-pagination';
import { ItemListItemStatus, ItemListItemText } from './item-list-item-col';

export const ItemList = Object.assign(ItemListRoot, {
  Header: ItemListHeader,
  HeaderCol: ItemListHeaderCol,
  Trim: ItemListTrim,
  Items: ItemListItems,
  Row: ItemListRow,
  RowButton: ItemListRowButton,
  Message: ItemListMessage,
  NextPageLoading: ItemListNextPageLoading,
  Pagination: ItemListPagination,
  ItemText: ItemListItemText,
  ItemStatus: ItemListItemStatus,
});
