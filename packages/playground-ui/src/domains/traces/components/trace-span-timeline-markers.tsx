import { TimerIcon } from 'lucide-react';
import { TIMELINE_TRACK_PADDING } from '../utils/span-timeline';
import type { TimelineMarkersLayout, TimelineTimingBar } from '../utils/timeline-markers';
import { TimelineGridlines } from './span-timeline-row';
import { SPAN_TREE_INDENT, SPAN_TREE_LINE, SPAN_TREE_PAD_Y } from './span-tree-rail';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/duration';

// The panel sits in the timeline grid, so it spans both columns and hands them down to the rows.
const SUBGRID_PANEL_STYLE = { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'subgrid' } as const;

/** A "Metrics" row, closed by default, revealing one row per streaming timing laid out like the span rows. */
export function TimelineTimingRows({ layout }: { layout: TimelineMarkersLayout }) {
  return (
    <Collapsible className="col-span-2 grid grid-cols-subgrid">
      <div className="col-span-2 grid grid-cols-subgrid items-stretch">
        <div className="flex min-w-0 items-center pl-1" style={{ paddingBlock: SPAN_TREE_PAD_Y }}>
          <CollapsibleTrigger className="flex min-w-0 items-center rounded-sm text-muted-foreground">
            <span
              aria-hidden
              className="flex shrink-0 items-center justify-center"
              style={{ width: SPAN_TREE_INDENT, height: SPAN_TREE_LINE }}
            >
              <DisclosureChevron direction="right" className="size-3" />
            </span>
            <Txt as="span" variant="body-sm" className="min-w-0 truncate px-2">
              Metrics
            </Txt>
          </CollapsibleTrigger>
        </div>
        <div className={cn('flex min-w-0', TIMELINE_TRACK_PADDING)}>
          <div className="relative flex-1">
            <TimelineGridlines />
          </div>
        </div>
      </div>
      <CollapsibleContent style={SUBGRID_PANEL_STYLE} className="col-span-2 grid grid-cols-subgrid gap-y-px">
        <TimingRow name="Time to first chunk" bar={layout.firstChunk} />
        {layout.firstToken && <TimingRow name="Time to first token" bar={layout.firstToken} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TimingRow({ name, bar }: { name: string; bar: TimelineTimingBar }) {
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
