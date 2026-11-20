import type { GetTraceQueryValuesResponse } from '@mastra/client-js';
import type { TraceQueryRelatedScope } from '@mastra/playground-ui/domains/traces/trace-query-filters';
import type { TraceQueryValuesResolver } from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { callTool } from '../../../shared/mcp-app';
import { toolRequest } from './tool-request';

// Server caps discovery limits at 100 (TRACE_QUERY_DISCOVERY_MAX_LIMIT).
export const DISCOVERY_LIMIT = 100;

export type DiscoveryWindow = { from: string; to?: string };

/** A lazy value lookup for one field, through `get_trace_query_values`. */
export function valuesResolver(
  app: App,
  timeRange: DiscoveryWindow,
  predicateScope: TraceQueryRelatedScope | 'trace',
  path: string,
): TraceQueryValuesResolver {
  return async ({ query }) => {
    const { values } = await toolRequest<GetTraceQueryValuesResponse>(
      callTool(app, 'get_trace_query_values', {
        timeRange,
        predicateScope,
        path,
        search: query.trim() || undefined,
        limit: DISCOVERY_LIMIT,
      }),
    );
    return values.map(({ value }) => ({ value }));
  };
}
