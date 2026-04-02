import { DataListNextPageLoading } from '../data-list-next-page-loading';
import { DataListNoMatch } from '../data-list-no-match';
import { DataListRoot } from '../data-list-root';
import { DataListRowButton } from '../data-list-row-button';
import { DataListTop } from '../data-list-top';
import { DataListTopCell } from '../data-list-top-cell';
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
  RowButton: DataListRowButton,
  NoMatch: DataListNoMatch,
  DateCell: LogsDataListDateCell,
  TimeCell: LogsDataListTimeCell,
  LevelCell: LogsDataListLevelCell,
  EntityCell: LogsDataListEntityCell,
  MessageCell: LogsDataListMessageCell,
  DataCell: LogsDataListDataCell,
  NextPageLoading: DataListNextPageLoading,
});
