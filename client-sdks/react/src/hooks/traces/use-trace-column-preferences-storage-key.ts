import { useMastraClient } from '../../mastra-client-context';

export type TraceColumnPreferencesScope = 'traces' | 'spans';

/**
 * Storage key for the trace list column preferences, scoped to the Mastra server the client
 * talks to so each project keeps its own column layout, and to the list (traces or spans)
 * so each list keeps its own selection.
 */
export function useTraceColumnPreferencesStorageKey(scope: TraceColumnPreferencesScope = 'traces'): string {
  const client = useMastraClient();
  const projectUrl =
    client.options.baseUrl || (typeof window === 'undefined' ? 'local' : window.location.origin || 'local');
  const apiPrefix = client.options.apiPrefix ?? '/api';
  return `mastra:${scope}:columns:${projectUrl}:${apiPrefix}`;
}
