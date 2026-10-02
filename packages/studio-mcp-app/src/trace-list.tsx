import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { FilterBar, isFilterBarGroup } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarExpression, FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useTraceQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { NoTracesInfo } from '@mastra/playground-ui/domains/traces/components/no-traces-info';
import { TraceColumnsMenu } from '@mastra/playground-ui/domains/traces/components/trace-columns-menu';
import {
  TRACE_TIME_RANGE_FIELD,
  TRACE_TIME_RANGE_FIELD_ID,
  TRACE_TIME_RANGE_ITEM,
  TraceTimeRangeChip,
} from '@mastra/playground-ui/domains/traces/components/trace-time-range-chip';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { TracesPageSkeleton } from '@mastra/playground-ui/domains/traces/components/traces-page-skeleton';
import { useEntityNames } from '@mastra/playground-ui/domains/traces/hooks/use-entity-names';
import { useEnvironments } from '@mastra/playground-ui/domains/traces/hooks/use-environments';
import { useTraceColumnPreferences } from '@mastra/playground-ui/domains/traces/hooks/use-trace-column-preferences';
import {
  createTraceQueryValuesResolver,
  useTraceMetadataFilterFields,
} from '@mastra/playground-ui/domains/traces/hooks/use-trace-metadata-filter-fields';
import { useTraceUrlState } from '@mastra/playground-ui/domains/traces/hooks/use-trace-url-state';
import { useTracesListSource } from '@mastra/playground-ui/domains/traces/hooks/use-traces-list-source';
import {
  buildTraceListFilters,
  createTraceFilterBarFields,
  filterBarExpressionToTraceFilters,
  TRACE_FILTER_BAR_OPERATORS,
  traceFiltersToFilterBarExpression,
  traceTokensToFilterBarItems,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import { isTraceUsageColumn } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import {
  buildTraceQueryRequest,
  clampTraceDiscoveryTimeRange,
} from '@mastra/playground-ui/domains/traces/trace-query-filters';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { useMastraClient } from '@mastra/react';
import { useState } from 'react';

const SORT_KEYS = ['startedAt'] as const;
const DEFAULT_SORT = { key: 'startedAt', direction: 'desc' } as const;

/** Studio's list controls and data source, without the sidebar or detail panels. */
export function TraceList() {
  const [params, setParams] = useState(() => new URLSearchParams());
  const url = useTraceUrlState(params, setParams);
  const { sort, onSortChange } = useUrlSort({
    searchParams: params,
    setSearchParams: setParams,
    allowedKeys: SORT_KEYS,
    defaultSort: DEFAULT_SORT,
  });
  const traceQuery = useTraceQueryAvailable();
  const { data: names = [] } = useEntityNames({ entityType: url.selectedEntityOption?.entityType, rootOnly: true });
  const { data: environments = [] } = useEnvironments();
  const [discoveryNow] = useState(() => new Date());
  const discoveryTimeRange = clampTraceDiscoveryTimeRange(
    buildTraceQueryRequest({
      dateFrom: url.selectedDateFrom,
      dateTo: url.selectedDateTo,
      tokens: [],
      now: discoveryNow,
    }).timeRange,
  );
  const { fields: metadataFields, isLoading: isDiscoveryLoading } = useTraceMetadataFilterFields({
    timeRange: discoveryTimeRange,
    enabled: traceQuery.enabled,
  });
  const client = useMastraClient();
  const fields = [
    TRACE_TIME_RANGE_FIELD,
    ...createTraceFilterBarFields({
      availableRootEntityNames: names,
      availableEnvironments: environments,
      metadataFields,
      withQueryTrace: traceQuery.enabled,
      valueSuggestions: traceQuery.enabled
        ? (scope, path) => createTraceQueryValuesResolver(client, discoveryTimeRange, scope, path)
        : undefined,
    }),
  ];
  const items = traceTokensToFilterBarItems(url.filterTokens);
  const expression = traceFiltersToFilterBarExpression([], url.filterGroups);
  const value: FilterBarExpression = { ...expression, nodes: [TRACE_TIME_RANGE_ITEM, ...items, ...expression.nodes] };
  function changeFilters(next: FilterBarExpression) {
    const { tokens, groups } = filterBarExpressionToTraceFilters({
      ...next,
      nodes: next.nodes.filter(node => isFilterBarGroup(node) || node.fieldId !== TRACE_TIME_RANGE_FIELD_ID),
    });
    url.handleFilterTokensChange(tokens, groups);
  }
  function changeFlatFilters(next: FilterBarItem[]) {
    changeFilters({ ...expression, nodes: next });
  }

  const source = useTracesListSource({
    rolling: !url.selectedDateTo,
    query: now =>
      buildTraceQueryRequest({
        rootEntityType: url.selectedEntityOption?.entityType,
        status: url.selectedStatus,
        dateFrom: url.selectedDateFrom,
        dateTo: url.selectedDateTo,
        tokens: url.filterTokens,
        groups: url.filterGroups,
        now,
      }),
    orderBy: [{ field: 'startedAt', direction: sort?.direction ?? 'desc' }],
    withQueryTrace: traceQuery.enabled,
    enabled: !traceQuery.isLoading,
    legacyFilters: buildTraceListFilters({
      rootEntityType: url.selectedEntityOption?.entityType,
      status: url.selectedStatus,
      dateFrom: url.selectedDateFrom,
      dateTo: url.selectedDateTo,
      tokens: url.filterTokens,
    }),
  });
  const columns = useTraceColumnPreferences();
  const preferences = {
    ...columns.preferences,
    visibleColumns: columns.preferences.visibleColumns.filter(column => !isTraceUsageColumn(column)),
  };
  const metadataKeys = [
    ...new Set(
      metadataFields
        .map(field => field.path.replace(/^metadata\./, '').split('.')[0])
        .filter((key): key is string => Boolean(key)),
    ),
  ].sort();
  const filtersApplied = Boolean(
    url.selectedEntityOption || url.selectedStatus || url.filterTokens.length || url.filterGroups.length,
  );

  const toolbar = (
    <ActionRow>
      <ActionRow.Start>
        <FilterBar
          fields={fields}
          operators={TRACE_FILTER_BAR_OPERATORS}
          {...(traceQuery.enabled
            ? { value, onValueChange: changeFilters }
            : { value: [TRACE_TIME_RANGE_ITEM, ...items], onValueChange: changeFlatFilters })}
          createItemId={fieldId => fieldId}
          maxDepth={3}
          aria-label="Trace filters"
          className="min-w-0 flex-1"
        >
          <FilterBar.Chips
            renderChip={item =>
              item.fieldId === TRACE_TIME_RANGE_FIELD_ID ? (
                <TraceTimeRangeChip
                  preset={url.datePreset}
                  onPresetChange={url.handleDatePresetChange}
                  dateFrom={url.selectedDateFrom}
                  dateTo={url.selectedDateTo}
                  onDateChange={url.handleDateChange}
                  onDateRangeChange={url.handleDateRangeChange}
                  presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
                />
              ) : (
                <FilterBar.Chip item={item} />
              )
            }
          />
          <FilterBar.Input placeholder="Filter traces…" />
        </FilterBar>
      </ActionRow.Start>
      <ActionRow.End>
        <TraceColumnsMenu
          preferences={preferences}
          availableMetadataKeys={metadataKeys}
          usageDisabledReason="Usage metrics are not included in this preview."
          withQueryTrace={traceQuery.enabled}
          onToggleColumn={columns.toggleColumn}
          onAddCustomColumn={columns.addCustomColumn}
          onRemoveCustomColumn={columns.removeCustomColumn}
          onAddMetadataColumn={columns.addMetadataColumn}
          onRemoveMetadataColumn={columns.removeMetadataColumn}
          onReset={columns.resetColumns}
        />
        <Field orientation="horizontal">
          <Checkbox checked={source.autoRefetch} onCheckedChange={checked => source.setAutoRefetch(checked === true)} />
          <FieldLabel>Auto refresh</FieldLabel>
        </Field>
      </ActionRow.End>
    </ActionRow>
  );

  if (traceQuery.isLoading || isDiscoveryLoading)
    return (
      <PageLayout>
        <TracesPageSkeleton columnPreferences={preferences} />
      </PageLayout>
    );

  return (
    <PageLayout actionRow={toolbar}>
      {source.error ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <EmptyState
            tone="error"
            titleSlot="Failed to load traces"
            descriptionSlot="Check the server URL and browser access (CORS). This preview connects to public servers without authentication."
          />
          <Button onClick={() => source.refetch()}>Retry</Button>
        </div>
      ) : !source.rows.length && !source.isLoading && !filtersApplied ? (
        <NoTracesInfo datePreset={url.datePreset} dateFrom={url.selectedDateFrom} dateTo={url.selectedDateTo} />
      ) : (
        <TracesListView
          traces={source.rows}
          isLoading={source.isLoading}
          isFetchingNextPage={source.isFetchingNextPage}
          hasNextPage={source.hasNextPage}
          setEndOfListElement={source.setEndOfListElement}
          filtersApplied={filtersApplied}
          columnPreferences={preferences}
          featuredTraceId={url.traceIdParam}
          onTraceClick={trace => url.handleTraceClick(trace.traceId)}
          createdSort={sort?.direction ?? 'desc'}
          onSortChange={onSortChange}
          onFilterByField={(fieldId, fieldValue) =>
            changeFilters({
              ...value,
              nodes: [
                ...items.filter(item => item.fieldId !== fieldId),
                { id: fieldId, fieldId, operatorId: 'is', value: fieldValue },
                ...expression.nodes,
              ],
            })
          }
        />
      )}
    </PageLayout>
  );
}
