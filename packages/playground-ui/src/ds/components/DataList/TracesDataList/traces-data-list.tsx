import type { ComponentProps } from 'react';
import { DataListNextPageLoading } from '../data-list-next-page-loading';
import { DataListNoMatch } from '../data-list-no-match';
import { DataListRoot } from '../data-list-root';
import { DataListRowButton } from '../data-list-row-button';
import { DataListSubheader } from '../data-list-subheader';
import { DataListSubHeading } from '../data-list-subheading';
import { DataListTop } from '../data-list-top';
import { DataListTopCell } from '../data-list-top-cell';
import {
  TracesDataListIdCell,
  TracesDataListDateCell,
  TracesDataListTimeCell,
  TracesDataListNameCell,
  TracesDataListInputCell,
  TracesDataListEntityCell,
  TracesDataListStatusCell,
} from './traces-data-list-cells';

function TracesDataListRoot(props: ComponentProps<typeof DataListRoot>) {
  return <DataListRoot {...props} />;
}

export const TracesDataList = Object.assign(TracesDataListRoot, {
  Top: DataListTop,
  TopCell: DataListTopCell,
  RowButton: DataListRowButton,
  NoMatch: DataListNoMatch,
  Subheader: DataListSubheader,
  SubHeading: DataListSubHeading,
  IdCell: TracesDataListIdCell,
  DateCell: TracesDataListDateCell,
  TimeCell: TracesDataListTimeCell,
  NameCell: TracesDataListNameCell,
  InputCell: TracesDataListInputCell,
  EntityCell: TracesDataListEntityCell,
  StatusCell: TracesDataListStatusCell,
  NextPageLoading: DataListNextPageLoading,
});
