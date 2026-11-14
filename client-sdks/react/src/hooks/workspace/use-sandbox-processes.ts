import type {
  KillSandboxProcessResponse,
  ListSandboxProcessesResponse,
  SandboxProcessOutputResponse,
} from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';
import { shouldRetryWorkspaceQuery } from './compatibility';

export type KillSandboxProcessParams = { workspaceId: string; pid: string; threadId?: string; resourceId?: string };

const sandboxProcessesKey = (workspaceId: string) => ['workspace', 'sandbox-processes', workspaceId];

/**
 * Lists the background processes in a workspace sandbox, for example the commands an agent
 * started with `execute_command` and `background: true`. Pass `threadId` to list one thread's
 * processes; it also picks the sandbox when the workspace resolves one per thread.
 *
 * Processes are not pushed to the client: poll with `queryOptions: { refetchInterval }` to
 * follow them.
 */
export const useSandboxProcesses = <TData = ListSandboxProcessesResponse>({
  workspaceId,
  threadId,
  resourceId,
  queryOptions,
}: {
  workspaceId: string;
  threadId?: string;
  resourceId?: string;
  queryOptions?: MastraQueryOptions<ListSandboxProcessesResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery<ListSandboxProcessesResponse, Error, TData>({
    queryKey: [...sandboxProcessesKey(workspaceId), 'list', threadId, resourceId],
    queryFn: () => client.getWorkspace(workspaceId).listSandboxProcesses({ threadId, resourceId }),
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};

/**
 * Reads a background process's status and retained output. Reading it does not release an
 * exited process, so the agent can still read it with `get_process_output`. Pass `tail` to
 * get only the last N lines of output.
 */
export const useSandboxProcess = <TData = SandboxProcessOutputResponse>({
  workspaceId,
  pid,
  threadId,
  resourceId,
  tail,
  queryOptions,
}: {
  workspaceId: string;
  pid: string;
  threadId?: string;
  resourceId?: string;
  tail?: number;
  queryOptions?: MastraQueryOptions<SandboxProcessOutputResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery<SandboxProcessOutputResponse, Error, TData>({
    queryKey: [...sandboxProcessesKey(workspaceId), 'process', pid, threadId, resourceId, tail],
    queryFn: () => client.getWorkspace(workspaceId).getSandboxProcess(pid, { threadId, resourceId, tail }),
    retry: shouldRetryWorkspaceQuery,
    ...queryOptions,
  });
};

/** Kills a background process in a workspace sandbox and refreshes that workspace's process queries. */
export const useKillSandboxProcess = ({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<KillSandboxProcessResponse, KillSandboxProcessParams> } = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation<KillSandboxProcessResponse, Error, KillSandboxProcessParams>({
    mutationFn: ({ workspaceId, pid, threadId, resourceId }) =>
      client.getWorkspace(workspaceId).killSandboxProcess(pid, { threadId, resourceId }),
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({ queryKey: sandboxProcessesKey(variables.workspaceId) }),
    ...queryOptions,
  });
};
