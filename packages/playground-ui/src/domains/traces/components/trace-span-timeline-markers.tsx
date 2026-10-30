import { TimerIcon } from 'lucide-react';
import { TIMELINE_TRACK_PADDING } from '../utils/span-timeline';
import type { TimelineMarkersLayout, TimelineTimingBar } from '../utils/timeline-markers';
import { TimelineGridlines } from './span-timeline-row';
import { SPAN_TREE_INDENT, SPAN_TREE_LINE, SPAN_TREE_PAD_Y } from './span-tree-rail';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/duration';

/** Dashed vertical line at the first chunk, drawn down the timing rows and every span row. */
export function FirstChunkLine({ percent }: { percent: number }) {
  return (
    <span
      aria-hidden
      data-testid="time-to-first-chunk-line"
      className="pointer-events-none absolute top-0 -bottom-px border-l border-dashed border-muted-foreground"
      style={{ left: `${percent}%` }}
    />
  );
}

/** One row per streaming timing, laid out like the span rows below them so they read the same way. */
export function TimelineTimingRows({ layout }: { layout: TimelineMarkersLayout }) {
  return (
    <>
      <TimingRow name="Time to first chunk" bar={layout.firstChunk} firstChunkPercent={layout.firstChunkPercent} />
      {layout.firstToken && (
        <TimingRow name="Time to first token" bar={layout.firstToken} firstChunkPercent={layout.firstChunkPercent} />
      )}
    </>
  );
}

function TimingRow({
  name,
  bar,
  firstChunkPercent,
}: {
  name: string;
  bar: TimelineTimingBar;
  firstChunkPercent: number;
}) {
  const { durationMs, leftPercent, widthPercent } = bar;

  return (
    <div role="group" aria-label={name} className="col-span-2 grid grid-cols-subgrid items-stretch">
      <div className="flex min-w-0 items-center pl-1" style={{ paddingBlock: SPAN_TREE_PAD_Y }}>
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-3.5"
          style={{ width: SPAN_TREE_INDENT, height: SPAN_TREE_LINE }}
        >
          <TimerIcon />
        </span>
        <Txt as="span" variant="body-sm" tone="muted" className="min-w-0 truncate px-2">
          {name}
        </Txt>
      </div>

      <div className={cn('flex min-w-0', TIMELINE_TRACK_PADDING)}>
        <div className="relative flex-1">
          <TimelineGridlines />
          <FirstChunkLine percent={firstChunkPercent} />
          <div
            data-testid="streaming-timing-bar"
            className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm border border-dashed border-muted-foreground bg-fill-subtle"
            style={{ left: `${leftPercent}%`, width: widthPercent ? `${widthPercent}%` : '2px' }}
          />
          <Txt
            as="span"
            variant="body-sm"
            tone="muted"
            className="absolute top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap tabular-nums"
            style={{ left: `${leftPercent + widthPercent}%` }}
          >
            {formatDuration(durationMs)}
          </Txt>
        </div>
      </div>
    </div>
  );
}
