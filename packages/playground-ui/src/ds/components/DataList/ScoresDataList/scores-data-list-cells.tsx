import { format, isToday } from 'date-fns';
import { DataListCell } from '../data-list-cells';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function formatScoreDateCellLabel(date: Date | null) {
  if (!date) {
    return '-';
  }
  if (isToday(date)) {
    return 'Today';
  }
  return format(date, 'MMM dd');
}

function formatScoreCellValue(score: unknown) {
  if (score == null) {
    return '-';
  }
  if (typeof score === 'object') {
    return JSON.stringify(score);
  }
  return String(score);
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
      {formatScoreDateCellLabel(date)}
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
  return (
    <DataListCell height="compact" className="min-w-0">
      <span className="block text-neutral3 text-ui-smd font-mono truncate">
        {input != null ? JSON.stringify(input) : '-'}
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
  return (
    <DataListCell height="compact" className="min-w-0">
      <span className="block text-ui-smd truncate">{entityId || '-'}</span>
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
  const display = formatScoreCellValue(score);
  return (
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3">
      {display}
    </DataListCell>
  );
}
