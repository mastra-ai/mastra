import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerGoalMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function toClientArgs({ agentControllerId, resourceId, projectPath, baseUrl, enabled }: AgentControllerGoalMutationArgs) {
  return { agentControllerId, resourceId, scope: projectPath, baseUrl, enabled };
}

function useSessionInvalidation({ agentControllerId, resourceId, projectPath }: AgentControllerGoalMutationArgs) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId, projectPath),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId, projectPath),
        exact: true,
      }),
    ]);
  };
}

export function useSetAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (objective: string) => requireAgentControllerSession(session).setGoal(objective),
    onSuccess: invalidateSession,
  });
}

export function usePauseAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).updateGoal({ status: 'paused' }),
    onSuccess: invalidateSession,
  });
}

export function useResumeAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).updateGoal({ status: 'active' }),
    onSuccess: invalidateSession,
  });
}

export function useClearAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).clearGoal(),
    onSuccess: invalidateSession,
  });
}
