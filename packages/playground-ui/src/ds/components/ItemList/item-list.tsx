import { ItemListCell } from './item-list-cell';
import { ItemListDateCell } from './item-list-date-cell';
import { ItemListHeader } from './item-list-header';
import { ItemListHeaderCol } from './item-list-header-col';
import { ItemListIdCell } from './item-list-id-cell';
import { ItemListItems } from './item-list-items';
import { ItemListItemsScroller } from './item-list-items-scroller';
import { ItemListLabelCell } from './item-list-label-cell';
import { ItemListLinkCell } from './item-list-link-cell';
import { ItemListMessage } from './item-list-message';
import { ItemListNextPageLoading } from './item-list-next-page-loading';
import { ItemListPagination } from './item-list-pagination';
import { ItemListRoot } from './item-list-root';
import { ItemListRow } from './item-list-row';
import { ItemListRowButton } from './item-list-row-button';
import { ItemListStatusCell } from './item-list-status-cell';
import { ItemListTextCell } from './item-list-text-cell';
import { ItemListVersionCell } from './item-list-version-cell';

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
  Cell: ItemListCell,
  TextCell: ItemListTextCell,
  StatusCell: ItemListStatusCell,
  VersionCell: ItemListVersionCell,
  IdCell: ItemListIdCell,
  DateCell: ItemListDateCell,
  LinkCell: ItemListLinkCell,
  LabelCell: ItemListLabelCell,
});
