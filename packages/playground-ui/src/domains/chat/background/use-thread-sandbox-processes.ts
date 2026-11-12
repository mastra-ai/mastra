import { useSandboxProcesses } from '@mastra/react/hooks/workspace';

/** How often background work that is still running is read again. */
export const BACKGROUND_POLL_MS = 2_000;

/**
 * The background processes a thread started in a workspace's sandbox. Processes aren't pushed,
 * so the list is polled while any of them runs. The card and the panel share this one query.
 */
export function useThreadSandboxProcesses({ workspaceId, threadId }: { workspaceId: string; threadId: string }) {
  return useSandboxProcesses({
    workspaceId,
    threadId,
    queryOptions: {
      refetchInterval: query =>
        query.state.data?.processes.some(process => process.running) ? BACKGROUND_POLL_MS : false,
    },
  });
}
