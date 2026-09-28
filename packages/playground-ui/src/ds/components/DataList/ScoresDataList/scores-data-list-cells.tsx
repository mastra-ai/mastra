import { DataListCell } from '../data-list-cells';
import { formatDate } from '@/utils/date-format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DateCell
// ---------------------------------------------------------------------------

export interface ScoresDataListDateCellProps {
  timestamp: Date | string;
}

export function ScoresDataListDateCell({ timestamp }: ScoresDataListDateCellProps) {
  return <DataListCell className="text-muted-foreground">{formatDate(timestamp, 'date') ?? '-'}</DataListCell>;
}

// ---------------------------------------------------------------------------
// TimeCell
// ---------------------------------------------------------------------------

export interface ScoresDataListTimeCellProps {
  timestamp: Date | string;
}

export function ScoresDataListTimeCell({ timestamp }: ScoresDataListTimeCellProps) {
  return (
    <DataListCell className="text-body-sm text-muted-foreground">{formatDate(timestamp, 'time') ?? '-'}</DataListCell>
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
    <DataListCell>
      <span className="block max-w-full min-w-0 truncate font-mono text-body-sm text-muted-foreground" title={display}>
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
    <DataListCell>
      <span className="block max-w-full min-w-0 truncate text-body-sm" title={display}>
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
    <DataListCell>
      <span className="block max-w-full min-w-0 truncate font-mono text-body-sm text-muted-foreground" title={display}>
        {display}
      </span>
    </DataListCell>
  );
}
