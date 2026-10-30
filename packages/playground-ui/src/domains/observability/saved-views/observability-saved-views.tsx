import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { useMemo } from 'react';
import { useSavedViewsSource } from './saved-views-source';
import { useHostedSavedViews } from './use-hosted-saved-views';
import type { HostedSavedViewSettings, SavedViewColumnsControl } from './use-hosted-saved-views';
import { createLogsPropertyFilterFields } from '@/domains/logs/log-filters';
import { createSpanFilterBarFields } from '@/domains/spans/span-filters';
import { createThreadFilterBarFields } from '@/domains/threads/thread-filters';
import { TRACE_FILTER_BAR_OPERATORS, createTraceFilterBarFields } from '@/domains/traces/trace-filters';
import { dateRangePresetLabel } from '@/ds/components/DateTimeRangePicker/date-range-presets';
import type { FilterBarField } from '@/ds/components/FilterBar/types';
import { SavedViewEditor } from '@/ds/components/SavedViews/saved-view-editor';
import { SavedViewTabs } from '@/ds/components/SavedViews/saved-view-tabs';
import { Txt } from '@/ds/components/Txt';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';
import { cn } from '@/lib/utils';

const DEFAULT_LABELS: Record<SavedViewPage, string> = {
  traces: 'All traces',
  spans: 'All spans',
  threads: 'All threads',
  logs: 'All logs',
};

const STREAMING_FIELDS = { withTimeToFirstChunk: true, withTimeToFirstToken: true };

/** Every field a page can offer, so a saved filter's summary names its field. */
const pageFields = (page: SavedViewPage): FilterBarField[] => {
  switch (page) {
    case 'traces':
      return [
        ...createTraceFilterBarFields({
          availableRootEntityNames: [],
          availableEnvironments: [],
          withRootDuration: true,
          ...STREAMING_FIELDS,
        }),
        { id: 'tags', label: 'Tags' },
      ];
    case 'spans':
      return createSpanFilterBarFields({
        withContextFields: true,
        withOutcomeFields: true,
        entityNames: [],
        environments: [],
        ...STREAMING_FIELDS,
      });
    case 'threads':
      return createThreadFilterBarFields({ entityNames: [], environments: [], ...STREAMING_FIELDS });
    case 'logs':
      return createLogsPropertyFilterFields({
        availableTags: [],
        availableRootEntityNames: [],
        availableServiceNames: [],
        availableEnvironments: [],
      }).map(({ id, label }) => ({ id, label }));
  }
};

function formatDateRange(range: NonNullable<SavedViewState['dateRange']>): string {
  if ('preset' in range) return dateRangePresetLabel(range.preset) ?? range.preset;
  const format = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return range.to ? `${format(range.from)} – ${format(range.to)}` : `Since ${format(range.from)}`;
}

function SavedViewDetails({ state, scope }: HostedSavedViewSettings) {
  const groups = state.filters.filter(node => 'nodes' in node).length;
  const lines = [
    groups > 0 ? `+ ${groups} filter ${groups === 1 ? 'group' : 'groups'}` : undefined,
    state.dateRange ? `Time range: ${formatDateRange(state.dateRange)}` : undefined,
    state.sort
      ? `Sorted by ${state.sort.field}, ${state.sort.direction === 'asc' ? 'ascending' : 'descending'}`
      : undefined,
    scope === 'org' ? 'Shared with every project' : undefined,
  ].filter(line => line !== undefined);
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 border-t border-border pt-2">
      {lines.map(line => (
        <li key={line}>
          <Txt variant="caption" tone="muted">
            {line}
          </Txt>
        </li>
      ))}
    </ul>
  );
}

export type ObservabilitySavedViewsProps = {
  page: SavedViewPage;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
  /** The page's column picker (traces, spans, threads), so views save and restore columns. */
  columns?: SavedViewColumnsControl;
  className?: string;
};

/**
 * The saved views of an observability page as tabs, with save and reset actions. Renders nothing
 * unless a `SavedViewsProvider` above it supplies where views are stored.
 */
export function ObservabilitySavedViews(props: ObservabilitySavedViewsProps) {
  const context = useSavedViewsSource();
  if (!context) return null;
  return <HostedSavedViewsBar {...props} {...context} />;
}

function HostedSavedViewsBar({
  page,
  searchParams,
  setSearchParams,
  columns,
  className,
  source,
  queryKeyScope,
}: ObservabilitySavedViewsProps & NonNullable<ReturnType<typeof useSavedViewsSource>>) {
  const views = useHostedSavedViews({ page, source, queryKeyScope, searchParams, setSearchParams, columns });
  const fields = useMemo(() => pageFields(page), [page]);

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <SavedViewTabs
        views={views}
        fields={fields}
        operators={TRACE_FILTER_BAR_OPERATORS}
        defaultLabel={DEFAULT_LABELS[page]}
        aria-label="Saved views"
        newViewSettings={{ state: { schemaVersion: 1, page, filters: [] } }}
        describeSettings={settings => <SavedViewDetails {...settings} />}
        className="min-w-0 flex-1"
      />
      <SavedViewEditor views={views} />
    </div>
  );
}
