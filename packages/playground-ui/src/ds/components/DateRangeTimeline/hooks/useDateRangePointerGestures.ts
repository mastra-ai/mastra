import { useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import type { DateBoundary, TimelineIndexRange, TimelineState } from '../lib/date-range-timeline';
import {
  getTimelineIndexAtClientX,
  getTimelineInteraction,
  resolveTimelineGestureSelection,
} from '../lib/date-range-timeline-interactions';
import type { TimelineInteraction, TimelinePointerGesture } from '../lib/date-range-timeline-interactions';
import { usePointerDrag } from './use-pointer-drag';

export type { TimelineInteraction } from '../lib/date-range-timeline-interactions';

interface TimelinePointerDrag {
  gesture: TimelinePointerGesture;
  currentSelection: TimelineIndexRange;
}

interface UseDateRangePointerGesturesInput {
  trackRef: RefObject<HTMLDivElement | null>;
  timeline: TimelineState;
  onSelectionPreview: (selection: TimelineIndexRange) => void;
  onSelectionCommit: (selection: TimelineIndexRange) => void;
  onSelectionCancel: () => void;
}

export function useDateRangePointerGestures({
  trackRef,
  timeline,
  onSelectionPreview,
  onSelectionCommit,
  onSelectionCancel,
}: UseDateRangePointerGesturesInput) {
  const [interaction, setInteraction] = useState<TimelineInteraction>();

  function getPointerIndex(clientX: number) {
    const track = trackRef.current?.getBoundingClientRect();
    return getTimelineIndexAtClientX(clientX, track, timeline.viewport);
  }

  function previewPointerDrag(drag: TimelinePointerDrag, event: PointerEvent<HTMLElement>) {
    const pointerIndex = getPointerIndex(event.clientX);
    const selection = resolveTimelineGestureSelection(drag.gesture, pointerIndex, timeline.viewport);
    drag.currentSelection = selection;
    onSelectionPreview(selection);
  }

  function commitPointerDrag(drag: TimelinePointerDrag, event: PointerEvent<HTMLElement>) {
    previewPointerDrag(drag, event);
    setInteraction(undefined);
    onSelectionCommit(drag.currentSelection);
  }

  function cancelPointerDrag() {
    setInteraction(undefined);
    onSelectionCancel();
  }

  const pointerDrag = usePointerDrag<TimelinePointerDrag>({
    onMove: previewPointerDrag,
    onEnd: commitPointerDrag,
    onCancel: cancelPointerDrag,
  });

  function beginPointerDrag(
    event: PointerEvent<HTMLDivElement>,
    gesture: TimelinePointerGesture,
    currentSelection: TimelineIndexRange,
  ) {
    const started = pointerDrag.startPointerDrag(event, { gesture, currentSelection });
    if (!started) return false;
    setInteraction(getTimelineInteraction(gesture));
    return true;
  }

  function startBrush(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startIndex = getPointerIndex(event.clientX);
    const selection = { from: startIndex, to: startIndex };
    const started = beginPointerDrag(
      event,
      {
        type: 'brush',
        startIndex,
      },
      selection,
    );
    if (!started) return;
    onSelectionPreview(selection);
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginPointerDrag(
      event,
      {
        type: 'pan',
        startIndex: getPointerIndex(event.clientX),
        originalSelection: timeline.selection,
      },
      timeline.selection,
    );
  }

  function startHandle(boundary: DateBoundary, event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginPointerDrag(
      event,
      {
        type: 'handle',
        boundary,
        originalSelection: timeline.selection,
      },
      timeline.selection,
    );
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    pointerDrag.handlePointerMove(event);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointerDrag.handlePointerUp(event);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    pointerDrag.handlePointerCancel(event);
  }

  function handleLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
    pointerDrag.handleLostPointerCapture(event);
  }

  return {
    interaction,
    startBrush,
    startPan,
    startHandle,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
  };
}
