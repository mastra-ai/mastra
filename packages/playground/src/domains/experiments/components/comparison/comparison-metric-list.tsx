import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { ScoreDelta } from './score-delta';

/** One measurable line: its value, and its trend against the baseline on contenders. */
export interface ComparisonMetric {
  id: string;
  /** Visual landmark in front of the key. */
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  /** Difference against the baseline. Null on the baseline, on descriptive lines, or when either side is unknown. */
  delta: number | null;
  formatDelta?: (absDelta: number) => string;
  higherIsBetter?: boolean;
}

/** Scorer key: links out to the scorer page. */
export function ScorerLabel({ scorerId }: { scorerId: string }) {
  const { Link, paths } = useLinkComponent();
  return (
    <Link
      href={paths.scorerLink(scorerId)}
      aria-label={`Open ${scorerId}`}
      className="min-w-0 truncate hover:text-foreground hover:underline"
    >
      {scorerId}
    </Link>
  );
}

/**
 * Key/value list of measurable figures. Values are the standout data of the page, so they
 * read bright; contenders get a trend against the baseline next to each value.
 */
export function ComparisonMetricList({ metrics }: { metrics: ComparisonMetric[] }) {
  if (metrics.length === 0) return null;

  const hasTrend = metrics.some(metric => metric.delta != null);

  return (
    <dl
      className={cn(
        'grid auto-rows-6 items-center gap-x-4 gap-y-1',
        hasTrend ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {metrics.map(({ id, icon, label, value, delta, formatDelta, higherIsBetter }) => (
        <Fragment key={id}>
          <dt className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0">
            {icon}
            {label}
          </dt>
          <dd className="flex min-w-0 justify-end text-right text-body-sm text-foreground tabular-nums">{value}</dd>
          {hasTrend && (
            <dd className="flex justify-end text-body-sm">
              {delta != null && <ScoreDelta delta={delta} format={formatDelta} higherIsBetter={higherIsBetter} />}
            </dd>
          )}
        </Fragment>
      ))}
    </dl>
  );
}
