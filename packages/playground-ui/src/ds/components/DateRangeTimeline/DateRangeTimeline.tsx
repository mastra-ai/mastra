import { useId, useRef } from 'react';
import { Txt } from '@/ds/components/Txt/Txt';
import { DateRangeBoundaryPickers } from './DateRangeBoundaryPickers';
import { DateRangeTicks } from './DateRangeTicks';
import { DateRangeTrack } from './DateRangeTrack';
import { useDateRangeTimelineState } from './hooks/useDateRangeTimelineState';
import {
  createDateRangeAxisModel,
  createDateRangeBoundaryModel,
} from './lib/date-range-timeline-view-model';
import type { DateRangeValue } from './types';

interface DateRangeTimelineProps {
  value: DateRangeValue;
  min: string;
  max: string;
  onCommit: (value: DateRangeValue) => void;
}

export function DateRangeTimeline({ value, min, max, onCommit }: DateRangeTimelineProps) {
  const hintId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const timeline = useDateRangeTimelineState({
    value,
    min,
    max,
    onCommit,
  });
  const boundaryModel = createDateRangeBoundaryModel(timeline.state);
  const axisModel = createDateRangeAxisModel(timeline.state);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Date range timeline"
      aria-describedby={hintId}
      className="w-full select-none overflow-x-clip"
    >
      <div className="flex min-h-6 items-start justify-between gap-4 pb-1">
        {/* TODO(ds): Txt needs a muted interaction-hint variant. */}
        <Txt id={hintId} as="span" variant="ui-sm" className="text-neutral3">
          Drag to select
        </Txt>
        <div className="flex items-center gap-2 text-neutral3">
          {/* TODO(ds): Txt needs a muted interaction-hint variant. */}
          <Txt as="span" variant="ui-sm" className="hidden text-neutral3 sm:inline">
            Drag range to move
          </Txt>
          <span className="hidden h-3 w-px bg-border2 sm:block" aria-hidden="true" />
          {/* TODO(ds): Txt needs a muted interaction-hint variant. */}
          <Txt as="span" variant="ui-sm" className="text-neutral3">
            Pinch to zoom
          </Txt>
        </div>
      </div>

      <DateRangeBoundaryPickers
        positions={boundaryModel.positions}
        value={boundaryModel.range}
        min={min}
        max={max}
        onSelect={timeline.selectDate}
      />

      <DateRangeTrack
        wheelTargetRef={rootRef}
        timeline={timeline.state}
        maximumIndex={timeline.maximumIndex}
        onSelectionPreview={timeline.previewSelection}
        onSelectionCommit={timeline.commitSelection}
        onSelectionCancel={timeline.cancelSelection}
        onZoom={timeline.zoom}
      />

      <DateRangeTicks ticks={axisModel.ticks} min={min} max={max} />
    </div>
  );
}
