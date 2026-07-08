import type { PlanResume } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient } from '../services/agentControllerClient';

interface AgentControllerRunMutationArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useSessionInvalidation({ agentControllerId, resourceId }: AgentControllerRunMutationArgs) {
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

export function useSendAgentControllerMessageMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: (text: string) => session!.sendMessage(text), onSuccess: invalidateSession });
}

export function useSteerAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: (text: string) => session!.steer(text), onSuccess: invalidateSession });
}

export function useFollowUpAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: (text: string) => session!.followUp(text), onSuccess: invalidateSession });
}

export function useAbortAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({ mutationFn: () => session!.abort(), onSuccess: invalidateSession });
}

export function useApproveAgentControllerToolMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, approved }: { toolCallId: string; approved: boolean }) =>
      session!.approveTool(toolCallId, approved),
    onSuccess: invalidateSession,
  });
}

export function useRespondAgentControllerSuspensionMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, resumeData }: { toolCallId: string; resumeData: string | string[] | PlanResume }) =>
      session!.respondToToolSuspension(toolCallId, resumeData),
    onSuccess: invalidateSession,
  });
}
