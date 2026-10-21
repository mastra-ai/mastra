import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import { MAX_SPAN_MS, MIN_SPAN_MS, viewedDayLabel, zoomIn, zoomOut } from './timeViewport';
import type { TimeViewport, TimeWindow } from './timeViewport';

export function TimeControls({
  viewport,
  setViewport,
  window,
  nowMs,
}: {
  viewport: TimeViewport;
  setViewport: Dispatch<SetStateAction<TimeViewport>>;
  window: TimeWindow;
  nowMs: number;
}) {
  const dayLabel = viewedDayLabel(viewport, window, nowMs);
  return (
    <div role="group" aria-label="Zoom" className="flex min-w-0 items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        tooltip="Zoom out"
        disabled={viewport.spanMs >= MAX_SPAN_MS}
        onClick={() => setViewport(current => zoomOut(current, Date.now()))}
      >
        <ZoomOut />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        tooltip="Zoom in"
        disabled={viewport.spanMs <= MIN_SPAN_MS}
        onClick={() => setViewport(current => zoomIn(current, Date.now()))}
      >
        <ZoomIn />
      </Button>
      {dayLabel === undefined ? null : (
        <Txt as="span" variant="caption" tone="muted" className="ml-1 truncate">
          {dayLabel}
        </Txt>
      )}
    </div>
  );
}
