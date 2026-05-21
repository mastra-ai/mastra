import type { ComponentProps } from 'react';
import { DataListDateCell, DataListTimeCell } from '../data-list-cells';
import { DataListNextPageLoading } from '../data-list-next-page-loading';
import { DataListNoMatch } from '../data-list-no-match';
import { DataListRoot } from '../data-list-root';
import { DataListRow } from '../data-list-row';
import { DataListRowButton } from '../data-list-row-button';
import { DataListRowLink } from '../data-list-row-link';
import { DataListSpacer } from '../data-list-spacer';
import { DataListTop } from '../data-list-top';
import { DataListTopCell, DataListTopCellWithTooltip, DataListTopCellSmart } from '../data-list-top-cell';
import {
  LogsDataListLevelCell,
  LogsDataListEntityCell,
  LogsDataListMessageCell,
  LogsDataListDataCell,
} from './logs-data-list-cells';

function LogsDataListRoot(props: ComponentProps<typeof DataListRoot>) {
  return <DataListRoot {...props} />;
}

export const LogsDataList = Object.assign(LogsDataListRoot, {
  Top: DataListTop,
  TopCell: DataListTopCell,
  TopCellWithTooltip: DataListTopCellWithTooltip,
  TopCellSmart: DataListTopCellSmart,
  Row: DataListRow,
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
