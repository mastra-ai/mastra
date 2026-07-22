/**
 * The Metrics page's queue-health chart: one horizontal bar per board stage,
 * segmented left→right by age bucket (green → amber → orange → red) with width
 * proportional to how many work items sit in that cohort. A diagonal-stripe
 * overlay marks the right-anchored portion of each bar where an agent is
 * actively running. Clicking a segment (or focusing it and pressing
 * Enter/Space) selects that `(stage, bucket)` cohort so the page can list the
 * matching tasks; clicking the background or pressing Escape clears.
 *
 * Age is never signaled by color alone: each segment carries its bucket label
 * + count, the legend repeats label + threshold text, and the active overlay
 * is a stripe *pattern* (independent of the age colors) that is also labeled.
 */

import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useState } from 'react';

import { relativeTime } from '../../../../../shared/lib/date';
import type { AgeBucket, QueueHealth } from '../queue-health';
import { AGE_BUCKETS } from '../queue-health';
import { stageLabel } from '../stages';

/** Bucket colors (Tailwind palette) — order matches {@link AGE_BUCKETS}. */
const BUCKET_BAR: Record<AgeBucket, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};
const BUCKET_SWATCH: Record<AgeBucket, string> = BUCKET_BAR;

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

export interface QueueHealthSelection {
  stage: string;
  bucket: AgeBucket | null;
}

export interface QueueHealthChartProps {
  health: QueueHealth;
  /** Ordered age boundaries in seconds (for legend threshold text). */
  thresholdsSeconds: number[];
  /** Currently selected cohort (controlled by the page). */
  selected: QueueHealthSelection | null;
  onSelect: (selection: QueueHealthSelection | null) => void;
}

/** Human-readable age bound for the legend, e.g. 14400 → "4h". */
function boundLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/** Legend text for each bucket's age window, derived from the config. */
function bucketRangeLabel(bucket: AgeBucket, thresholds: number[]): string {
  const index = AGE_BUCKETS.indexOf(bucket);
  const lower = index === 0 ? 0 : thresholds[index - 1]!;
  const upper = thresholds[index];
  if (index === 0) return `< ${boundLabel(upper!)}`;
  if (upper === undefined) return `≥ ${boundLabel(lower)}`;
  return `${boundLabel(lower)}–${boundLabel(upper)}`;
}

export function QueueHealthChart({ health, thresholdsSeconds, selected, onSelect }: QueueHealthChartProps) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {health.stages.map(stage => (
          <StageBar key={stage.stage} stage={stage} selected={selected} onSelect={onSelect} />
        ))}
      </ul>
      <Legend thresholdsSeconds={thresholdsSeconds} />
    </div>
  );
}

function StageBar({
  stage,
  selected,
  onSelect,
}: {
  stage: QueueHealth['stages'][number];
  selected: QueueHealthSelection | null;
  onSelect: (selection: QueueHealthSelection | null) => void;
}) {
  const isEmpty = stage.total === 0;
  return (
    <li className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
      <Txt as="span" variant="ui-sm" className="text-icon4">
        {stageLabel(stage.stage)}
      </Txt>

      {isEmpty ? (
        <div className="flex h-5 items-center rounded-md border border-dashed border-border1 px-2">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            0
          </Txt>
        </div>
      ) : (
        // Bar background: clicking it clears any selection.
        <div
          role="presentation"
          className="relative flex h-5 overflow-hidden rounded-md bg-surface4"
          onClick={() => onSelect(null)}
        >
          {AGE_BUCKETS.map(bucket => {
            const count = stage.buckets[bucket];
            if (count === 0) return null;
            const isSelected = selected?.stage === stage.stage && selected.bucket === bucket;
            return (
              <button
                key={bucket}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${stageLabel(stage.stage)} ${BUCKET_LABEL[bucket]}: ${count}`}
                title={`${BUCKET_LABEL[bucket]} · ${count}`}
                style={{ flexGrow: count }}
                className={[
                  'h-full min-w-0 basis-0 cursor-pointer transition-[flex-grow] duration-300',
                  BUCKET_BAR[bucket],
                  isSelected ? 'opacity-100 ring-2 ring-inset ring-white/70' : 'opacity-90 hover:opacity-100',
                ].join(' ')}
                onClick={event => {
                  event.stopPropagation();
                  onSelect(isSelected ? null : { stage: stage.stage, bucket });
                }}
                onKeyDown={event => {
                  if (event.key === 'Escape') onSelect(null);
                }}
              >
                <span className="sr-only">
                  {count} {BUCKET_LABEL[bucket]}
                </span>
              </button>
            );
          })}

          {/* Active-work overlay: right-anchored, width ∝ activeCount. */}
          {stage.activeCount > 0 ? (
            <ActiveStripes key="active" stage={stage.stage} activeCount={stage.activeCount} total={stage.total} />
          ) : null}
        </div>
      )}

      <Txt as="span" variant="ui-xs" className="text-right text-icon3">
        {stage.total}
        {stage.activeCount > 0 ? ` · ${stage.activeCount} active` : ''}
      </Txt>
    </li>
  );
}

/**
 * Diagonal-stripe active-work marker. Width is proportional to the stage's
 * active share; the stripes drift left→right via the `queue-health-stripes`
 * keyframe, and the animation is disabled under `prefers-reduced-motion`.
 */
function ActiveStripes({ stage, activeCount, total }: { stage: string; activeCount: number; total: number }) {
  const reduceMotion = usePrefersReducedMotion();
  const widthPct = Math.max(2, Math.round((activeCount / total) * 100));
  return (
    <div
      role="img"
      aria-label={`${stageLabel(stage)}: ${activeCount} active`}
      title={`${activeCount} active`}
      style={{
        width: `${widthPct}%`,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 4px, transparent 4px 12px)',
        backgroundSize: '16px 16px',
      }}
      className={[
        'pointer-events-none absolute inset-y-0 right-0',
        reduceMotion ? '' : 'animate-queue-health-stripes',
      ].join(' ')}
    />
  );
}

/** True when the user asked for reduced motion; tracks the live media query. */
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

function Legend({ thresholdsSeconds }: { thresholdsSeconds: number[] }) {
  return (
    <div data-testid="queue-health-legend" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {AGE_BUCKETS.map(bucket => (
        <span key={bucket} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${BUCKET_SWATCH[bucket]}`} aria-hidden="true" />
          <Txt as="span" variant="ui-xs" className="text-icon3">
            {BUCKET_LABEL[bucket]} ({bucketRangeLabel(bucket, thresholdsSeconds)})
          </Txt>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.9) 0 2px, rgba(255,255,255,0.2) 2px 6px)',
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        />
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Active work
        </Txt>
      </span>
    </div>
  );
}

/** Humanize an entry's age in seconds for the drill-down list. */
export function formatAgeSeconds(ageSeconds: number): string {
  return relativeTime(new Date(Date.now() - ageSeconds * 1000).toISOString()) || 'just now';
}
