import type { KeyboardEvent, RefObject } from 'react';
import { clamp, useTimelineScrub } from '../hooks/use-timeline-scrub';
import type { TimelineRange } from '../hooks/use-timeline-scrub';
import { useTraceTimeCursor, useTraceTimeCursorStore } from '../hooks/use-trace-time-cursor';
import { TIMELINE_COLUMNS, TIMELINE_TRACK_PADDING } from '../utils/span-timeline';
import { Txt } from '@/ds/components/Txt';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/duration';

const percentAt = (t: number, { startMs, latency }: TimelineRange) =>
  latency ? clamp((t - startMs) / latency, 0, 1) * 100 : 0;

export type TimelineTimeCursorProps = {
  trackRef: RefObject<HTMLElement | null>;
  range: TimelineRange;
  /** Span starts and ends, ascending: the points arrow keys step between. */
  events: number[];
};

/**
 * Playhead over the timeline track: a line across every row and a slider handle on the axis.
 * The only part of the timeline that re-renders on every cursor move.
 */
export function TimelineTimeCursor({ trackRef, range, events }: TimelineTimeCursorProps) {
  const store = useTraceTimeCursorStore();
  const t = useTraceTimeCursor(value => value);
  const grab = useTimelineScrub(trackRef, range, 'grab');

  if (!store || !range.latency) return null;

  const endMs = range.startMs + range.latency;
  const current = t ?? endMs;
  const percent = percentAt(current, range);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    let next: number | null | undefined;
    if (event.key === 'ArrowLeft') next = events.findLast(e => e < current) ?? range.startMs;
    else if (event.key === 'ArrowRight') next = events.find(e => e > current) ?? endMs;
    else if (event.key === 'Home') next = range.startMs;
    else if (event.key === 'End' || event.key === 'Escape') next = null;
    if (next === undefined) return;
    event.preventDefault();
    store.set(next === null ? null : clamp(next, range.startMs, endMs));
  };

  return (
    // Absolutely positioned boxes can't be subgrids, so the overlay repeats the timeline's columns.
    <div className={cn('pointer-events-none absolute inset-0 grid py-1', TIMELINE_COLUMNS)}>
      <div className={cn('col-start-2 flex', TIMELINE_TRACK_PADDING)}>
        <div className="relative flex-1">
          {/* The playhead is always there (at the end while showing the full trace) and can be
              grabbed anywhere along its height: the grab area is wider than the line it draws. */}
          <div
            data-testid="timeline-time-cursor"
            {...grab}
            className="group pointer-events-auto absolute inset-y-0 flex w-4 -translate-x-1/2 cursor-ew-resize touch-none justify-center"
            style={{ left: `${percent}%` }}
          >
            <span
              aria-hidden
              className={cn(
                'w-px bg-info-indicator transition-[width,opacity] group-hover:w-0.5 group-hover:opacity-100 group-active:w-0.5 group-active:opacity-100',
                t == null && 'opacity-40',
              )}
            />
            <span
              role="slider"
              tabIndex={0}
              aria-label="Trace time cursor"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={Math.round(range.latency)}
              aria-valuenow={Math.round(current - range.startMs)}
              aria-valuetext={t == null ? 'Full trace' : formatDuration(current - range.startMs)}
              onKeyDown={onKeyDown}
              className={cn(
                'absolute top-1.5 size-3 rounded-full bg-info-indicator ring-2 ring-background transition-transform group-hover:scale-125 group-active:scale-125',
                focusRing,
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export type TimelineCursorReadoutProps = { range: TimelineRange };

/** Elapsed time at the cursor, shown only while scrubbing. */
export function TimelineCursorReadout({ range }: TimelineCursorReadoutProps) {
  const t = useTraceTimeCursor(value => value);
  if (t == null) return null;

  return (
    <Txt as="span" variant="meta" tone="muted" className="block pr-1 text-right tabular-nums">
      {formatDuration(t - range.startMs)}
    </Txt>
  );
}
