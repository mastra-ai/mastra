import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import type { TracesExplorerCapabilities } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useQuery } from '@tanstack/react-query';
import { callTool } from '../../../shared/mcp-app';
import { toAppCapabilities } from '../../../shared/mcp-tools';
import { toolRequest } from './tool-request';

// Capabilities only change with a server deploy, as in Studio's `useObservabilityCapabilities`.
const CAPABILITIES_STALE_TIME = 24 * 60 * 60 * 1000;

/** The server's capabilities as the app can use them, or none when this caller has no observability tools. */
export function useMcpCapabilities(app: App): TracesExplorerCapabilities {
  const { data, isLoading } = useQuery({
    queryKey: ['mcp-observability-capabilities'],
    queryFn: () =>
      toolRequest<unknown>(callTool(app, 'get_observability_capabilities', {})).then(
        result => toAppCapabilities(result) as GetObservabilityCapabilitiesResponse,
      ),
    staleTime: CAPABILITIES_STALE_TIME,
    retry: false,
  });
  return { data, isLoading };
}
