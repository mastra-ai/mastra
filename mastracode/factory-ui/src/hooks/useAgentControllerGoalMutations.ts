import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';
import { normalizeGoalRecord } from '../ui/domains/chat/services/goal';

export interface AgentControllerGoalMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { agentControllerId, resourceId, scope, baseUrl = '', enabled = true } = args;
  const queryClient = useQueryClient();
  const goalKey = queryKeys.agentControllerGoal(agentControllerId, resourceId, scope);
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });

  return useMutation({
    mutationFn: async (input: { objective: string; trigger?: boolean }) => {
      const goal = await requireAgentControllerSession(session).setGoal(input.objective, {
        ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
      });
      return goal ? normalizeGoalRecord(goal) : undefined;
    },
    onSuccess: goal => {
      if (goal) queryClient.setQueryData(goalKey, goal);
    },
    onSettled: () => {
      // A triggered goal that fails to start is persisted as paused server-side
      // and reported through a 502 — refetch reconciles the cache either way.
      void queryClient.invalidateQueries({ queryKey: goalKey, exact: true });
    },
  });
}

export function usePauseAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { agentControllerId, resourceId, scope, baseUrl = '', enabled = true } = args;
  const queryClient = useQueryClient();
  const goalKey = queryKeys.agentControllerGoal(agentControllerId, resourceId, scope);
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });

  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).updateGoal({ status: 'paused' }),
    onSuccess: goal => {
      if (goal) queryClient.setQueryData(goalKey, normalizeGoalRecord(goal));
    },
  });
}

export function useResumeAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { agentControllerId, resourceId, scope, baseUrl = '', enabled = true } = args;
  const queryClient = useQueryClient();
  const goalKey = queryKeys.agentControllerGoal(agentControllerId, resourceId, scope);
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });

  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).updateGoal({ status: 'active', trigger: true }),
    onSuccess: goal => {
      if (goal) queryClient.setQueryData(goalKey, normalizeGoalRecord(goal));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: goalKey, exact: true });
    },
  });
}

export function useClearAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { agentControllerId, resourceId, scope, baseUrl = '', enabled = true } = args;
  const queryClient = useQueryClient();
  const goalKey = queryKeys.agentControllerGoal(agentControllerId, resourceId, scope);
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });

  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).clearGoal(),
    onSuccess: () => {
      // `undefined` would be a TanStack no-op; the query's empty value is
      // `null`, so write that and reconfirm with an exact refetch.
      queryClient.setQueryData(goalKey, null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: goalKey, exact: true });
    },
  });
}
