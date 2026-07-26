import type { PlanResume } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface AgentControllerRunMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useSessionInvalidation({ agentControllerId, resourceId, scope }: AgentControllerRunMutationArgs) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerSession(agentControllerId, resourceId, scope),
      exact: true,
    });
  };
}

export interface SendAgentControllerMessageInput {
  text: string;
  /** Base64-encoded attachments (e.g. pasted images) forwarded to the controller session. */
  files?: Array<{ data: string; mediaType: string; filename?: string }>;
}

export function useSendAgentControllerMessageMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (input: SendAgentControllerMessageInput | string) => {
      const { text, files } = typeof input === 'string' ? { text: input, files: undefined } : input;
      return requireAgentControllerSession(session).sendMessage(
        files?.length ? { content: text, files } : { content: text },
      );
    },
    onSuccess: invalidateSession,
  });
}

export function useSteerAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).steer(text),
    onSuccess: invalidateSession,
  });
}

export function useFollowUpAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: (text: string) => requireAgentControllerSession(session).followUp(text),
    onSuccess: invalidateSession,
  });
}

export function useAbortAgentControllerMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: () => requireAgentControllerSession(session).abort(),
    onSuccess: invalidateSession,
  });
}

export function useApproveAgentControllerToolMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, approved }: { toolCallId: string; approved: boolean }) =>
      requireAgentControllerSession(session).approveTool(toolCallId, approved),
    onSuccess: invalidateSession,
  });
}

export function useRespondAgentControllerSuspensionMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, resumeData }: { toolCallId: string; resumeData: string | string[] | PlanResume }) =>
      requireAgentControllerSession(session).respondToToolSuspension(toolCallId, resumeData),
    onSuccess: invalidateSession,
  });
}
