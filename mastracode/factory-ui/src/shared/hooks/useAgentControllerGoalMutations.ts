import { useMutation } from '@tanstack/react-query';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface AgentControllerGoalMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: (objective: string) => requireAgentControllerSession(session).setGoal(objective),
  });
}

export function usePauseAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).updateGoal({ status: 'paused' }),
  });
}

export function useResumeAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).updateGoal({ status: 'active' }),
  });
}

export function useClearAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).clearGoal(),
  });
}
