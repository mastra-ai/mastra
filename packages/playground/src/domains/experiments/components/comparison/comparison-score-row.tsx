import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { ScoreDelta } from './score-delta';
import { useLinkComponent } from '@/lib/framework';

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
    <div className="bg-surface2 grid gap-1 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={paths.scorerLink(scorerId)}
          aria-label={`Open ${scorerId}`}
          className="text-neutral5 flex min-w-0 items-center gap-1.5 text-sm font-medium hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
        >
          <ScorersIcon />
          <span className="min-w-0 truncate">{scorerId}</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-neutral3 font-mono text-sm">{value != null ? value.toFixed(2) : '-'}</span>
          {delta != null && <ScoreDelta delta={delta} />}
        </div>
      </div>
      {reason && <p className="text-neutral3 text-sm">{reason}</p>}
    </div>
  );
}
