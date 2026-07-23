import { useRef } from 'react';
import { DateRangeBoundaryPickers } from './DateRangeBoundaryPickers';
import { DateRangeTicks } from './DateRangeTicks';
import { DateRangeTrack } from './DateRangeTrack';
import { useDateRangeTimelineState } from './hooks/useDateRangeTimelineState';
import { createDateRangeAxisModel, createDateRangeBoundaryModel } from './lib/date-range-timeline-view-model';
import type { DateRangeValue } from './types';

interface DateRangeTimelineProps {
  value: DateRangeValue;
  min: string;
  max: string;
  onCommit: (value: DateRangeValue) => void;
}

export function DateRangeTimeline({ value, min, max, onCommit }: DateRangeTimelineProps) {
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
      // Clip keeps stray axis labels from causing horizontal scroll; the margin lets the edge
      // handles (and their focus ring) render fully instead of being sliced in half at min/max.
      className="w-full overflow-x-clip select-none [overflow-clip-margin:0.75rem]"
    >
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
