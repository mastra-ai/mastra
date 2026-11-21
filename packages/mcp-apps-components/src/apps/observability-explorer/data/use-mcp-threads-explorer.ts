import { FILTER_BAR_TIME_RANGE_FIELD } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';
import { useObservabilityListFilters } from '@mastra/playground-ui/domains/observability/hooks/use-observability-list-filters';
import {
  buildThreadQueryWhere,
  createThreadFilterBarFields,
} from '@mastra/playground-ui/domains/threads/thread-filters';
import {
  buildThreadsListQuery,
  resolveThreadsSupport,
} from '@mastra/playground-ui/domains/threads/threads-explorer-data';
import type { TracesExplorerCapabilities } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useMemo } from 'react';
import { NO_VALUES } from './list-observability-values';
import { useMcpColumns } from './use-mcp-columns';
import { useMcpEntityNames } from './use-mcp-entity-names';
import { useMcpEnvironments } from './use-mcp-environments';
import { useMcpThreadsList } from './use-mcp-threads-list';

/**
 * Everything the threads explorer draws, through `query_threads` and the discovery tools, with its filters held
 * in memory. Spread the result into `ThreadsExplorerBody`.
 */
export function useMcpThreadsExplorer(app: App, capabilities: TracesExplorerCapabilities) {
  const support = useMemo(() => resolveThreadsSupport(capabilities), [capabilities]);
  const filters = useObservabilityListFilters();
  const columns = useMcpColumns('threads');
  const { timeRange, tokens, groups, sort } = filters;

  const query = useMemo(
    () => buildThreadsListQuery(timeRange, sort.direction, buildThreadQueryWhere(tokens, groups, support)),
    [timeRange, sort.direction, tokens, groups, support],
  );
  const threads = useMcpThreadsList({
    app,
    query,
    rolling: filters.rolling,
    fixedStart: filters.datePreset === 'custom',
    enabled: !support.isLoading,
  });

  const flags = capabilities.data?.capabilities;
  const withTimeToFirstChunk = flags?.traceQueryTimeToFirstChunk ?? false;
  const withTimeToFirstToken = flags?.traceQueryTimeToFirstToken ?? false;
  const { data: entityNames = NO_VALUES } = useMcpEntityNames(app);
  const { data: environments = NO_VALUES } = useMcpEnvironments(app);
  const filterFields = useMemo<FilterBarField[]>(
    () => [
      FILTER_BAR_TIME_RANGE_FIELD,
      ...createThreadFilterBarFields({ withTimeToFirstChunk, withTimeToFirstToken, entityNames, environments }),
    ],
    [withTimeToFirstChunk, withTimeToFirstToken, entityNames, environments],
  );

  return { support, filters, columns, threads, filterFields };
}
