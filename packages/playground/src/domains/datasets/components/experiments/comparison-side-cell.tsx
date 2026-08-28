import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { ClockIcon } from 'lucide-react';
import type { ComparisonRow, ComparisonSide } from './build-comparison-rows';
import { ComparisonScoreRow } from './comparison-score-row';
import { ComparisonSection } from './comparison-section';

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

const codeBoxClass =
  'border-border1 bg-surface3 text-ui-md text-neutral4 max-h-[30vh] overflow-y-auto rounded-xl border p-4 font-mono break-all whitespace-pre-wrap dark:border-white/10 dark:bg-black/20';

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

  const outputStr = formatValue(data.output);

  return (
    <div className="grid content-start gap-5">
      {duration && (
        <Tooltip>
          <TooltipTrigger
            render={
              <p className="text-neutral3 flex items-center justify-end gap-1.5 text-sm [&>svg]:size-3.5">
                <ClockIcon />
                {duration}
              </p>
            }
          />
          <TooltipContent>Run duration</TooltipContent>
        </Tooltip>
      )}

      {data.error ? (
        <ComparisonSection title="Error" tone="negative" actions={<CopyButton content={data.error.message} />}>
          <p className="border-negative1/40 bg-negative1/5 text-ui-md text-neutral4 rounded-xl border p-4 break-words">
            {data.error.message}
          </p>
        </ComparisonSection>
      ) : (
        <ComparisonSection title="Output" actions={<CopyButton content={outputStr} />}>
          <pre className={codeBoxClass}>{outputStr}</pre>
        </ComparisonSection>
      )}

      {data.scores.length > 0 && (
        <ComparisonSection title="Scores">
          <div className="grid gap-2">
            {data.scores.map(score => (
              <ComparisonScoreRow
                key={score.scorerId}
                scorerId={score.scorerId}
                value={score.value}
                delta={showDeltas ? row.deltas[score.scorerId] : null}
                reason={score.reason}
              />
            ))}
          </div>
        </ComparisonSection>
      )}

      {data.comment && (
        <ComparisonSection title="Comment" defaultOpen={false}>
          <p className="text-neutral3 text-sm">{data.comment}</p>
        </ComparisonSection>
      )}

      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <ComparisonSection title="Metadata" defaultOpen={false}>
          <dl className="grid gap-1">
            {Object.entries(data.metadata).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4 text-sm">
                <dt className="text-neutral3">{key}</dt>
                <dd className="text-neutral5 font-mono break-all">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </ComparisonSection>
      )}
    </div>
  );
}
