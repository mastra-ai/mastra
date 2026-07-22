import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { DateRangeValue, DateRangeBounds } from '../types';

const API_DATE_FORMAT = 'yyyy-MM-dd';

export type DateBoundary = 'from' | 'to';

export interface TimelineIndexRange {
  from: number;
  to: number;
}

export interface TimelineState {
  origin: Date;
  viewport: TimelineIndexRange;
  selection: TimelineIndexRange;
}

export interface TimelineTick {
  date: string;
  label: string;
  position: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parseDate(value: string) {
  const date = parseISO(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(date)) return undefined;
  return format(date, API_DATE_FORMAT) === value ? date : undefined;
}

export function toDateRange(state: TimelineState): DateRangeValue {
  return {
    from: format(addDays(state.origin, state.selection.from), API_DATE_FORMAT),
    to: format(addDays(state.origin, state.selection.to), API_DATE_FORMAT),
  };
}

export function createTimelineState(value: DateRangeValue, min: Date, max: Date): TimelineState {
  const selectedFrom = parseDate(value.from) ?? min;
  const selectedTo = parseDate(value.to) ?? max;
  const absoluteSpan = Math.max(0, differenceInCalendarDays(max, min));
  if (absoluteSpan === 0) {
    return {
      origin: min,
      viewport: { from: 0, to: 0 },
      selection: { from: 0, to: 0 },
    };
  }

  const selectedFromIndex = clamp(differenceInCalendarDays(selectedFrom, min), 0, absoluteSpan);
  const selectedToIndex = clamp(differenceInCalendarDays(selectedTo, min), 0, absoluteSpan);

  return {
    origin: min,
    viewport: { from: 0, to: absoluteSpan },
    selection: {
      from: Math.min(selectedFromIndex, selectedToIndex),
      to: Math.max(selectedFromIndex, selectedToIndex),
    },
  };
}

export function zoomTimelineViewport(
  state: TimelineState,
  maximumIndex: number,
  factor: number,
  anchor: number,
): TimelineState {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return state;

  const boundedMaximum = Math.max(0, maximumIndex);
  const viewportSpan = state.viewport.to - state.viewport.from;
  const selectionSpan = state.selection.to - state.selection.from;
  const minimumViewportSpan = Math.max(selectionSpan, Math.min(1, boundedMaximum));
  const scaledSpan = clamp(Math.round(viewportSpan * factor), minimumViewportSpan, boundedMaximum);
  const nextSpan =
    scaledSpan === viewportSpan
      ? clamp(viewportSpan + (factor > 1 ? 1 : -1), minimumViewportSpan, boundedMaximum)
      : scaledSpan;
  if (nextSpan === viewportSpan) return state;

  const normalizedAnchor = Number.isFinite(anchor) ? clamp(anchor, 0, 1) : 0.5;
  const anchorIndex = state.viewport.from + viewportSpan * normalizedAnchor;
  const desiredFrom = Math.round(anchorIndex - nextSpan * normalizedAnchor);
  const earliestFrom = Math.max(0, state.selection.to - nextSpan);
  const latestFrom = Math.min(state.selection.from, boundedMaximum - nextSpan);
  const from = clamp(desiredFrom, earliestFrom, latestFrom);

  return {
    ...state,
    viewport: { from, to: from + nextSpan },
  };
}

export function revealTimelineSelection(
  viewport: TimelineIndexRange,
  selection: TimelineIndexRange,
  maximumIndex: number,
): TimelineIndexRange {
  const boundedMaximum = Math.max(0, maximumIndex);
  const selectionFrom = clamp(Math.min(selection.from, selection.to), 0, boundedMaximum);
  const selectionTo = clamp(Math.max(selection.from, selection.to), selectionFrom, boundedMaximum);
  const viewportSpan = clamp(viewport.to - viewport.from, 0, boundedMaximum);
  const viewportFrom = clamp(viewport.from, 0, boundedMaximum - viewportSpan);
  const normalizedViewport = { from: viewportFrom, to: viewportFrom + viewportSpan };
  const selectionSpan = selectionTo - selectionFrom;
  const nextSpan = Math.max(viewportSpan, selectionSpan);

  if (selectionFrom >= normalizedViewport.from && selectionTo <= normalizedViewport.to) {
    if (normalizedViewport.from === viewport.from && normalizedViewport.to === viewport.to) {
      return viewport;
    }
    return normalizedViewport;
  }

  const desiredFrom = selectionFrom < normalizedViewport.from ? selectionFrom : selectionTo - nextSpan;
  const from = clamp(desiredFrom, 0, boundedMaximum - nextSpan);
  return { from, to: from + nextSpan };
}

export function getTimelinePosition(index: number, viewport: TimelineIndexRange) {
  const viewportSpan = viewport.to - viewport.from;
  if (viewportSpan === 0) return 50;
  return ((index - viewport.from) / viewportSpan) * 100;
}

export function buildTimelineTickOffsets(span: number) {
  const boundedSpan = Math.max(0, Math.floor(span));
  const tickCount = boundedSpan === 0 ? 1 : Math.min(5, boundedSpan + 1);

  return Array.from({ length: tickCount }, (_, index) =>
    Math.round((boundedSpan * index) / Math.max(1, tickCount - 1)),
  );
}

export function buildTimelineTicks(domainFrom: Date, domainTo: Date): TimelineTick[] {
  const span = Math.max(0, differenceInCalendarDays(domainTo, domainFrom));
  const crossesYears = domainFrom.getFullYear() !== domainTo.getFullYear();

  return buildTimelineTickOffsets(span).map(dayOffset => {
    const date = addDays(domainFrom, dayOffset);
    const labelFormat = span > 365 || crossesYears ? 'MMM yyyy' : 'MMM d';

    return {
      label: format(date, labelFormat),
      date: format(date, API_DATE_FORMAT),
      position: span === 0 ? 50 : (dayOffset / span) * 100,
    };
  });
}

export function clampDateRangeToBounds(value: DateRangeValue, bounds: DateRangeBounds): DateRangeValue {
  const min = parseDate(bounds.min);
  const max = parseDate(bounds.max);
  if (!min || !max) return value;

  const from = parseDate(value.from) ?? min;
  const to = parseDate(value.to) ?? max;
  const clampedFrom = new Date(clamp(from.getTime(), min.getTime(), max.getTime()));
  const clampedTo = new Date(clamp(to.getTime(), clampedFrom.getTime(), max.getTime()));

  return {
    from: format(clampedFrom, API_DATE_FORMAT),
    to: format(clampedTo, API_DATE_FORMAT),
  };
}

export function getDateRangeBounds(createdAt: string, today: string): DateRangeBounds {
  const max = parseDate(today) ?? new Date();
  const created = parseDate(createdAt) ?? max;
  const min = created > max ? max : created;
  return {
    min: format(min, API_DATE_FORMAT),
    max: format(max, API_DATE_FORMAT),
  };
}

export function formatDateRangeDuration(value: DateRangeValue) {
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  if (!from || !to) return '';
  const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatDateRangeValueText(value: DateRangeValue) {
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  if (!from || !to) return `${value.from} through ${value.to}`;
  return `${format(from, 'MMMM d, yyyy')} through ${format(to, 'MMMM d, yyyy')}`;
}
