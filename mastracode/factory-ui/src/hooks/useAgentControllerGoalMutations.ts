import type { AgentControllerGoalRecord } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

interface AgentControllerGoalMutationArgs {
  agentControllerId: string;
  sessionId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerGoal(args: AgentControllerGoalMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useQuery({
    queryKey: queryKeys.agentControllerGoal(args.agentControllerId, args.sessionId),
    queryFn: async () => (await requireAgentControllerSession(session).getGoal()) ?? null,
    enabled: (args.enabled ?? true) && Boolean(session),
  });
}

function useGoalMutation<TVariables>(
  args: AgentControllerGoalMutationArgs,
  mutationFn: (
    session: ReturnType<typeof requireAgentControllerSession>,
    variables: TVariables,
  ) => Promise<AgentControllerGoalRecord | undefined>,
) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient(args);
  const queryKey = queryKeys.agentControllerGoal(args.agentControllerId, args.sessionId);
  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(requireAgentControllerSession(session), variables),
    onSuccess: goal => queryClient.setQueryData(queryKey, goal ?? null),
    // A goal that failed to start is parked as paused server-side, so re-read it.
    onError: () => void queryClient.invalidateQueries({ queryKey }),
  });
}

export function useSetAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  return useGoalMutation(args, (session, objective: string) => session.setGoal(objective, { start: true }));
}

export function usePauseAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  return useGoalMutation(args, (session, _: void) => session.updateGoal({ status: 'paused' }));
}

export function useResumeAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  return useGoalMutation(args, (session, _: void) => session.updateGoal({ status: 'active', start: true }));
}

export function useClearAgentControllerGoalMutation(args: AgentControllerGoalMutationArgs) {
  return useGoalMutation(args, async (session, _: void) => {
    await session.clearGoal();
    return undefined;
  });
}
