import { addDays, differenceInCalendarDays } from 'date-fns';
import { useState } from 'react';
import {
  clamp,
  createTimelineState,
  parseDate,
  revealTimelineSelection,
  toDateRange,
  zoomTimelineViewport,
} from '../lib/date-range-timeline';
import type { DateBoundary, TimelineIndexRange } from '../lib/date-range-timeline';
import type { DateRangeValue } from '../types';

interface UseDateRangeTimelineStateInput {
  value: DateRangeValue;
  min: string;
  max: string;
  onCommit: (value: DateRangeValue) => void;
}

function resolveTimelineBounds(min: string, max: string) {
  const fallbackMax = new Date();
  const maxDate = parseDate(max) ?? fallbackMax;
  const requestedMin = parseDate(min) ?? addDays(maxDate, -365);
  const minDate = requestedMin > maxDate ? maxDate : requestedMin;
  return { minDate, maxDate };
}

export function useDateRangeTimelineState({ value, min, max, onCommit }: UseDateRangeTimelineStateInput) {
  const { minDate, maxDate } = resolveTimelineBounds(min, max);
  const committedTimeline = createTimelineState(value, minDate, maxDate);
  const maximumIndex = Math.max(0, differenceInCalendarDays(maxDate, minDate));
  const [viewport, setViewport] = useState(() => committedTimeline.viewport);
  const [draftSelection, setDraftSelection] = useState<TimelineIndexRange>();
  const selection = draftSelection ?? committedTimeline.selection;
  const state = {
    ...committedTimeline,
    viewport: revealTimelineSelection(viewport, selection, maximumIndex),
    selection,
  };

  function previewSelection(nextSelection: TimelineIndexRange) {
    setDraftSelection(nextSelection);
  }

  function cancelSelection() {
    setDraftSelection(undefined);
  }

  function commitSelection(nextSelection: TimelineIndexRange) {
    setDraftSelection(undefined);
    setViewport(current => revealTimelineSelection(current, nextSelection, maximumIndex));
    onCommit(toDateRange({ ...state, selection: nextSelection }));
  }

  function zoom(factor: number, anchor: number) {
    setViewport(current => {
      const visibleViewport = revealTimelineSelection(current, state.selection, maximumIndex);
      return zoomTimelineViewport({ ...state, viewport: visibleViewport }, maximumIndex, factor, anchor).viewport;
    });
  }

  function selectDate(boundary: DateBoundary, nextValue: string) {
    const date = parseDate(nextValue);
    if (!date) return;

    const dateIndex = clamp(differenceInCalendarDays(date, state.origin), 0, maximumIndex);
    const nextSelection =
      boundary === 'from'
        ? {
            from: clamp(dateIndex, 0, state.selection.to),
            to: state.selection.to,
          }
        : {
            from: state.selection.from,
            to: clamp(dateIndex, state.selection.from, maximumIndex),
          };
    commitSelection(nextSelection);
  }

  return {
    state,
    maximumIndex,
    previewSelection,
    cancelSelection,
    commitSelection,
    zoom,
    selectDate,
  };
}
