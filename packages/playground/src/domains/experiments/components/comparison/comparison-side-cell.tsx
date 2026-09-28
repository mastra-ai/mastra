import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
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

function sideDuration(side: ComparisonSide): string | null {
  if (!side.startedAt || !side.completedAt) return null;
  const ms = new Date(side.completedAt).getTime() - new Date(side.startedAt).getTime();
  return formatDuration(ms) ?? null;
}

const codeBoxClass = cn(
  raisedSurfaceStyle,
  'max-h-[30vh] overflow-y-auto rounded-xl p-4 text-body break-all whitespace-pre-wrap text-muted-foreground',
);

/**
 * One side of a single item row. Baseline and contender render the exact same
 * sections in the same order so the row can be read as a visual diff.
 */
export function ComparisonSideCell({ side, row, showDeltas, isLoading }: ComparisonSideCellProps) {
  const data = row[side];
  const duration = sideDuration(data);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data.present) {
    return <p className="py-5 text-center text-body text-muted-foreground">Not present in this experiment</p>;
  }

  const outputStr = formatValue(data.output);

  return (
    <div className="grid content-start gap-5">
      {duration && (
        <Tooltip>
          <TooltipTrigger
            render={
              <p className="flex items-center justify-end gap-1.5 text-body text-muted-foreground [&>svg]:size-3.5">
                <ClockIcon />
                <Txt as="span" variant="body" font="mono">
                  {duration}
                </Txt>
              </p>
            }
          />
          <TooltipContent>Run duration</TooltipContent>
        </Tooltip>
      )}

      {data.error ? (
        <ComparisonSection title="Error" tone="negative" actions={<CopyButton content={data.error.message} />}>
          <p className="rounded-xl border border-negative1/40 bg-negative1/5 p-4 text-body break-words text-muted-foreground">
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
          <p className="text-body text-muted-foreground">{data.comment}</p>
        </ComparisonSection>
      )}

      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <ComparisonSection title="Metadata" defaultOpen={false}>
          <dl className="grid gap-1">
            {Object.entries(data.metadata).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4 text-body">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="break-all text-foreground">
                  <Txt as="span" variant="body" font="mono">
                    {formatValue(value)}
                  </Txt>
                </dd>
              </div>
            ))}
          </dl>
        </ComparisonSection>
      )}
    </div>
  );
}
