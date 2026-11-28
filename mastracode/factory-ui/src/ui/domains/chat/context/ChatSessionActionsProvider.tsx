import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { useAgentControllerThreads } from '../../../../hooks/useAgentControllerThreads';
import { useSetSessionModelMutation } from '../../../../hooks/useSessionModel';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../../../../hooks/useAgentControllerGoalMutations';
import {
  useAbortAgentControllerMutation,
  useApproveAgentControllerToolMutation,
  useFollowUpAgentControllerMutation,
  useRespondAgentControllerSuspensionMutation,
  useSendAgentControllerMessageMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import {
  switchThreadMutationKey,
  useCreateAgentControllerThreadMutation,
} from '../../../../hooks/useAgentControllerThreadMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatSessionActionsContext } from './ChatSessionActionsContext';
import type { ChatSessionActionsApi } from './ChatSessionActionsContext';
import { useChatSessionContext } from './useChatSessionContext';

/** Factory's session actions, served by the Agent Controller. */
export function ChatSessionActionsProvider({ children }: { children: ReactNode }) {
  const { sessionId, sessionEnabled, baseUrl, resourceId, sessionThreadId, threadTags, resourceReady } =
    useChatSessionContext();
  const queryClient = useQueryClient();
  const args = { agentControllerId: AGENT_CONTROLLER_ID, sessionId, baseUrl, enabled: sessionEnabled };

  const send = useSendAgentControllerMessageMutation(args);
  const abort = useAbortAgentControllerMutation(args);
  const approve = useApproveAgentControllerToolMutation(args);
  const respond = useRespondAgentControllerSuspensionMutation(args);
  const createThread = useCreateAgentControllerThreadMutation(args);
  const followUp = useFollowUpAgentControllerMutation(args);
  const setGoal = useSetAgentControllerGoalMutation(args);
  const setSessionModel = useSetSessionModelMutation({
    resourceId,
    threadId: sessionThreadId ?? sessionId,
    sessionId,
  });
  const threadsQuery = useAgentControllerThreads({ ...args, threadTags, enabled: resourceReady });
  const pauseGoal = usePauseAgentControllerGoalMutation(args);
  const resumeGoal = useResumeAgentControllerGoalMutation(args);
  const clearGoal = useClearAgentControllerGoalMutation(args);
  const switchingThread = useIsMutating({ mutationKey: switchThreadMutationKey(AGENT_CONTROLLER_ID, sessionId) }) > 0;

  // mutateAsync is stable per mutation, so only the pending flags change this value.
  const value = useMemo<ChatSessionActionsApi>(
    () => ({
      send: send.mutateAsync,
      sending: send.isPending,
      abort: () => abort.mutateAsync(),
      approveTool: (toolCallId, approved) => approve.mutateAsync({ toolCallId, approved }),
      respondToSuspension: (toolCallId, resumeData, options) =>
        respond.mutateAsync({ toolCallId, resumeData, quietWhenEnded: options?.quietWhenEnded }),
      replying: approve.isPending || respond.isPending,
      createThread: () => createThread.mutateAsync(undefined),
      seedThreadMessages: (threadId: string, messages: MastraDBMessage[]) =>
        queryClient.setQueryData(
          queryKeys.agentControllerThreadMessages(
            AGENT_CONTROLLER_ID,
            sessionId,
            threadId,
            INITIAL_THREAD_MESSAGE_LIMIT,
          ),
          messages,
        ),
      switchingThread,
      followUp: followUp.mutateAsync,
      model: { setSelection: setSessionModel.mutateAsync },
      threads: { list: threadsQuery.data },
      goal: {
        set: objective => setGoal.mutateAsync(objective),
        pause: () => pauseGoal.mutateAsync(),
        resume: () => resumeGoal.mutateAsync(),
        clear: () => clearGoal.mutateAsync(),
      },
    }),
    [
      send.mutateAsync,
      send.isPending,
      abort.mutateAsync,
      approve.mutateAsync,
      approve.isPending,
      respond.mutateAsync,
      respond.isPending,
      createThread.mutateAsync,
      followUp.mutateAsync,
      setSessionModel.mutateAsync,
      threadsQuery.data,
      setGoal.mutateAsync,
      pauseGoal.mutateAsync,
      resumeGoal.mutateAsync,
      clearGoal.mutateAsync,
      queryClient,
      sessionId,
      switchingThread,
    ],
  );

  return <ChatSessionActionsContext.Provider value={value}>{children}</ChatSessionActionsContext.Provider>;
}
