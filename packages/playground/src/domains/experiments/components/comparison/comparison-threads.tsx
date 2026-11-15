import type { DatasetExperiment } from '@mastra/client-js';
import type { ComparisonRow } from './build-comparison-rows';
import { ComparisonSideTitle } from './comparison-side-header';
import { ComparisonThreadItem } from './comparison-thread-item';
import { columnLabel } from './constants';

/** A read-only view of the already-loaded comparison, with no playback or additional queries. */
export function ComparisonThreads({
  rows,
  columns,
  onSetBaseline,
}: {
  rows: ComparisonRow[];
  columns: { id: string; experiment?: DatasetExperiment }[];
  onSetBaseline?: (experimentId: string) => void;
}) {
  return (
    <div className="min-w-full" style={{ minWidth: `${columns.length * 22}rem` }}>
      <div
        className="sticky top-0 z-20 grid divide-x divide-border border-b border-border bg-background"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(22rem, 1fr))` }}
      >
        {columns.map((column, index) => (
          <div key={column.id} className="min-w-0 px-5 py-3">
            <ComparisonSideTitle
              role={index === 0 ? 'baseline' : 'contender'}
              label={columnLabel(index)}
              experiment={column.experiment}
              onSetBaseline={index > 0 && onSetBaseline ? () => onSetBaseline(column.id) : undefined}
            />
          </div>
        ))}
      </div>
      {rows.map((row, index) => (
        <ComparisonThreadItem key={row.itemId} row={row} itemNumber={index + 1} />
      ))}
    </div>
  );
}
