/* eslint-disable react-refresh/only-export-components */
import {
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_FIELD_ID,
  FILTER_BAR_TIME_RANGE_ITEM,
  FilterBarTimeRange,
} from '@/ds/components/FilterBar/filter-bar-time-range';
import type { FilterBarTimeRangeProps } from '@/ds/components/FilterBar/filter-bar-time-range';

/** @deprecated Use `FILTER_BAR_TIME_RANGE_FIELD_ID` from `@mastra/playground-ui/components/FilterBar`. */
export const TRACE_TIME_RANGE_FIELD_ID = FILTER_BAR_TIME_RANGE_FIELD_ID;

/** @deprecated Use `FILTER_BAR_TIME_RANGE_FIELD` from `@mastra/playground-ui/components/FilterBar`. */
export const TRACE_TIME_RANGE_FIELD = FILTER_BAR_TIME_RANGE_FIELD;

/** @deprecated Use `FILTER_BAR_TIME_RANGE_ITEM` from `@mastra/playground-ui/components/FilterBar`. */
export const TRACE_TIME_RANGE_ITEM = FILTER_BAR_TIME_RANGE_ITEM;

/** @deprecated Use `FilterBarTimeRangeProps` from `@mastra/playground-ui/components/FilterBar`. */
export type TraceTimeRangeChipProps = FilterBarTimeRangeProps;

/** @deprecated Use `FilterBar.TimeRange` from `@mastra/playground-ui/components/FilterBar`. */
export const TraceTimeRangeChip = FilterBarTimeRange;
