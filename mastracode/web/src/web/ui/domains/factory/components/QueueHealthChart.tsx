/**
 * Compact queue-health chart for the Metrics page. The primary bar summarizes
 * unique work items by their oldest active stage age. Stage totals stay visible
 * below it, while hover/focus cards progressively reveal the full breakdown.
 */

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

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

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

interface BucketSummary {
  count: number;
  activeCount: number;
}

interface ItemHealthSummary {
  bucket: AgeBucket;
  active: boolean;
}

export interface QueueHealthSelection {
  bucket: AgeBucket;
}

export interface QueueHealthChartProps {
  health: QueueHealth;
  /** Ordered age boundaries in seconds, shown in segment hover cards. */
  thresholdsSeconds: number[];
  /** Currently selected age cohort (controlled by the page). */
  selected: QueueHealthSelection | null;
  onSelect: (selection: QueueHealthSelection | null) => void;
}

/** Human-readable age bound, e.g. 14400 → "4h". */
function boundLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/** Age window for a bucket, derived from the project configuration. */
function bucketRangeLabel(bucket: AgeBucket, thresholds: number[]): string {
  const index = AGE_BUCKETS.indexOf(bucket);
  const lower = index === 0 ? 0 : thresholds[index - 1]!;
  const upper = thresholds[index];
  if (index === 0) return `Under ${boundLabel(upper!)}`;
  if (upper === undefined) return `${boundLabel(lower)} or more`;
  return `${boundLabel(lower)}–${boundLabel(upper)}`;
}

export function QueueHealthChart({ health, thresholdsSeconds, selected, onSelect }: QueueHealthChartProps) {
  const itemHealth = new Map<string, ItemHealthSummary>();
  for (const entry of health.entries) {
    const current = itemHealth.get(entry.itemId);
    const isOlder = current === undefined || AGE_BUCKETS.indexOf(entry.bucket) > AGE_BUCKETS.indexOf(current.bucket);
    itemHealth.set(entry.itemId, {
      bucket: isOlder ? entry.bucket : current.bucket,
      active: entry.active || current?.active === true,
    });
  }

  const buckets: Record<AgeBucket, BucketSummary> = {
    green: { count: 0, activeCount: 0 },
    amber: { count: 0, activeCount: 0 },
    orange: { count: 0, activeCount: 0 },
    red: { count: 0, activeCount: 0 },
  };
  for (const item of itemHealth.values()) {
    buckets[item.bucket].count += 1;
    if (item.active) buckets[item.bucket].activeCount += 1;
  }

  return (
    <div className="flex flex-col gap-5">
      {itemHealth.size === 0 ? (
        <div className="flex h-6 items-center justify-center rounded-md bg-surface4">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            No work in queue
          </Txt>
        </div>
      ) : (
        <div className="flex h-6 gap-1.5" aria-label="Queue age distribution">
          {AGE_BUCKETS.map(bucket => {
            const summary = buckets[bucket];
            if (summary.count === 0) return null;

            const isSelected = selected?.bucket === bucket;
            const range = bucketRangeLabel(bucket, thresholdsSeconds);
            const taskLabel = summary.count === 1 ? 'task' : 'tasks';

            return (
              <HoverCard key={bucket}>
                <HoverCardTrigger
                  delay={100}
                  closeDelay={0}
                  render={
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${BUCKET_LABEL[bucket]}: ${summary.count} ${taskLabel}, ${range.toLowerCase()}, ${summary.activeCount} active`}
                      style={{ flexGrow: summary.count }}
                      className={cn(
                        'h-full min-w-5 basis-0 cursor-pointer rounded-md outline-none transition-opacity duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-border2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface2',
                        BUCKET_BAR[bucket],
                        isSelected ? 'opacity-100 ring-2 ring-border2' : 'opacity-80 hover:opacity-100',
                      )}
                      onClick={() => onSelect(isSelected ? null : { bucket })}
                      onKeyDown={event => {
                        if (event.key === 'Escape') onSelect(null);
                      }}
                    />
                  }
                />
                <BucketHoverCard bucket={bucket} range={range} summary={summary} />
              </HoverCard>
            );
          })}
        </div>
      )}

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {health.stages.map(stage => (
          <StageSummaryRow key={stage.stage} stage={stage} thresholdsSeconds={thresholdsSeconds} />
        ))}
      </ul>
    </div>
  );
}

function BucketHoverCard({ bucket, range, summary }: { bucket: AgeBucket; range: string; summary: BucketSummary }) {
  return (
    <HoverCardContent side="top" align="center" className="w-48 border-border2 bg-surface3 p-3 shadow-none">
      <Txt as="p" variant="ui-sm" className="m-0 font-medium text-icon6">
        {BUCKET_LABEL[bucket]}
      </Txt>
      <Txt as="p" variant="ui-xs" className="mt-0.5 mb-0 text-icon3">
        {range}
      </Txt>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ui-xs">
        <dt className="text-icon3">Tasks</dt>
        <dd className="m-0 tabular-nums text-icon5">{summary.count}</dd>
        <dt className="text-icon3">Active</dt>
        <dd className="m-0 tabular-nums text-icon5">{summary.activeCount}</dd>
      </dl>
      <Txt as="p" variant="ui-xs" className="mt-2 mb-0 border-t border-border1 pt-2 text-icon3">
        Select to inspect tasks
      </Txt>
    </HoverCardContent>
  );
}

function StageSummaryRow({
  stage,
  thresholdsSeconds,
}: {
  stage: QueueHealth['stages'][number];
  thresholdsSeconds: number[];
}) {
  let oldestBucket: AgeBucket | null = null;
  for (const bucket of AGE_BUCKETS) {
    if (stage.buckets[bucket] > 0) oldestBucket = bucket;
  }

  const taskLabel = stage.total === 1 ? 'task' : 'tasks';
  const oldestLabel = oldestBucket ? `${BUCKET_LABEL[oldestBucket]}, ${bucketRangeLabel(oldestBucket, thresholdsSeconds)}` : 'Empty';

  return (
    <li>
      <HoverCard>
        <HoverCardTrigger
          delay={100}
          closeDelay={0}
          render={
            <div
              role="group"
              tabIndex={0}
              aria-label={`${stageLabel(stage.stage)}: ${stage.total} ${taskLabel}. Oldest work: ${oldestLabel}`}
              className="flex cursor-help items-center justify-between gap-4 rounded-md px-1 py-0.5 outline-none hover:bg-surface3 focus-visible:bg-surface3 focus-visible:ring-1 focus-visible:ring-border2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 shrink-0 rounded-full', oldestBucket ? BUCKET_BAR[oldestBucket] : 'bg-surface4')}
                />
                <Txt as="span" variant="ui-sm" className="truncate font-medium text-icon5">
                  {stageLabel(stage.stage)}
                </Txt>
              </span>
              <Txt as="span" variant="ui-sm" className="shrink-0 tabular-nums text-icon3">
                {stage.total} {taskLabel}
              </Txt>
            </div>
          }
        />
        <HoverCardContent side="right" align="center" className="w-52 border-border2 bg-surface3 p-3 shadow-none">
          <div className="flex items-baseline justify-between gap-4">
            <Txt as="p" variant="ui-sm" className="m-0 font-medium text-icon6">
              {stageLabel(stage.stage)}
            </Txt>
            <Txt as="span" variant="ui-xs" className="tabular-nums text-icon3">
              {stage.total} {taskLabel}
            </Txt>
          </div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-ui-xs">
            {AGE_BUCKETS.map(bucket =>
              stage.buckets[bucket] > 0 ? (
                <div key={bucket} className="col-span-2 grid grid-cols-subgrid">
                  <dt className="flex items-center gap-2 text-icon3">
                    <span aria-hidden="true" className={cn('size-2 rounded-full', BUCKET_BAR[bucket])} />
                    {BUCKET_LABEL[bucket]}
                  </dt>
                  <dd className="m-0 tabular-nums text-icon5">{stage.buckets[bucket]}</dd>
                </div>
              ) : null,
            )}
            <dt className="mt-1 border-t border-border1 pt-1 text-icon3">Active</dt>
            <dd className="mt-1 border-t border-border1 pt-1 text-right tabular-nums text-icon5">{stage.activeCount}</dd>
          </dl>
        </HoverCardContent>
      </HoverCard>
    </li>
  );
}

