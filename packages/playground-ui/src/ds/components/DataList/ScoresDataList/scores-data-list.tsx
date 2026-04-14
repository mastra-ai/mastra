import type { ComponentProps } from 'react';
import { DataListNextPageLoading } from '../data-list-next-page-loading';
import { DataListNoMatch } from '../data-list-no-match';
import { DataListRoot } from '../data-list-root';
import { DataListRowButton } from '../data-list-row-button';
import { DataListTop } from '../data-list-top';
import { DataListTopCell } from '../data-list-top-cell';
import {
  ScoresDataListDateCell,
  ScoresDataListTimeCell,
  ScoresDataListInputCell,
  ScoresDataListEntityCell,
  ScoresDataListScoreCell,
} from './scores-data-list-cells';

function ScoresDataListRoot(props: ComponentProps<typeof DataListRoot>) {
  return <DataListRoot {...props} />;
}

export const ScoresDataList = Object.assign(ScoresDataListRoot, {
  Top: DataListTop,
  TopCell: DataListTopCell,
  RowButton: DataListRowButton,
  NoMatch: DataListNoMatch,
  NextPageLoading: DataListNextPageLoading,
  DateCell: ScoresDataListDateCell,
  TimeCell: ScoresDataListTimeCell,
  InputCell: ScoresDataListInputCell,
  EntityCell: ScoresDataListEntityCell,
  ScoreCell: ScoresDataListScoreCell,
});
