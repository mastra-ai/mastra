import { EntityListCell, EntityListTextCell, EntityListNameCell, EntityListDescriptionCell } from './entity-list-cells';
import { EntityListRoot } from './entity-list-root';
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
  RowLink: EntityListRowLink,
  Cell: EntityListCell,
  TextCell: EntityListTextCell,
  NameCell: EntityListNameCell,
  DescriptionCell: EntityListDescriptionCell,
});
