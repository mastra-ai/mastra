import { MastraClientError } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery } from '@tanstack/react-query';

/** The event types an MCP server declares; only fetched for servers that report `events_capability`. */
export function useMcpServerEvents(serverId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['mcp-server-events', serverId],
    queryFn: () => client.getMcpServerEvents(serverId),
    enabled,
  });
}

/** Sends a test occurrence (served only under `mastra dev`). */
export function useEmitMcpServerEvent(serverId: string, eventName: string) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => client.emitMcpServerEvent(serverId, eventName, data),
  });
}

/** The server's message for a failed event request (already generic), or a fallback. */
export function eventRequestErrorMessage(error: unknown): string {
  if (error instanceof MastraClientError && typeof error.body === 'object' && error.body !== null) {
    const message = 'error' in error.body ? error.body.error : undefined;
    if (typeof message === 'string' && message) return message;
  }
  return 'The event request failed.';
}
