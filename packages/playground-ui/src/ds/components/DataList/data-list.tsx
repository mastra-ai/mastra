import { DataListCell, DataListTextCell, DataListNameCell, DataListDescriptionCell } from './data-list-cells';
import { DataListNextPageLoading } from './data-list-next-page-loading';
import { DataListNoMatch } from './data-list-no-match';
import { DataListPagination } from './data-list-pagination';
import { DataListRoot } from './data-list-root';
import { DataListRow } from './data-list-row';
import { DataListRowButton } from './data-list-row-button';
import { DataListRowLink } from './data-list-row-link';
import { DataListSubheader } from './data-list-subheader';
import { DataListSubHeading } from './data-list-subheading';
import { DataListTop } from './data-list-top';
import { DataListTopCell, DataListTopCellWithTooltip, DataListTopCellSmart } from './data-list-top-cell';

export const DataList = Object.assign(DataListRoot, {
  Top: DataListTop,
  TopCell: DataListTopCell,
  TopCellWithTooltip: DataListTopCellWithTooltip,
  TopCellSmart: DataListTopCellSmart,
  Row: DataListRow,
  RowButton: DataListRowButton,
  RowLink: DataListRowLink,
  Cell: DataListCell,
  TextCell: DataListTextCell,
  NameCell: DataListNameCell,
  DescriptionCell: DataListDescriptionCell,
  NoMatch: DataListNoMatch,
  Subheader: DataListSubheader,
  SubHeading: DataListSubHeading,
  NextPageLoading: DataListNextPageLoading,
  Pagination: DataListPagination,
});
