import { format, isToday } from 'date-fns';
import { DataListCell } from '../data-list-cells';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// DateCell
// ---------------------------------------------------------------------------

export interface ScoresDataListDateCellProps {
  timestamp: Date | string;
}

export function ScoresDataListDateCell({ timestamp }: ScoresDataListDateCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="text-ui-smd text-neutral2">
      {date ? (isToday(date) ? 'Today' : format(date, 'MMM dd')) : '-'}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// TimeCell
// ---------------------------------------------------------------------------

export interface ScoresDataListTimeCellProps {
  timestamp: Date | string;
}

export function ScoresDataListTimeCell({ timestamp }: ScoresDataListTimeCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="text-ui-smd text-neutral3">
      {date ? format(date, 'h:mm:ss aaa') : '-'}
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// InputCell
// ---------------------------------------------------------------------------

export interface ScoresDataListInputCellProps {
  input?: unknown;
}

export function ScoresDataListInputCell({ input }: ScoresDataListInputCellProps) {
  const display = input != null ? JSON.stringify(input) : '-';
  return (
    <DataListCell height="compact">
      <span className="text-ui-smd text-neutral3 block max-w-full min-w-0 truncate font-mono" title={display}>
        {display}
      </span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// EntityCell
// ---------------------------------------------------------------------------

export interface ScoresDataListEntityCellProps {
  entityId?: string | null;
}

export function ScoresDataListEntityCell({ entityId }: ScoresDataListEntityCellProps) {
  const display = entityId || '-';
  return (
    <DataListCell height="compact">
      <span className="text-ui-smd block max-w-full min-w-0 truncate" title={display}>
        {display}
      </span>
    </DataListCell>
  );
}

// ---------------------------------------------------------------------------
// ScoreCell
// ---------------------------------------------------------------------------

export interface ScoresDataListScoreCellProps {
  score?: unknown;
}

export function ScoresDataListScoreCell({ score }: ScoresDataListScoreCellProps) {
  const display = score == null ? '-' : typeof score === 'object' ? JSON.stringify(score) : String(score);
  return (
    <DataListCell height="compact">
      <span className="text-ui-smd text-neutral3 block max-w-full min-w-0 truncate font-mono" title={display}>
        {display}
      </span>
    </DataListCell>
  );
}
