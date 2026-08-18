import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMemo, useState } from 'react';

import { relativeTime } from '../../../../lib/date';
import type { AgeBucket, QueueHealth, QueueHealthStage } from '../queue-health';
import { AGE_BUCKETS } from '../queue-health';
import { stageLabel } from '../stages';

// order matches AGE_BUCKETS
const BUCKET_COLOR: Record<AgeBucket, string> = {
  green: 'bg-queue-fresh',
  amber: 'bg-queue-aging',
  orange: 'bg-queue-stale',
  red: 'bg-queue-critical',
};

const BUCKET_LABEL: Record<AgeBucket, string> = {
  green: 'Fresh',
  amber: 'Aging',
  orange: 'Stale',
  red: 'Critical',
};

export interface QueueHealthSelection {
  /** `null` selects the cohort across every stage. */
  stage: string | null;
  bucket: AgeBucket;
}

/** `anchor` is the clicked cell, so the drill-down can open on it. */
export type QueueHealthSelect = (selection: QueueHealthSelection | null, anchor?: HTMLElement) => void;

export interface QueueHealthChartProps {
  health: QueueHealth;
  thresholdsSeconds: number[];
  selected: QueueHealthSelection | null;
  onSelect: QueueHealthSelect;
}

function boundLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function bucketRangeLabel(bucket: AgeBucket, thresholds: number[]): string {
  const index = AGE_BUCKETS.indexOf(bucket);
  const lower = index === 0 ? 0 : thresholds[index - 1]!;
  const upper = thresholds[index];
  if (index === 0) return `< ${boundLabel(upper!)}`;
  if (upper === undefined) return `≥ ${boundLabel(lower)}`;
  return `${boundLabel(lower)}–${boundLabel(upper)}`;
}

function taskCount(count: number): string {
  return `${count} ${count === 1 ? 'task' : 'tasks'}`;
}

function sameSelection(a: QueueHealthSelection | null, stage: string | null, bucket: AgeBucket): boolean {
  return a !== null && a.bucket === bucket && a.stage === stage;
}

export function QueueHealthChart({ health, thresholdsSeconds, selected, onSelect }: QueueHealthChartProps) {
  const [hovered, setHovered] = useState<AgeBucket | null>(null);

  const totals = useMemo(() => {
    const buckets: Record<AgeBucket, number> = { green: 0, amber: 0, orange: 0, red: 0 };
    let total = 0;
    for (const stage of health.stages) {
      for (const bucket of AGE_BUCKETS) buckets[bucket] += stage.buckets[bucket];
      total += stage.total;
    }
    return { buckets, total };
  }, [health.stages]);

  if (totals.total === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        Nothing in flight — the queue is clear.
      </Txt>
    );
  }

  const focused = hovered ?? selected?.bucket ?? null;
  const fade = (bucket: AgeBucket) => (focused !== null && focused !== bucket ? 'opacity-25' : 'opacity-100');

  return (
    <div
      className="flex flex-col gap-5"
      onKeyDown={event => {
        if (event.key === 'Escape') onSelect(null);
      }}
    >
      <div className="flex h-10 gap-1" onMouseLeave={() => setHovered(null)}>
        {AGE_BUCKETS.map(bucket => {
          const count = totals.buckets[bucket];
          if (count === 0) return null;
          return (
            <Segment
              key={bucket}
              bucket={bucket}
              count={count}
              stage={null}
              thresholdsSeconds={thresholdsSeconds}
              selected={selected}
              fade={fade(bucket)}
              onHover={setHovered}
              onSelect={onSelect}
              className="rounded-lg hover:-translate-y-0.5"
            />
          );
        })}
      </div>

      <Legend
        totals={totals}
        thresholdsSeconds={thresholdsSeconds}
        selected={selected}
        focused={focused}
        onHover={setHovered}
        onSelect={onSelect}
      />

      <ul className="border-border1 m-0 flex list-none flex-col border-t p-0 pt-3">
        {health.stages.map(stage => (
          <StageRow
            key={stage.stage}
            stage={stage}
            thresholdsSeconds={thresholdsSeconds}
            selected={selected}
            fade={fade}
            onHover={setHovered}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

function Segment({
  bucket,
  count,
  stage,
  thresholdsSeconds,
  selected,
  fade,
  onHover,
  onSelect,
  className,
}: {
  bucket: AgeBucket;
  count: number;
  stage: string | null;
  thresholdsSeconds: number[];
  selected: QueueHealthSelection | null;
  fade: string;
  onHover: (bucket: AgeBucket | null) => void;
  onSelect: QueueHealthSelect;
  className: string;
}) {
  const isSelected = sameSelection(selected, stage, bucket);
  const name =
    stage === null ? `${BUCKET_LABEL[bucket]}: ${count}` : `${stageLabel(stage)} ${BUCKET_LABEL[bucket]}: ${count}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-pressed={isSelected}
            aria-label={name}
            style={{ flexGrow: count }}
            onMouseEnter={() => onHover(bucket)}
            onFocus={() => onHover(bucket)}
            onBlur={() => onHover(null)}
            onClick={event => onSelect(isSelected ? null : { stage, bucket }, event.currentTarget)}
            className={[
              'focus-visible:outline-accent1 h-full min-w-1 basis-0 cursor-pointer transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2',
              BUCKET_COLOR[bucket],
              fade,
              isSelected ? 'outline-icon5 outline-2 outline-offset-2' : '',
              className,
            ].join(' ')}
          />
        }
      />
      <TooltipContent>
        {stage === null ? '' : `${stageLabel(stage)} · `}
        {BUCKET_LABEL[bucket]} · {taskCount(count)} · {bucketRangeLabel(bucket, thresholdsSeconds)}
      </TooltipContent>
    </Tooltip>
  );
}

function Legend({
  totals,
  thresholdsSeconds,
  selected,
  focused,
  onHover,
  onSelect,
}: {
  totals: { buckets: Record<AgeBucket, number>; total: number };
  thresholdsSeconds: number[];
  selected: QueueHealthSelection | null;
  focused: AgeBucket | null;
  onHover: (bucket: AgeBucket | null) => void;
  onSelect: QueueHealthSelect;
}) {
  return (
    <ul
      data-testid="queue-health-legend"
      className="m-0 grid list-none grid-cols-1 gap-x-4 gap-y-0.5 p-0 sm:grid-cols-2"
    >
      {AGE_BUCKETS.map(bucket => {
        const count = totals.buckets[bucket];
        const isSelected = sameSelection(selected, null, bucket);
        const share = Math.round((count / totals.total) * 100);
        return (
          <li key={bucket}>
            <button
              type="button"
              disabled={count === 0}
              aria-pressed={isSelected}
              onMouseEnter={() => onHover(bucket)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(bucket)}
              onBlur={() => onHover(null)}
              onClick={event => onSelect(isSelected ? null : { stage: null, bucket }, event.currentTarget)}
              className="group hover:bg-surface4 aria-pressed:bg-surface4 focus-visible:outline-accent1 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-40"
            >
              <span
                aria-hidden="true"
                className={[
                  'h-7 w-[3px] shrink-0 rounded-full transition-opacity duration-200',
                  BUCKET_COLOR[bucket],
                  focused !== null && focused !== bucket ? 'opacity-25' : 'opacity-100',
                ].join(' ')}
              />
              <span className="flex min-w-0 flex-col">
                <Txt as="span" variant="ui-xs" className="text-icon3 truncate">
                  {BUCKET_LABEL[bucket]} ({bucketRangeLabel(bucket, thresholdsSeconds)})
                </Txt>
                <Txt as="span" variant="ui-sm" className="text-icon5 font-medium tabular-nums">
                  {count}
                </Txt>
              </span>
              <span className="bg-surface4 text-ui-xs text-icon4 group-hover:bg-surface6 ml-auto shrink-0 rounded-full px-2 py-0.5 tabular-nums transition-colors">
                {share}%
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StageRow({
  stage,
  thresholdsSeconds,
  selected,
  fade,
  onHover,
  onSelect,
}: {
  stage: QueueHealthStage;
  thresholdsSeconds: number[];
  selected: QueueHealthSelection | null;
  fade: (bucket: AgeBucket) => string;
  onHover: (bucket: AgeBucket | null) => void;
  onSelect: QueueHealthSelect;
}) {
  return (
    <li className="hover:bg-surface4 grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-2 transition-colors">
      <Txt as="span" variant="ui-sm" className="text-icon4 truncate">
        {stageLabel(stage.stage)}
      </Txt>

      {stage.total === 0 ? (
        <div className="bg-surface4 h-2 rounded-full opacity-50" aria-hidden="true" />
      ) : (
        <div className="flex h-2 gap-0.5" onMouseLeave={() => onHover(null)}>
          {AGE_BUCKETS.map(bucket => {
            const count = stage.buckets[bucket];
            if (count === 0) return null;
            return (
              <Segment
                key={bucket}
                bucket={bucket}
                count={count}
                stage={stage.stage}
                thresholdsSeconds={thresholdsSeconds}
                selected={selected}
                fade={fade(bucket)}
                onHover={onHover}
                onSelect={onSelect}
                className="rounded-full hover:scale-y-150"
              />
            );
          })}
        </div>
      )}

      <span className="flex items-center justify-end gap-2">
        {stage.activeCount > 0 ? <ActivePulse stage={stage.stage} activeCount={stage.activeCount} /> : null}
        <Txt as="span" variant="ui-xs" className="text-icon3 w-6 text-right tabular-nums">
          {stage.total}
        </Txt>
      </span>
    </li>
  );
}

function ActivePulse({ stage, activeCount }: { stage: string; activeCount: number }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            tabIndex={0}
            aria-label={`${stageLabel(stage)}: ${activeCount} active`}
            className="bg-surface4 focus-visible:outline-accent1 inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 focus-visible:outline-2"
          >
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="bg-accent1 absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping" />
              <span className="bg-accent1 relative inline-flex size-1.5 rounded-full" />
            </span>
            <span className="text-ui-xs text-icon4 tabular-nums">{activeCount}</span>
          </span>
        }
      />
      <TooltipContent>
        {activeCount} {activeCount === 1 ? 'agent' : 'agents'} running
      </TooltipContent>
    </Tooltip>
  );
}

export function formatAgeSeconds(ageSeconds: number): string {
  return relativeTime(new Date(Date.now() - ageSeconds * 1000).toISOString()) || 'just now';
}
