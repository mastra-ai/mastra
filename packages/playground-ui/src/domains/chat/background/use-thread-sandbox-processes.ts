import type { ListSandboxProcessesResponse } from '@mastra/client-js';
import { useSandboxProcesses } from '@mastra/react/hooks/workspace';

/** How often background work that is still running is read again. */
export const BACKGROUND_POLL_MS = 2_000;

interface ReadState<TData> {
  status: 'pending' | 'error' | 'success';
  data?: TData;
}

/** Read the list again while a process in it runs; a failed read (a 404, say) is not retried by polling. */
export const processListPollInterval = ({ status, data }: ReadState<ListSandboxProcessesResponse>) =>
  status !== 'error' && data?.processes.some(process => process.running) ? BACKGROUND_POLL_MS : false;

/**
 * The background processes a thread started in a workspace's sandbox. Processes aren't pushed,
 * so the list is polled while any of them runs. The card and the panel share this one query.
 */
export function useThreadSandboxProcesses({ workspaceId, threadId }: { workspaceId: string; threadId: string }) {
  return useSandboxProcesses({
    workspaceId,
    threadId,
    queryOptions: { refetchInterval: query => processListPollInterval(query.state) },
  });
}
