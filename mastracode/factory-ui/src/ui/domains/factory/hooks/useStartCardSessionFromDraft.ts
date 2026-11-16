import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession, invalidateSessionQueries } from '../../../../hooks/useWorkspaces';
import type { DraftSessionStart } from '../../chat/context/DraftSessionStartContext';
import { useChatModels } from '../../chat/context/useChatModels';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useChatThinking } from '../../chat/context/useChatThinking';
import { startPromptHandoff } from '../../chat/hooks/useHandoffPrompt';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { stashHandoffFiles } from '../../chat/services/handoffFiles';
import { getFactoryEnvironment } from '../../workspaces/services/environment';
import { threadPath } from '../../workspaces/services/factoryPaths';
import { createUserSession, getUserSession } from '../../workspaces/services/user-sessions';
import { itemSessionSpec } from '../boardItems';
import { firstEnvironmentRepository } from '../boardRepository';
import type { CardSessionRepository } from '../boardRepository';
import { startFactoryRun, updateWorkItem } from '../services/workItems';
import type { WorkItem } from '../services/workItems';

type StartableRepository = Exclude<CardSessionRepository, { kind: 'unavailable' }>;

/** Creates without a session id, so the server reuses the person's session on the card's branch, e.g. one whose start failed. */
export function useStartCardSessionFromDraft(
  item: WorkItem,
  sessionRepository: CardSessionRepository | undefined,
): DraftSessionStart {
  const { baseUrl } = useChatSessionContext();
  const { activeModelId, defaultModelId } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const { factoryId } = useParams<{ factoryId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startable = sessionRepository?.kind === 'unavailable' ? undefined : sessionRepository;

  const sessionRepositoryFor = async (factoryId: string, target: StartableRepository) => {
    if (target.kind === 'resolved') return target.repository;
    const environment = await queryClient.fetchQuery({
      queryKey: queryKeys.factoryEnvironment(factoryId),
      queryFn: () => getFactoryEnvironment(baseUrl, factoryId),
    });
    const repository = firstEnvironmentRepository(target.candidates, environment.repositories);
    if (!repository) {
      throw new Error("None of the repositories matching this card's provider is in this Factory's environment.");
    }
    return repository;
  };

  const startSession = useMutation({
    mutationFn: async ({ factoryId, target }: { factoryId: string; target: StartableRepository }) => {
      const repository = await sessionRepositoryFor(factoryId, target);
      const recordedSlug = target.kind === 'resolved' ? repository.slug : undefined;
      const baseMetadata = item.workItem ? {} : (item.metadata ?? {});
      const metadata = recordedSlug ? { ...baseMetadata, repository: recordedSlug } : baseMetadata;
      if (recordedSlug && item.metadata?.repository !== recordedSlug) {
        await updateWorkItem(baseUrl, item.id, { metadata });
      }
      const { branch, threadTitle } = itemSessionSpec(item);
      const { sessionId } = await createUserSession(baseUrl, repository.projectRepositoryId, { branch });
      await startFactoryRun(baseUrl, factoryId, {
        sessionId,
        threadTitle,
        kickoffKey: crypto.randomUUID(),
        workItem: {
          id: item.id,
          role: 'chat',
          input: { source: item.source, sourceKey: item.sourceKey, title: item.title, url: null, metadata },
        },
      });
      // Read after the start: binding the card decides which memory resource the session works on.
      return getUserSession(baseUrl, sessionId);
    },
    onSettled: (_session, _error, { factoryId }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) }),
  });

  const start: DraftSessionStart['start'] = async ({ prompt, files }) => {
    if (!factoryId || !startable) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }
    const session = await startSession.mutateAsync({ factoryId, target: startable }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Session creation failed';
      throw new Error(`Could not create the session: ${message}. Try again.`, { cause: error });
    });
    const { sessionId } = session;
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
    void navigate(threadPath(factoryId, { sessionId, threadId: sessionId }), {
      replace: true,
      state: startPromptHandoff(sessionId, prompt, {
        modelId: draftKeepsServerDefaults ? undefined : activeModelId,
        thinkingLevel: thinkingLevelOverride,
      }),
    });
  };

  return { ready: startable !== undefined && !startSession.isPending, start };
}
