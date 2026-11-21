import type { App } from '@modelcontextprotocol/ext-apps';
import { useQuery } from '@tanstack/react-query';
import { DISCOVERY_STALE_TIME, listObservabilityValues } from './list-observability-values';

/** The environments seen in observability data. */
export function useMcpEnvironments(app: App) {
  return useQuery({
    queryKey: ['mcp-observability-environments'],
    queryFn: () => listObservabilityValues(app, 'environments'),
    staleTime: DISCOVERY_STALE_TIME,
    retry: false,
  });
}
