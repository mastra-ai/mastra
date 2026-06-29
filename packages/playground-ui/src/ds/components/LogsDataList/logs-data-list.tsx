import { DataListDateCell, DataListTimeCell } from '../DataList/data-list-cells';
import { DataListNextPageLoading } from '../DataList/data-list-next-page-loading';
import { DataListNoMatch } from '../DataList/data-list-no-match';
import { DataListRoot } from '../DataList/data-list-root';
import { DataListRowButton } from '../DataList/data-list-row-button';
import { DataListRowLink } from '../DataList/data-list-row-link';
import { DataListRowWrapper } from '../DataList/data-list-row-wrapper';
import { DataListSpacer } from '../DataList/data-list-spacer';
import { DataListTop } from '../DataList/data-list-top';
import { DataListTopCell, DataListTopCellWithTooltip, DataListTopCellSmart } from '../DataList/data-list-top-cell';
import {
  LogsDataListLevelCell,
  LogsDataListEntityCell,
  LogsDataListMessageCell,
  LogsDataListDataCell,
} from './logs-data-list-cells';

export const LogsDataList = Object.assign(DataListRoot, {
  Top: DataListTop,
  TopCell: DataListTopCell,
  TopCellWithTooltip: DataListTopCellWithTooltip,
  TopCellSmart: DataListTopCellSmart,
  RowWrapper: DataListRowWrapper,
  RowButton: DataListRowButton,
  RowLink: DataListRowLink,
  Spacer: DataListSpacer,
  NoMatch: DataListNoMatch,
  DateCell: DataListDateCell,
  TimeCell: DataListTimeCell,
  LevelCell: LogsDataListLevelCell,
  EntityCell: LogsDataListEntityCell,
  MessageCell: LogsDataListMessageCell,
  DataCell: LogsDataListDataCell,
  NextPageLoading: DataListNextPageLoading,
});
