import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SpansFilterBar } from '@mastra/playground-ui/domains/spans/components/spans-filter-bar';
import { buildSpanQueryWhere } from '@mastra/playground-ui/domains/spans/span-filters';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { resolveTracesDateWindow } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import type { TracesListViewTrace } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { resolveTraceQueryTimeRange } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterToken } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import type { TraceDatePreset } from '@mastra/playground-ui/domains/traces/types';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useQuerySpans } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs, SpanRow } from '@mastra/react/hooks/traces';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/spans')];

const DEFAULT_DATE_PRESET: TraceDatePreset = 'last-24h';

// `entityName` is left out: the list's Name column prefers it over `name`, which would label every
// span of an agent with the agent's name instead of the span's own name.
function toListRow(span: SpanRow): TracesListViewTrace {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    entityType: span.entityType,
    entityId: span.entityId,
    threadId: span.threadId,
    resourceId: span.resourceId,
    environment: span.environment,
    status: span.status,
    inputPreview: span.inputPreview,
    outputPreview: span.outputPreview ?? undefined,
    errorPreview: span.errorPreview ?? undefined,
    startedAt: span.startedAt,
    endedAt: span.endedAt,
    createdAt: span.startedAt,
  };
}

type DateState = { datePreset: TraceDatePreset; dateFrom?: Date; dateTo?: Date };

export function SpansPageContent() {
  const navigate = useNavigate();
  const [dates, setDates] = useState<DateState>({ datePreset: DEFAULT_DATE_PRESET });
  const [tokens, setTokens] = useState<TraceFilterToken[]>([]);
  const [groups, setGroups] = useState<TraceFilterGroup[]>([]);
  const [sort, setSort] = useState<DataListSort>('desc');

  const { data: capabilities } = useObservabilityCapabilities();
  const withContextFields = capabilities?.capabilities.spanQueryContextFields ?? false;

  const { datePreset, dateFrom, dateTo } = dates;
  const fromMs = dateFrom?.getTime();
  const toMs = dateTo?.getTime();
  // Rolling presets are resolved against "now" only when the range changes, so the query key
  // (and the cursors issued for it) stays stable while the list scrolls.
  const timeRange = useMemo(() => {
    const window = resolveTracesDateWindow(
      datePreset,
      fromMs === undefined ? undefined : new Date(fromMs),
      toMs === undefined ? undefined : new Date(toMs),
    );
    return resolveTraceQueryTimeRange(window.dateFrom, window.dateTo, new Date());
  }, [datePreset, fromMs, toMs]);

  const query = useMemo<SpanQueryArgs>(() => {
    const where = buildSpanQueryWhere(tokens, groups, { withContextFields });
    return { timeRange, orderBy: [{ field: 'startedAt', direction: sort }], ...(where ? { where } : {}) };
  }, [timeRange, sort, tokens, groups, withContextFields]);

  const { spans, hasNextPage, isFetchingNextPage, setEndOfListElement, isLoading, isError, error } = useQuerySpans({
    query,
  });

  // Switching to `custom` keeps the current dates so the picker opens on them; any other preset drops them.
  const handleDatePresetChange = (preset: TraceDatePreset) =>
    setDates(current => (preset === 'custom' ? { ...current, datePreset: preset } : { datePreset: preset }));
  // The picker can report a date right after switching away from `custom`; those are ignored.
  const handleDateChange = (date: Date | undefined, end: 'from' | 'to') =>
    setDates(current => {
      if (current.datePreset !== 'custom') return current;
      return end === 'from' ? { ...current, dateFrom: date } : { ...current, dateTo: date };
    });
  const handleDateRangeChange = (from: Date | undefined, to: Date | undefined) =>
    setDates(current => (current.datePreset === 'custom' ? { ...current, dateFrom: from, dateTo: to } : current));
  const handleFiltersChange = (nextTokens: TraceFilterToken[], nextGroups: TraceFilterGroup[]) => {
    setTokens(nextTokens);
    setGroups(nextGroups);
  };

  const handleSpanClick = (row: TracesListViewTrace) => {
    const params = new URLSearchParams({ traceId: row.traceId });
    if (row.spanId) params.set('spanId', row.spanId);
    void navigate(`/traces?${params.toString()}`);
  };

  const filtersApplied = tokens.length > 0 || groups.length > 0 || datePreset !== DEFAULT_DATE_PRESET;

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <SpansFilterBar
          datePreset={datePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          timeRange={timeRange}
          tokens={tokens}
          groups={groups}
          onDatePresetChange={handleDatePresetChange}
          onDateChange={handleDateChange}
          onDateRangeChange={handleDateRangeChange}
          onFiltersChange={handleFiltersChange}
          disabled={isLoading}
        />
      }
    >
      <h1 className="sr-only">Spans</h1>
      {isError ? (
        <div className="flex h-full items-center justify-center">
          <TracesErrorContent error={error} resource="spans" errorTitle="Failed to load spans" />
        </div>
      ) : (
        <TracesListView
          listId="all-spans"
          traces={(spans ?? []).map(toListRow)}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          setEndOfListElement={setEndOfListElement}
          filtersApplied={filtersApplied}
          isBranchesMode
          createdSort={sort}
          onSortChange={setSort}
          onTraceClick={handleSpanClick}
        />
      )}
    </PageLayout>
  );
}
