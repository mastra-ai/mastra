import type { ListSandboxProcessesResponse } from '@mastra/client-js';
import { useSandboxProcesses } from '@mastra/react/hooks/workspace';
import type { QueryStatus } from '@tanstack/react-query';
import { pollWhileRunning } from './background-polling';

/** Read the list again while a process in it runs. */
export const processListPollInterval = ({
  status,
  data,
}: {
  status: QueryStatus;
  data?: ListSandboxProcessesResponse;
}) => pollWhileRunning(status, data?.processes.some(process => process.running) ?? false);

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
