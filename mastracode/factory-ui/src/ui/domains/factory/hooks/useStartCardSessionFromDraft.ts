import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import type { WorkItemSessionRepository } from '../../../../api/types';
import { addCachedSession, invalidateSessionQueries } from '../../../../hooks/useWorkspaces';
import type { DraftSessionStart } from '../../chat/context/DraftSessionStartContext';
import { useContinueIntoThread } from '../../chat/context/transcriptKey';
import { useChatModels } from '../../chat/context/useChatModels';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useChatThinking } from '../../chat/context/useChatThinking';
import { useChatTranscript } from '../../chat/context/useChatTranscript';
import { startPromptHandoff } from '../../chat/hooks/useHandoffPrompt';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { stashHandoffFiles } from '../../chat/services/handoffFiles';
import type { FactoryProject } from '../../workspaces/services/github';
import { createUserSession, getUserSession } from '../../workspaces/services/user-sessions';
import { itemSessionSpec } from '../boardItems';
import { startFactoryRun } from '../services/workItems';
import type { WorkItem } from '../services/workItems';

interface CardStart {
  factory: FactoryProject;
  item: WorkItem;
  repository: Extract<WorkItemSessionRepository, { status: 'resolved' }>;
}

/** Creates without a session id, so the server reuses the person's session on the card's branch, e.g. one whose start failed. */
export function useStartCardSessionFromDraft(
  factory: FactoryProject | undefined,
  item: WorkItem | undefined,
  sessionRepository: WorkItemSessionRepository | undefined,
): DraftSessionStart & { ownsSession: (sessionId: string) => boolean } {
  const { baseUrl } = useChatSessionContext();
  const { activeModelId, defaultModelId, setModel } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const { localUser, failLocalUser } = useChatTranscript();
  const queryClient = useQueryClient();
  const continueIntoThread = useContinueIntoThread();
  const [createdSessionId, setCreatedSessionId] = useState<string>();
  const target: CardStart | undefined =
    factory && item && sessionRepository?.status === 'resolved'
      ? { factory, item, repository: sessionRepository }
      : undefined;

  const startSession = useMutation({
    mutationFn: async ({ factory, item, repository }: CardStart) => {
      const metadata = item.workItem ? {} : (item.metadata ?? {});
      const { branch, threadTitle } = itemSessionSpec(item);
      const { sessionId } = await createUserSession(baseUrl, repository.projectRepositoryId, { branch });
      setCreatedSessionId(sessionId);
      await startFactoryRun(baseUrl, factory.id, {
        sessionId,
        threadTitle,
        kickoffKey: crypto.randomUUID(),
        workItem: {
          id: item.id,
          role: 'chat',
          input: { source: item.source, sourceKey: item.sourceKey, title: item.title, url: null, metadata },
        },
      });
      return getUserSession(baseUrl, sessionId);
    },
    onSettled: (_session, _error, { factory }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factory.id) }),
  });

  const start: DraftSessionStart['start'] = async ({ prompt, files }) => {
    if (!target) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }
    const shownMessageId = localUser(prompt, false, files);
    const session = await startSession.mutateAsync(target).catch((error: unknown) => {
      failLocalUser(shownMessageId);
      const message = error instanceof Error ? error.message : 'Session creation failed';
      throw new Error(`Could not create the session: ${message}. Try again.`, { cause: error });
    });
    const { sessionId } = session;
    const factoryId = target.factory.id;
    queryClient.setQueryData(queryKeys.userSession(sessionId), session);
    addCachedSession(queryClient, factoryId, session);
    void invalidateSessionQueries(queryClient, factoryId);
    // A session that never got a message has no history, so its thread opens on an empty transcript.
    queryClient.setQueryData<MastraDBMessage[]>(
      queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, sessionId, sessionId, INITIAL_THREAD_MESSAGE_LIMIT),
      [],
    );
    stashHandoffFiles(sessionId, files);
    const draftKeepsServerDefaults = activeModelId === defaultModelId && !thinkingLevelOverride;
    // The thread shows this model until its session reports one.
    void setModel(activeModelId);
    continueIntoThread(
      factoryId,
      { sessionId, threadId: sessionId },
      startPromptHandoff(sessionId, prompt, {
        shownMessageId,
        modelId: draftKeepsServerDefaults ? undefined : activeModelId,
        thinkingLevel: thinkingLevelOverride,
      }),
    );
  };

  return {
    ready: target !== undefined && (startSession.isIdle || startSession.isError),
    // A failed Start may already have bound the card to its session; the draft stays to show the failure.
    ownsSession: sessionId => startSession.isPending || sessionId === createdSessionId,
    start,
  };
}
