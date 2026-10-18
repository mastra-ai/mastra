import { useMastraClient } from '../../mastra-client-context';

/**
 * Storage key for the trace list column preferences, scoped to the Mastra server the client
 * talks to so each project keeps its own column layout.
 */
export function useTraceColumnPreferencesStorageKey(): string {
  const client = useMastraClient();
  const projectUrl =
    client.options.baseUrl || (typeof window === 'undefined' ? 'local' : window.location.origin || 'local');
  const apiPrefix = client.options.apiPrefix ?? '/api';
  return `mastra:traces:columns:${projectUrl}:${apiPrefix}`;
}
