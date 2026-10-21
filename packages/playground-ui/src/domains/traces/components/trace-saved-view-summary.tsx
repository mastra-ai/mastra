import { traceFiltersToFilterBarExpression, TRACE_FILTER_BAR_OPERATORS } from '../trace-filters';
import { TRACE_CUSTOM_COLUMN_LABELS, TRACE_OPTIONAL_COLUMN_LABELS } from '../trace-list-columns';
import type { TraceColumnPreferences } from '../trace-list-columns';
import { traceFiltersFromSavedView } from '../trace-saved-views';
import type { TraceSavedView, TraceSavedViewState } from '../trace-saved-views';
import type { TraceDatePreset } from '../types';
import { DEFAULT_TRACES_FILTERS } from './traces-explorer/traces-explorer-actions';
import type { TracesSortDirection } from './traces-explorer/traces-explorer-actions';
import { useTracesFilterBarFields } from './traces-explorer/use-traces-filter-bar';
import { SavedViewSummary, SavedViewSummaryFilters, SavedViewSummaryRow } from '@/ds/components/SavedViews';
import { formatDate, formatDateRange } from '@/utils/date-format';

const PRESET_LABELS: Record<TraceDatePreset, string> = {
  all: 'All time',
  'last-24h': 'Last 24 hours',
  'last-3d': 'Last 3 days',
  'last-7d': 'Last 7 days',
  'last-14d': 'Last 14 days',
  'last-30d': 'Last 30 days',
  custom: 'Custom range',
};

const SORT_LABELS: Record<TracesSortDirection, string> = { desc: 'Newest first', asc: 'Oldest first' };

const presetLabel = (preset: string) =>
  Object.entries(PRESET_LABELS).find(([value]) => value === preset)?.[1] ?? PRESET_LABELS.custom;

function timeRangeLabel({ preset, from, to }: TraceSavedViewState['timeRange']): string {
  if (preset !== 'custom') return presetLabel(preset);
  const range = formatDateRange(from, to);
  if (range) return range;
  const start = formatDate(from, 'date');
  if (start) return `Since ${start}`;
  const end = formatDate(to, 'date');
  return end ? `Until ${end}` : PRESET_LABELS.custom;
}

function columnsLabel(columns: TraceColumnPreferences): string {
  const labels = [
    ...columns.visibleColumns.map(column => TRACE_OPTIONAL_COLUMN_LABELS[column]),
    ...columns.customColumns.map(column => TRACE_CUSTOM_COLUMN_LABELS[column]),
    ...columns.metadataKeys,
  ];
  return labels.length > 0 ? labels.join(', ') : 'Standard columns only';
}

export type TraceSavedViewSummaryProps = {
  view: TraceSavedView;
};

/**
 * Hover preview of a saved traces view: its filters, as the filter bar shows them once the view is
 * applied, then its time range, sort and columns. Render it inside `TracesExplorer`.
 */
export function TraceSavedViewSummary({ view }: TraceSavedViewSummaryProps) {
  const fields = useTracesFilterBarFields();
  const { tokens, groups } = traceFiltersFromSavedView(view.state, DEFAULT_TRACES_FILTERS.datePreset).filters;
  const { nodes } = traceFiltersToFilterBarExpression(tokens, groups);
  return (
    <SavedViewSummary>
      <SavedViewSummaryFilters filters={nodes} fields={fields} operators={TRACE_FILTER_BAR_OPERATORS} />
      <SavedViewSummaryRow label="Time range" value={timeRangeLabel(view.state.timeRange)} />
      <SavedViewSummaryRow label="Sort" value={SORT_LABELS[view.state.sort.direction]} />
      <SavedViewSummaryRow label="Columns" value={columnsLabel(view.state.columns)} />
    </SavedViewSummary>
  );
}
