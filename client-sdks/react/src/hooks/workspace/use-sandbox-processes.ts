import type {
  KillSandboxProcessResponse,
  ListSandboxProcessesResponse,
  SandboxProcessOutputResponse,
} from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type KillSandboxProcessParams = { pid: string; threadId?: string; resourceId?: string };

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
    ...queryOptions,
  });
};

/**
 * Reads a background process's status and retained output. Reading it does not release an
 * exited process, so the agent can still read it with `get_process_output`.
 */
export const useSandboxProcess = <TData = SandboxProcessOutputResponse>({
  workspaceId,
  pid,
  threadId,
  resourceId,
  queryOptions,
}: {
  workspaceId: string;
  pid: string;
  threadId?: string;
  resourceId?: string;
  queryOptions?: MastraQueryOptions<SandboxProcessOutputResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery<SandboxProcessOutputResponse, Error, TData>({
    queryKey: [...sandboxProcessesKey(workspaceId), 'process', pid, threadId, resourceId],
    queryFn: () => client.getWorkspace(workspaceId).getSandboxProcess(pid, { threadId, resourceId }),
    ...queryOptions,
  });
};

/** Kills a background process in a workspace sandbox and refreshes the workspace's process queries. */
export const useKillSandboxProcess = ({
  workspaceId,
  queryOptions,
}: {
  workspaceId: string;
  queryOptions?: MastraMutationOptions<KillSandboxProcessResponse, KillSandboxProcessParams>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation<KillSandboxProcessResponse, Error, KillSandboxProcessParams>({
    mutationFn: ({ pid, threadId, resourceId }) =>
      client.getWorkspace(workspaceId).killSandboxProcess(pid, { threadId, resourceId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sandboxProcessesKey(workspaceId) }),
    ...queryOptions,
  });
};
