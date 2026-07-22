import { useRef, type PointerEvent, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { DateRangeHandle } from './DateRangeHandle';
import { DateRangeSelection } from './DateRangeSelection';
import { DateRangeTrackGrid } from './DateRangeTrackGrid';
import { useDateRangeKeyboardControls } from './hooks/useDateRangeKeyboardControls';
import { useDateRangePointerGestures } from './hooks/useDateRangePointerGestures';
import { useDateRangeWheelZoom } from './hooks/useDateRangeWheelZoom';
import type {
  TimelineIndexRange,
  TimelineState,
} from './lib/date-range-timeline';
import { createDateRangeGridMarkers } from './lib/date-range-timeline-grid';
import { createDateRangeTrackModel } from './lib/date-range-timeline-view-model';

interface DateRangeTrackProps {
  wheelTargetRef: RefObject<HTMLDivElement | null>;
  timeline: TimelineState;
  maximumIndex: number;
  onSelectionPreview: (selection: TimelineIndexRange) => void;
  onSelectionCommit: (selection: TimelineIndexRange) => void;
  onSelectionCancel: () => void;
  onZoom: (factor: number, anchor: number) => void;
}

export function DateRangeTrack({
  wheelTargetRef,
  timeline,
  maximumIndex,
  onSelectionPreview,
  onSelectionCommit,
  onSelectionCancel,
  onZoom,
}: DateRangeTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pointer = useDateRangePointerGestures({
    trackRef,
    timeline,
    onSelectionPreview,
    onSelectionCommit,
    onSelectionCancel,
  });
  const { handleSelectionKeyDown, handleFromKeyDown, handleToKeyDown } =
    useDateRangeKeyboardControls({
      selection: timeline.selection,
      maximumIndex,
      onCommit: onSelectionCommit,
    });

  useDateRangeWheelZoom({
    rootRef: wheelTargetRef,
    trackRef,
    disabled: pointer.interaction !== undefined,
    onZoom,
  });

  const model = createDateRangeTrackModel(timeline, maximumIndex);
  const gridMarkers = createDateRangeGridMarkers(timeline.viewport, timeline.selection);

  function startFromHandle(event: PointerEvent<HTMLDivElement>) {
    pointer.startHandle('from', event);
  }

  function startToHandle(event: PointerEvent<HTMLDivElement>) {
    pointer.startHandle('to', event);
  }

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label="Date range selection area"
      className={cn(
        'relative h-12 touch-none rounded-lg bg-surface4',
        pointer.interaction?.type === 'selecting' ? 'cursor-col-resize' : 'cursor-crosshair',
      )}
      onPointerDown={pointer.startBrush}
      onPointerMove={pointer.handlePointerMove}
      onPointerUp={pointer.handlePointerUp}
      onPointerCancel={pointer.handlePointerCancel}
      onLostPointerCapture={pointer.handleLostPointerCapture}
    >
      <DateRangeTrackGrid markers={gridMarkers} />
      <DateRangeSelection
        left={model.selection.left}
        width={model.selection.width}
        duration={model.selection.duration}
        active={pointer.interaction !== undefined}
        value={model.selection.value}
        valueText={model.selection.valueText}
        max={model.selection.max}
        onPointerDown={pointer.startPan}
        onKeyDown={handleSelectionKeyDown}
      />
      <DateRangeHandle
        boundary="from"
        position={model.handles.from.position}
        value={model.handles.from.value}
        valueText={model.handles.from.valueText}
        min={model.handles.from.min}
        max={model.handles.from.max}
        active={pointer.interaction?.type === 'resizing' && pointer.interaction.boundary === 'from'}
        onPointerDown={startFromHandle}
        onKeyDown={handleFromKeyDown}
      />
      <DateRangeHandle
        boundary="to"
        position={model.handles.to.position}
        value={model.handles.to.value}
        valueText={model.handles.to.valueText}
        min={model.handles.to.min}
        max={model.handles.to.max}
        active={pointer.interaction?.type === 'resizing' && pointer.interaction.boundary === 'to'}
        onPointerDown={startToHandle}
        onKeyDown={handleToKeyDown}
      />
    </div>
  );
}
