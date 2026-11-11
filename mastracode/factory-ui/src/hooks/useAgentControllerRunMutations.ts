import type { AgentControllerCommandAck, PlanResume } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

interface AgentControllerRunMutationArgs {
  agentControllerId: string;
  sessionId: string;
  baseUrl?: string;
  enabled?: boolean;
}

function useSessionInvalidation({ agentControllerId, sessionId }: AgentControllerRunMutationArgs) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerSession(agentControllerId, sessionId),
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
      requireAgentControllerSession(session).approveTool(toolCallId, approved).then(requireAccepted),
    onSuccess: invalidateSession,
    onError: reportRejectedReply,
  });
}

export function useRespondAgentControllerSuspensionMutation(args: AgentControllerRunMutationArgs) {
  const { session } = createAgentControllerClient(args);
  const invalidateSession = useSessionInvalidation(args);
  return useMutation({
    mutationFn: ({ toolCallId, resumeData }: { toolCallId: string; resumeData: string | string[] | PlanResume }) =>
      requireAgentControllerSession(session).respondToToolSuspension(toolCallId, resumeData).then(requireAccepted),
    onSuccess: invalidateSession,
    onError: error => {
      reportRejectedReply(error);
      // Refetch so a prompt nothing is waiting on stops offering buttons.
      void invalidateSession();
    },
  });
}

/** The server answers a reply it can't deliver with 200 and `ok: false`. */
function requireAccepted(ack: AgentControllerCommandAck): AgentControllerCommandAck {
  if (ack.ok) return ack;
  throw new Error(
    ack.reason === 'no_pending_suspension'
      ? 'This request is no longer waiting for a reply. Its run has ended.'
      : 'Your reply was not delivered. Someone may have already answered it.',
  );
}

function reportRejectedReply(error: Error) {
  toast.error(error.message, { id: 'agent-controller-reply-rejected' });
}
