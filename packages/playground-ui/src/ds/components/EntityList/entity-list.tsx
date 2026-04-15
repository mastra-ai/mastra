import { EntityListCell, EntityListTextCell, EntityListNameCell, EntityListDescriptionCell } from './entity-list-cells';
import { EntityListNoMatch } from './entity-list-no-match';
import { EntityListPagination } from './entity-list-pagination';
import { EntityListRoot } from './entity-list-root';
import { EntityListRow } from './entity-list-row';
import { EntityListRowLink } from './entity-list-row-link';
import { EntityListRows } from './entity-list-rows';
import { EntityListTop } from './entity-list-top';
import { EntityListTopCell, EntityListTopCellWithTooltip, EntityListTopCellSmart } from './entity-list-top-cell';

export const EntityList = Object.assign(EntityListRoot, {
  Top: EntityListTop,
  TopCell: EntityListTopCell,
  TopCellWithTooltip: EntityListTopCellWithTooltip,
  TopCellSmart: EntityListTopCellSmart,
  Rows: EntityListRows,
  Row: EntityListRow,
  RowLink: EntityListRowLink,
  Cell: EntityListCell,
  TextCell: EntityListTextCell,
  NameCell: EntityListNameCell,
  DescriptionCell: EntityListDescriptionCell,
  NoMatch: EntityListNoMatch,
  Pagination: EntityListPagination,
});
