import type { MastraClient, AgentControllerSessionSettings, PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';

export const AGENT_CONTROLLER_THREAD_PAGE_SIZE = 20;

type AgentController = ReturnType<MastraClient['getAgentController']>;
type AgentControllerSession = ReturnType<AgentController['session']>;

export interface AgentControllerQueryScope {
  agentControllerId?: string;
  resourceId?: string;
}

export interface AgentControllerThreadsScope extends AgentControllerQueryScope {
  projectPath?: string;
}

const fallbackScope: Required<AgentControllerQueryScope> = {
  agentControllerId: 'unknown',
  resourceId: 'unknown',
};

function scoped(scope?: AgentControllerQueryScope): Required<AgentControllerQueryScope> {
  return {
    agentControllerId: scope?.agentControllerId ?? fallbackScope.agentControllerId,
    resourceId: scope?.resourceId ?? fallbackScope.resourceId,
  };
}

export function useAgentControllerModelsQuery(
  controller: AgentController | null | undefined,
  enabled: boolean,
  scope?: Pick<AgentControllerQueryScope, 'agentControllerId'>,
) {
  return useQuery({
    queryKey: queryKeys.agentControllerModels(scope?.agentControllerId ?? fallbackScope.agentControllerId),
    queryFn: async () => {
      const models = await controller!.listModels();
      return models.filter(model => model.hasApiKey);
    },
    enabled: enabled && Boolean(controller),
  });
}

export function useAgentControllerSettingsQuery(
  session: AgentControllerSession | null | undefined,
  enabled: boolean,
  scope?: AgentControllerQueryScope,
) {
  const keyScope = scoped(scope);
  return useQuery({
    queryKey: queryKeys.agentControllerSettings(keyScope.agentControllerId, keyScope.resourceId),
    queryFn: async () => {
      const state = await session!.state();
      return state.settings ?? null;
    },
    enabled: enabled && Boolean(session),
  });
}

export function useAgentControllerPermissionsQuery(
  session: AgentControllerSession | null | undefined,
  enabled: boolean,
  scope?: AgentControllerQueryScope,
) {
  const keyScope = scoped(scope);
  return useQuery({
    queryKey: queryKeys.agentControllerPermissions(keyScope.agentControllerId, keyScope.resourceId),
    queryFn: () => session!.getPermissions(),
    enabled: enabled && Boolean(session),
  });
}

export function useAgentControllerThreadsQuery(
  session: AgentControllerSession | null | undefined,
  projectPath: string | undefined,
  enabled: boolean,
  scope?: AgentControllerQueryScope,
) {
  const keyScope = scoped(scope);
  return useQuery({
    queryKey: queryKeys.agentControllerThreads(keyScope.agentControllerId, keyScope.resourceId, projectPath),
    queryFn: () =>
      session!.listThreads({
        limit: AGENT_CONTROLLER_THREAD_PAGE_SIZE,
        tags: projectPath ? { projectPath } : undefined,
      }),
    enabled: enabled && Boolean(session),
  });
}

export function useAgentControllerThreadMessagesQuery(
  session: AgentControllerSession | null | undefined,
  threadId: string | undefined,
  enabled: boolean,
  scope?: AgentControllerQueryScope,
) {
  const keyScope = scoped(scope);
  return useQuery({
    queryKey: queryKeys.agentControllerThreadMessages(keyScope.agentControllerId, keyScope.resourceId, threadId),
    queryFn: () => session!.listMessages(threadId!),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    // Live SSE events keep the transcript current; a focus refetch must never
    // clobber an in-flight stream with stale persisted history.
    refetchOnWindowFocus: false,
  });
}

export function useSetAgentControllerStateMutation(
  session: AgentControllerSession | null | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => session!.setState(updates),
    onSuccess: async (_data, updates) => {
      if ('settings' in updates) {
        queryClient.setQueryData(
          queryKeys.agentControllerSettings(keyScope.agentControllerId, keyScope.resourceId),
          updates.settings as AgentControllerSessionSettings,
        );
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(keyScope.agentControllerId, keyScope.resourceId),
      });
    },
  });
}

export function useSetPermissionForCategoryMutation(
  session: AgentControllerSession | null | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) =>
      session!.setPermissionForCategory(category, policy),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerPermissions(keyScope.agentControllerId, keyScope.resourceId),
      }),
  });
}

export function useCreateAgentControllerThreadMutation(
  session: AgentControllerSession | null | undefined,
  projectPath: string | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: (title?: string) => session!.createThread(title),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(keyScope.agentControllerId, keyScope.resourceId, projectPath),
      }),
  });
}

export function useDeleteAgentControllerThreadMutation(
  session: AgentControllerSession | null | undefined,
  projectPath: string | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: (threadId: string) => session!.deleteThread(threadId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(keyScope.agentControllerId, keyScope.resourceId, projectPath),
      }),
  });
}

export function useRenameAgentControllerThreadMutation(
  session: AgentControllerSession | null | undefined,
  projectPath: string | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) => session!.renameThread(threadId, title),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(keyScope.agentControllerId, keyScope.resourceId, projectPath),
      }),
  });
}

export function useCloneAgentControllerThreadMutation(
  session: AgentControllerSession | null | undefined,
  projectPath: string | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: (options?: { sourceThreadId?: string; title?: string }) => session!.cloneThread(options),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(keyScope.agentControllerId, keyScope.resourceId, projectPath),
      }),
  });
}

export function useSwitchAgentControllerModeMutation(
  session: AgentControllerSession | null | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: (modeId: string) => session!.switchMode(modeId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(keyScope.agentControllerId, keyScope.resourceId),
      }),
  });
}

export function useSwitchAgentControllerModelMutation(
  session: AgentControllerSession | null | undefined,
  scope?: AgentControllerQueryScope,
) {
  const queryClient = useQueryClient();
  const keyScope = scoped(scope);
  return useMutation({
    mutationFn: (modelId: string) => session!.switchModel(modelId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(keyScope.agentControllerId, keyScope.resourceId),
      }),
  });
}
