import type { TimelineMarkersLayout } from '../utils/timeline-markers';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';
import { formatDurationPrecise } from '@/utils/duration';

/** Labels flip to the other side of their anchor past this point, so they stay on the track. */
const FLIP_PERCENT = 60;

/** Dashed vertical line at the first chunk, drawn on the axis and on every row. */
export function FirstChunkLine({ percent }: { percent: number }) {
  return (
    <span
      aria-hidden
      data-testid="time-to-first-chunk-line"
      className="pointer-events-none absolute top-0 -bottom-px border-l border-dashed border-chart-blue"
      style={{ left: `${percent}%` }}
    />
  );
}

/** Axis lanes naming the markers: TTFC beside its line, TTFT beside the stretch leading to it. */
export function TimelineMarkersLanes({ layout }: { layout: TimelineMarkersLayout }) {
  const { timeToFirstChunkMs, firstChunkPercent, firstToken } = layout;
  const firstChunkLabel = formatDurationPrecise(timeToFirstChunkMs);
  const flipFirstChunk = firstChunkPercent > FLIP_PERCENT;

  return (
    <div className="relative tabular-nums">
      <FirstChunkLine percent={firstChunkPercent} />
      <div className="relative h-5">
        <Txt
          as="span"
          variant="meta"
          title="Time to first chunk"
          aria-label={`Time to first chunk: ${firstChunkLabel}`}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 px-1.5 whitespace-nowrap text-chart-blue',
            flipFirstChunk && '-translate-x-full',
          )}
          style={{ left: `${firstChunkPercent}%` }}
        >
          TTFC {firstChunkLabel}
        </Txt>
      </div>
      {firstToken && <FirstTokenLane {...firstToken} />}
    </div>
  );
}

function FirstTokenLane({
  timeToFirstTokenMs,
  leftPercent,
  widthPercent,
}: NonNullable<TimelineMarkersLayout['firstToken']>) {
  const label = formatDurationPrecise(timeToFirstTokenMs);
  // Prefer the label before the stretch; when that runs off the track, put it after the first chunk.
  const labelAfter = leftPercent < 100 - FLIP_PERCENT;

  return (
    <div className="relative h-5">
      <span
        aria-hidden
        data-testid="time-to-first-token-span"
        className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed border-chart-orange"
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
      />
      <Txt
        as="span"
        variant="meta"
        title="Time to first token"
        aria-label={`Time to first token: ${label}`}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 px-1.5 whitespace-nowrap text-chart-orange',
          !labelAfter && '-translate-x-full',
        )}
        style={{ left: `${labelAfter ? leftPercent + widthPercent : leftPercent}%` }}
      >
        TTFT {label}
      </Txt>
    </div>
  );
}
