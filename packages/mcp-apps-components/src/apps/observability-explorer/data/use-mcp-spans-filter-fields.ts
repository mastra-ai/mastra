import { FILTER_BAR_TIME_RANGE_FIELD } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField } from '@mastra/playground-ui/components/FilterBar';
import { withTokenSearchFields } from '@mastra/playground-ui/domains/observability/lib/token-search-predicate';
import { createSpanFilterBarFields } from '@mastra/playground-ui/domains/spans/span-filters';
import type { TracesExplorerCapabilities } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useMemo } from 'react';
import { NO_VALUES } from './list-observability-values';
import { useMcpEntityNames } from './use-mcp-entity-names';
import { useMcpEnvironments } from './use-mcp-environments';
import type { DiscoveryWindow } from './values-resolver';
import { valuesResolver } from './values-resolver';

export type UseMcpSpansFilterFieldsArgs = {
  app: App;
  capabilities: TracesExplorerCapabilities;
  timeRange: DiscoveryWindow;
  withTokenSearch: boolean;
};

/** The spans filter bar's fields: the time range plus the fields `query_spans` accepts, gated by capabilities. */
export function useMcpSpansFilterFields({
  app,
  capabilities,
  timeRange,
  withTokenSearch,
}: UseMcpSpansFilterFieldsArgs): FilterBarField[] {
  const flags = capabilities.data?.capabilities;
  const withContextFields = flags?.spanQueryContextFields ?? false;
  const withTimeToFirstChunk = flags?.traceQueryTimeToFirstChunk ?? false;
  const withTimeToFirstToken = flags?.traceQueryTimeToFirstToken ?? false;
  const withOutcomeFields = flags?.spanQueryOutcomeFields ?? false;
  const withModelFields = flags?.spanQueryModelFields ?? false;
  const { data: entityNames = NO_VALUES } = useMcpEntityNames(app);
  const { data: environments = NO_VALUES } = useMcpEnvironments(app);

  // Memoized for correctness: static suggestion lists become the value editor's Combobox `items`, which loops
  // if handed a new array on every render.
  return useMemo(
    () => [
      FILTER_BAR_TIME_RANGE_FIELD,
      ...withTokenSearchFields(
        createSpanFilterBarFields({
          withContextFields,
          withTimeToFirstChunk,
          withTimeToFirstToken,
          withOutcomeFields,
          withModelFields,
          entityNames,
          environments,
          valueSuggestions: path => valuesResolver(app, timeRange, 'spans', path),
        }),
        withTokenSearch,
      ),
    ],
    [
      withTokenSearch,
      withContextFields,
      withTimeToFirstChunk,
      withTimeToFirstToken,
      withOutcomeFields,
      withModelFields,
      entityNames,
      environments,
      app,
      timeRange,
    ],
  );
}
