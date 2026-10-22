import { z } from 'zod/v4';
import { DEFAULT_TRACES_FILTERS } from './components/traces-explorer/traces-explorer-actions';
import type { TracesFilters, TracesSortDirection } from './components/traces-explorer/traces-explorer-actions';
import {
  filterBarItemsToTraceTokens,
  parseTraceFilterGroup,
  TRACE_DATE_PRESET_VALUES,
  traceTokensToFilterBarItems,
} from './trace-filters';
import { isTraceCustomColumn, isTraceOptionalColumn } from './trace-list-columns';
import type { TraceColumnPreferences } from './trace-list-columns';
import type { TraceDatePreset } from './types';
import { keyedColumnOrderSchema } from '@/ds/components/DataList/data-list-column-order';
import type { SavedViewContent } from '@/ds/components/SavedViews';
import { toDate } from '@/utils/date-format';

/** The `page` saved trace views are stored under. */
export const TRACE_SAVED_VIEWS_PAGE = 'traces';

/** The traces table setup: which columns show, and their order as column keys (see `buildTraceListColumnKeys`). */
export type TracesColumnsState = { preferences: TraceColumnPreferences; order: string[] };

/** What the traces explorer shows, and what a view puts back on it. */
export type TracesViewState = {
  filters: TracesFilters;
  sortDirection: TracesSortDirection;
  columns: TracesColumnsState;
};

// A time range this Studio doesn't offer opens on the explorer's default.
const toDatePreset = (preset: string): TraceDatePreset => {
  const known = [...TRACE_DATE_PRESET_VALUES].find(value => value === preset);
  return known && known !== 'all' ? known : DEFAULT_TRACES_FILTERS.datePreset;
};

/**
 * A saved trace view's settings, next to its flat filter chips: time range, AND/OR groups, sort
 * and columns. A value this Studio doesn't know falls back or is dropped, never the whole view.
 */
export const traceViewSettingsSchema = z.object({
  datePreset: z.string().transform(toDatePreset).catch(DEFAULT_TRACES_FILTERS.datePreset),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  groups: z
    .array(z.unknown())
    .transform(groups => groups.flatMap(group => parseTraceFilterGroup(group) ?? []))
    .catch([]),
  sortDirection: z.enum(['asc', 'desc']).catch('desc'),
  columns: z.object({
    visibleColumns: z.array(z.string()).transform(columns => columns.filter(isTraceOptionalColumn)),
    customColumns: z.array(z.string()).transform(columns => columns.filter(isTraceCustomColumn)),
    metadataKeys: z.array(z.string()),
    order: keyedColumnOrderSchema.catch([]),
  }),
});

export type TraceViewSettings = z.infer<typeof traceViewSettingsSchema>;

/** A view's filter chips and settings from what the explorer shows. */
export const toTraceViewContent = ({
  filters: { datePreset, dateFrom, dateTo, tokens, groups },
  sortDirection,
  columns: { preferences, order },
}: TracesViewState): SavedViewContent<TraceViewSettings> => ({
  filters: traceTokensToFilterBarItems(tokens),
  settings: {
    datePreset,
    dateFrom: dateFrom?.toISOString(),
    dateTo: dateTo?.toISOString(),
    groups,
    sortDirection,
    columns: {
      visibleColumns: [...preferences.visibleColumns],
      customColumns: [...preferences.customColumns],
      metadataKeys: [...preferences.metadataKeys],
      order,
    },
  },
});

/** What the explorer shows for a view. */
export const fromTraceViewContent = ({
  filters,
  settings: {
    datePreset,
    dateFrom,
    dateTo,
    groups,
    sortDirection,
    columns: { order, ...preferences },
  },
}: SavedViewContent<TraceViewSettings>): TracesViewState => ({
  filters: {
    datePreset,
    dateFrom: toDate(dateFrom),
    dateTo: toDate(dateTo),
    tokens: filterBarItemsToTraceTokens(filters),
    groups,
  },
  sortDirection,
  columns: { preferences, order },
});
