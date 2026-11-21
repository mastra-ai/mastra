import { useObservabilityListFilters } from '@mastra/playground-ui/domains/observability/hooks/use-observability-list-filters';
import { SPAN_LIST_SORT_FIELDS } from '@mastra/playground-ui/domains/observability/observability-list-url-state';
import { buildSpanQueryWhere } from '@mastra/playground-ui/domains/spans/span-filters';
import {
  buildSpansListQuery,
  resolveSpansListView,
  resolveSpansSupport,
} from '@mastra/playground-ui/domains/spans/spans-explorer-support';
import type { TracesExplorerCapabilities } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useMemo } from 'react';
import { useMcpColumns } from './use-mcp-columns';
import { useMcpSpansFilterFields } from './use-mcp-spans-filter-fields';
import { useMcpSpansHistogram } from './use-mcp-spans-histogram';
import { useMcpSpansList } from './use-mcp-spans-list';

/**
 * Everything the spans explorer draws, through `query_spans`, `aggregate_spans` and the discovery tools, with its
 * filters held in memory. Spread the result into `SpansExplorerBody`.
 */
export function useMcpSpansExplorer(app: App, capabilities: TracesExplorerCapabilities) {
  const support = useMemo(() => resolveSpansSupport(capabilities), [capabilities]);
  const filters = useObservabilityListFilters(undefined, {
    sortFields: SPAN_LIST_SORT_FIELDS,
    withTokenSearch: support.withTokenSearch,
  });
  const columns = useMcpColumns('spans');
  const { timeRange, tokens, groups } = filters;

  const { sort } = resolveSpansListView(filters.sort, columns.preferences, support);
  const where = useMemo(() => buildSpanQueryWhere(tokens, groups, support), [tokens, groups, support]);
  const query = useMemo(
    () => buildSpansListQuery(timeRange, sort, where),
    // `sort` is rebuilt each render; its field and direction are what the query reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, sort.field, sort.direction, where],
  );

  const spans = useMcpSpansList({
    app,
    query,
    rolling: filters.rolling,
    fixedStart: filters.datePreset === 'custom',
    enabled: !support.isLoading,
  });
  const histogram = useMcpSpansHistogram({ app, timeRange, where, support });
  const filterFields = useMcpSpansFilterFields({
    app,
    capabilities,
    timeRange,
    withTokenSearch: support.withTokenSearch,
  });

  return { support, filters, columns, spans, histogram, filterFields };
}
