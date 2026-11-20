import {
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesExplorerFilterSuggestions } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { getSelectedEntityOption } from '@mastra/playground-ui/domains/traces/components/traces-explorer/traces-explorer-actions';
import type { TraceQueryRelatedScope } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import { useMemo } from 'react';
import { useDiscoveryWindow } from './use-discovery-window';
import { useMcpEntityNames } from './use-mcp-entity-names';
import { useMcpEnvironments } from './use-mcp-environments';
import type { UseMcpTracesArgs } from './use-mcp-traces-args';
import { valuesResolver } from './values-resolver';

/** The filter bar's suggestions: root entity names, environments and, with the trace query, field values. */
export function useMcpTracesFilterSuggestions({
  app,
  filters: rawFilters,
  capabilities,
  features,
}: UseMcpTracesArgs): TracesExplorerFilterSuggestions {
  const support = resolveTracesSupport(capabilities, features);
  const filters = sanitizeTracesFiltersFor(rawFilters, support);
  const { data: rootEntityNames } = useMcpEntityNames(app, {
    entityType: getSelectedEntityOption(filters.tokens)?.entityType,
    rootOnly: true,
  });
  const { data: environments } = useMcpEnvironments(app);
  const timeRange = useDiscoveryWindow(rawFilters);
  const resolveValues = useMemo(
    () =>
      support.withQueryTrace
        ? (scope: TraceQueryRelatedScope | 'trace', path: string) => valuesResolver(app, timeRange, scope, path)
        : undefined,
    [support.withQueryTrace, app, timeRange],
  );
  return { rootEntityNames, environments, resolveValues };
}
