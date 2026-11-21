import type { GetTraceQueryFieldsResponse } from '@mastra/client-js';
import { resolveTracesSupport } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesExplorerDiscovery } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { callTool, ToolError } from '../../../shared/mcp-app';
import { DISCOVERY_STALE_TIME } from './list-observability-values';
import { toolRequest } from './tool-request';
import { useDiscoveryWindow } from './use-discovery-window';
import type { UseMcpTracesArgs } from './use-mcp-traces-args';
import { DISCOVERY_LIMIT, valuesResolver } from './values-resolver';

const NO_FIELDS = { observedFields: [], canonicalFields: [] } satisfies Pick<
  GetTraceQueryFieldsResponse,
  'observedFields' | 'canonicalFields'
>;

/** The metadata fields observed on traces in the selection's window, once the server discovers fields. */
export function useMcpTracesDiscovery({
  app,
  filters,
  capabilities,
  features,
}: UseMcpTracesArgs): TracesExplorerDiscovery {
  const { withDiscovery } = resolveTracesSupport(capabilities, features);
  const timeRange = useDiscoveryWindow(filters);
  const { data, isLoading } = useQuery({
    queryKey: ['mcp-trace-query-fields', timeRange],
    queryFn: () =>
      toolRequest<Pick<GetTraceQueryFieldsResponse, 'observedFields' | 'canonicalFields'>>(
        callTool(app, 'get_trace_query_fields', { timeRange, predicateScope: 'trace', limit: DISCOVERY_LIMIT }).catch(
          (error: unknown) => {
            // A store without discovery refuses the call; the filter bar then offers its fixed fields.
            if (error instanceof ToolError) return NO_FIELDS;
            throw error;
          },
        ),
      ),
    // A new window keeps the previous fields so the filter bar doesn't fall back to its skeleton.
    placeholderData: keepPreviousData,
    staleTime: DISCOVERY_STALE_TIME,
    retry: false,
    enabled: withDiscovery,
  });
  const observed = data?.observedFields;
  const fields = useMemo(
    () =>
      (observed ?? []).map(field => ({
        path: field.path,
        suggestions: valuesResolver(app, timeRange, 'trace', field.path),
      })),
    [observed, app, timeRange],
  );
  return { fields, canonicalFields: data?.canonicalFields ?? NO_FIELDS.canonicalFields, isLoading };
}
