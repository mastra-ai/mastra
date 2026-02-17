import { ItemListRoot } from './item-list-root';
import { ItemListHeader } from './item-list-header';
import { ItemListHeaderCol } from './item-list-header-col';
import { ItemListItems } from './item-list-items';
import { ItemListRow } from './item-list-row';
import { ItemListRowButton } from './item-list-row-button';
import { ItemListMessage } from './item-list-message';
import { ItemListNextPageLoading } from './item-list-next-page-loading';
import { ItemListPagination } from './item-list-pagination';
import { ItemListItemsScroller } from './item-list-items-scroller';
import { ItemListTextCell } from './item-list-text-cell';
import { ItemListStatusCell } from './item-list-status-cell';
import { ItemListFlexCell } from './item-list-flex-cell';

export const ItemList = Object.assign(ItemListRoot, {
  Header: ItemListHeader,
  HeaderCol: ItemListHeaderCol,
  Items: ItemListItems,
  Scroller: ItemListItemsScroller,
  Row: ItemListRow,
  RowButton: ItemListRowButton,
  Message: ItemListMessage,
  NextPageLoading: ItemListNextPageLoading,
  Pagination: ItemListPagination,
  TextCell: ItemListTextCell,
  StatusCell: ItemListStatusCell,
  FlexCell: ItemListFlexCell,
});
