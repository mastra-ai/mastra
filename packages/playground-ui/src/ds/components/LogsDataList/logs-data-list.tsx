import { DataListNextPageLoading } from '../DataList/data-list-next-page-loading';
import { DataListNoMatch } from '../DataList/data-list-no-match';
import { DataListRoot } from '../DataList/data-list-root';
import { DataListRow } from '../DataList/data-list-row';
import { DataListRowButton } from '../DataList/data-list-row-button';
import { DataListRowLink } from '../DataList/data-list-row-link';
import { DataListTop } from '../DataList/data-list-top';
import { DataListTopCell, DataListTopCellWithTooltip, DataListTopCellSmart } from '../DataList/data-list-top-cell';
import {
  LogsDataListLevelCell,
  LogsDataListDateCell,
  LogsDataListTimeCell,
  LogsDataListEntityCell,
  LogsDataListMessageCell,
  LogsDataListDataCell,
} from './logs-data-list-cells';

export const LogsDataList = Object.assign(DataListRoot, {
  Top: DataListTop,
  TopCell: DataListTopCell,
  TopCellWithTooltip: DataListTopCellWithTooltip,
  TopCellSmart: DataListTopCellSmart,
  Row: DataListRow,
  RowButton: DataListRowButton,
  RowLink: DataListRowLink,
  NoMatch: DataListNoMatch,
  DateCell: LogsDataListDateCell,
  TimeCell: LogsDataListTimeCell,
  LevelCell: LogsDataListLevelCell,
  EntityCell: LogsDataListEntityCell,
  MessageCell: LogsDataListMessageCell,
  DataCell: LogsDataListDataCell,
  NextPageLoading: DataListNextPageLoading,
});
