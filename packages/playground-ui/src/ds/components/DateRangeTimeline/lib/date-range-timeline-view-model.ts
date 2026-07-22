import { addDays } from 'date-fns';
import {
  buildTimelineTicks,
  formatDateRangeDuration,
  formatDateRangeValueText,
  getTimelinePosition,
  toDateRange,
  type TimelineState,
} from './date-range-timeline';

export function createDateRangeBoundaryModel(state: TimelineState) {
  const range = toDateRange(state);
  const fromPosition = getTimelinePosition(state.selection.from, state.viewport);
  const toPosition = getTimelinePosition(state.selection.to, state.viewport);

  return {
    positions: { from: fromPosition, to: toPosition },
    range,
  };
}

export function createDateRangeTrackModel(state: TimelineState, maximumIndex: number) {
  const range = toDateRange(state);
  const fromPosition = getTimelinePosition(state.selection.from, state.viewport);
  const toPosition = getTimelinePosition(state.selection.to, state.viewport);
  const span = state.selection.to - state.selection.from;

  return {
    handles: {
      from: {
        position: fromPosition,
        value: state.selection.from,
        valueText: range.from,
        min: 0,
        max: state.selection.to,
      },
      to: {
        position: toPosition,
        value: state.selection.to,
        valueText: range.to,
        min: state.selection.from,
        max: maximumIndex,
      },
    },
    selection: {
      left: fromPosition,
      width: Math.max(0, toPosition - fromPosition),
      duration: formatDateRangeDuration(range),
      value: state.selection.from,
      valueText: formatDateRangeValueText(range),
      max: maximumIndex - span,
    },
  };
}

export function createDateRangeAxisModel(state: TimelineState) {
  const visibleFrom = addDays(state.origin, state.viewport.from);
  const visibleTo = addDays(state.origin, state.viewport.to);
  return { ticks: buildTimelineTicks(visibleFrom, visibleTo) };
}
