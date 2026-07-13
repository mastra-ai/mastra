import type { PlanResume } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerRunMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function toClientArgs({ agentControllerId, resourceId, projectPath, baseUrl, enabled }: AgentControllerRunMutationArgs) {
  return { agentControllerId, resourceId, scope: projectPath, baseUrl, enabled };
}

function useSessionInvalidation({ agentControllerId, resourceId, projectPath }: AgentControllerRunMutationArgs) {
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

export function useSendAgentControllerMessageMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).sendMessage(text),
    onSuccess: invalidateSession,
  });
}

export function useSteerAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).steer(text),
    onSuccess: invalidateSession,
  });
}

export function useFollowUpAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).followUp(text),
    onSuccess: invalidateSession,
  });
}

export function useAbortAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).abort(),
    onSuccess: invalidateSession,
  });
}

export function useApproveAgentControllerToolMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, approved }: { toolCallId: string; approved: boolean }) =>
      requireAgentControllerSession(session).approveTool(toolCallId, approved),
    onSuccess: invalidateSession,
  });
}

export function useRespondAgentControllerSuspensionMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(toClientArgs(args));
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, resumeData }: { toolCallId: string; resumeData: string | string[] | PlanResume }) =>
      requireAgentControllerSession(session).respondToToolSuspension(toolCallId, resumeData),
    onSuccess: invalidateSession,
  });
}
