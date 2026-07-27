import type { KeyboardEvent } from 'react';
import type { DateBoundary, TimelineIndexRange } from '../lib/date-range-timeline';
import { moveTimelineSelectionFromKey, resizeTimelineSelectionFromKey } from '../lib/date-range-timeline-interactions';

interface UseDateRangeKeyboardControlsInput {
  selection: TimelineIndexRange;
  maximumIndex: number;
  onCommit: (selection: TimelineIndexRange) => void;
}

export function useDateRangeKeyboardControls({ selection, maximumIndex, onCommit }: UseDateRangeKeyboardControlsInput) {
  function handleSelectionKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nextSelection = moveTimelineSelectionFromKey(selection, event.key, maximumIndex);
    if (!nextSelection) return;

    event.preventDefault();
    onCommit(nextSelection);
  }

  function handleBoundaryKeyDown(boundary: DateBoundary, event: KeyboardEvent<HTMLDivElement>) {
    const nextSelection = resizeTimelineSelectionFromKey(selection, boundary, event.key, maximumIndex);
    if (!nextSelection) return;

    event.preventDefault();
    onCommit(nextSelection);
  }

  function handleFromKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    handleBoundaryKeyDown('from', event);
  }

  function handleToKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    handleBoundaryKeyDown('to', event);
  }

  return {
    handleSelectionKeyDown,
    handleFromKeyDown,
    handleToKeyDown,
  };
}
