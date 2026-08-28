import { Notice } from '@mastra/playground-ui/components/Notice';
import { Sections } from '@mastra/playground-ui/components/Sections';
import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { FileOutputIcon } from 'lucide-react';
import type { ComparisonRow, ComparisonSide } from './build-comparison-rows';
import { ScoreDelta } from './score-delta';

export interface ComparisonSideCellProps {
  side: 'baseline' | 'contender';
  row: ComparisonRow;
  /** Only the contender renders deltas, so a difference is stated once. */
  showDeltas?: boolean;
  isLoading?: boolean;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function formatDuration(side: ComparisonSide): string | null {
  if (!side.startedAt || !side.completedAt) return null;
  const ms = new Date(side.completedAt).getTime() - new Date(side.startedAt).getTime();
  return Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)}s` : null;
}

/**
 * One side of a single item row. Baseline and contender render the exact same
 * sections in the same order so the row can be read as a visual diff.
 */
export function ComparisonSideCell({ side, row, showDeltas, isLoading }: ComparisonSideCellProps) {
  const data = row[side];
  const duration = formatDuration(data);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data.present) {
    return <p className="text-neutral3 py-8 text-center text-sm">Not present in this experiment</p>;
  }

  return (
    <Sections className="gap-5">
      {duration && <p className="text-neutral3 text-sm">Ran in {duration}</p>}

      {data.error ? (
        <Notice variant="destructive" title="Run failed">
          <Notice.Message>{data.error.message}</Notice.Message>
        </Notice>
      ) : (
        <SideDialog.CodeSection
          title="Output"
          icon={<FileOutputIcon />}
          codeStr={formatValue(data.output)}
          simplified
        />
      )}

      {data.scores.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-neutral5 text-sm font-medium">Scores</h4>
          {data.scores.map(score => (
            <div key={score.scorerId} className="bg-surface2 grid gap-1 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral5 text-sm font-medium">{score.scorerId}</span>
                <div className="flex items-center gap-3">
                  <span className="text-neutral3 font-mono text-sm">
                    {score.value != null ? score.value.toFixed(2) : '-'}
                  </span>
                  {showDeltas && row.deltas[score.scorerId] != null && (
                    <ScoreDelta delta={row.deltas[score.scorerId] as number} />
                  )}
                </div>
              </div>
              {score.reason && <p className="text-neutral3 text-sm">{score.reason}</p>}
            </div>
          ))}
        </div>
      )}

      {data.comment && (
        <div className="grid gap-1">
          <h4 className="text-neutral5 text-sm font-medium">Comment</h4>
          <p className="text-neutral3 text-sm">{data.comment}</p>
        </div>
      )}

      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <div className="grid gap-1">
          <h4 className="text-neutral5 text-sm font-medium">Metadata</h4>
          <dl className="grid gap-1">
            {Object.entries(data.metadata).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4 text-sm">
                <dt className="text-neutral3">{key}</dt>
                <dd className="text-neutral5 font-mono break-all">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Sections>
  );
}
