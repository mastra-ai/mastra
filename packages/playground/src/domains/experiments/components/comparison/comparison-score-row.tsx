import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ScoreDelta } from './score-delta';

export interface ComparisonScoreRowProps {
  scorerId: string;
  value: number | null;
  /** Difference against the baseline. Rendered on the contender side only. */
  delta?: number | null;
  reason?: string | null;
}

/**
 * A single scorer line. Shared by the per-experiment averages and the per-item
 * scores so both read the same way: scorer link, value, then the delta.
 */
export function ComparisonScoreRow({ scorerId, value, delta, reason }: ComparisonScoreRowProps) {
  const { Link, paths } = useLinkComponent();

  return (
    <div className="grid gap-1 rounded-lg bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={paths.scorerLink(scorerId)}
          aria-label={`Open ${scorerId}`}
          className="flex min-w-0 items-center gap-1.5 text-subheading text-foreground hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
        >
          <ScorersIcon />
          <span className="min-w-0 truncate">{scorerId}</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-body text-muted-foreground tabular-nums">{value != null ? value.toFixed(2) : '-'}</span>
          {delta != null && <ScoreDelta delta={delta} />}
        </div>
      </div>
      {reason && <p className="text-body text-muted-foreground">{reason}</p>}
    </div>
  );
}
