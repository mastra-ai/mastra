import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

interface AgentControllerGoalMutationArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useSessionInvalidation({ agentControllerId, resourceId }: AgentControllerGoalMutationArgs) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId),
        exact: true,
      }),
    ]);
  };
}

export function useSetAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = useAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: (objective: string) => session!.setGoal(objective), onSuccess: invalidateSession });
}

export function usePauseAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = useAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: () => session!.updateGoal({ status: 'paused' }), onSuccess: invalidateSession });
}

export function useResumeAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = useAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: () => session!.updateGoal({ status: 'active' }), onSuccess: invalidateSession });
}

export function useClearAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = useAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: () => session!.clearGoal(), onSuccess: invalidateSession });
}
