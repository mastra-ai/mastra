import type { PlanResume } from '@mastra/client-js';
import { useMutation } from '@tanstack/react-query';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerRunMutationArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSendAgentControllerMessageMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).sendMessage(text),
  });
}

export function useSteerAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).steer(text),
  });
}

export function useFollowUpAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).followUp(text),
  });
}

export function useAbortAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).abort(),
  });
}

export function useApproveAgentControllerToolMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: ({ toolCallId, approved }: { toolCallId: string; approved: boolean }) =>
      requireAgentControllerSession(session).approveTool(toolCallId, approved),
  });
}

export function useRespondAgentControllerSuspensionMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  return useMutation({
    mutationFn: ({ toolCallId, resumeData }: { toolCallId: string; resumeData: string | string[] | PlanResume }) =>
      requireAgentControllerSession(session).respondToToolSuspension(toolCallId, resumeData),
  });
}
