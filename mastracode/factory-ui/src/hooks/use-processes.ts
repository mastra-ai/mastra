import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { WorkspaceProcessListing, WorkspaceProcessOutput } from '../api/types';

/** How often an open list re-reads the sandbox's processes. */
export const PROCESS_LIST_POLL_MS = 2_000;
/** How often an open process re-reads its output while it runs. */
export const PROCESS_OUTPUT_POLL_MS = 1_000;

/** The session sandbox's processes; with `poll`, re-read every couple of seconds. */
export function useWorkspaceProcesses(
  workspacePath: string | undefined,
  { enabled = true, poll = false }: { enabled?: boolean; poll?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = workspacePath ? `/web/workspace/processes?${new URLSearchParams({ workspacePath })}` : undefined;
  return useQuery<WorkspaceProcessListing>({
    queryKey: queryKeys.workspaceProcesses(workspacePath),
    enabled,
    refetchInterval: enabled && poll ? PROCESS_LIST_POLL_MS : false,
    queryFn: url ? () => client.get<WorkspaceProcessListing>(url) : skipToken,
  });
}

/** One process's output, re-read while it runs; polling stops once it has exited. */
export function useWorkspaceProcess(
  workspacePath: string | undefined,
  pid: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url =
    workspacePath && pid ? `/web/workspace/process?${new URLSearchParams({ workspacePath, pid })}` : undefined;
  return useQuery<WorkspaceProcessOutput>({
    queryKey: queryKeys.workspaceProcess(workspacePath, pid),
    enabled,
    refetchInterval: query => (enabled && query.state.data?.running !== false ? PROCESS_OUTPUT_POLL_MS : false),
    queryFn: url ? () => client.get<WorkspaceProcessOutput>(url) : skipToken,
  });
}

/** Stop a process, then re-read the list and its output. */
export function useKillWorkspaceProcess(workspacePath: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['kill-workspace-process', workspacePath],
    mutationFn: (pid: string) =>
      client.post<{ killed: boolean }>('/web/workspace/process/kill', { workspacePath, pid }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaceProcessesScope(workspacePath) }),
  });
}
