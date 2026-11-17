import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useFallbackModelQuery } from '../../../../hooks/useAvailableModels';
import { useChatModelScope } from './useChatModelScope';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { routedDefaultModelId } from './chatDefaultModel';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

/** One provider for a draft and its thread, so a Start keeps the picked model on screen. */
export function ChatModelsProvider({
  children,
  initialDraftModelId,
}: {
  children: ReactNode;
  initialDraftModelId?: string;
}) {
  const { draftSessionId, sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  // A thread shows its draft's model until the session reports one.
  const [draftModelId, setDraftModelId] = useState(initialDraftModelId);
  const { projectQuery, modelScope, catalogTarget, sessionModelsQuery } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const fallbackModelQuery = useFallbackModelQuery(catalogTarget);
  const {
    mutateAsync: switchModel,
    isPending: switching,
    variables: switchingTo,
  } = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const localDefaultModelId = routedDefaultModelId(modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });

  if (draftSessionId) {
    const personalDefaultUsed = modelScope !== 'factory';
    const usesFallback = !localDefaultModelId;
    const draft: ChatModelsApi = {
      activeModelId: draftModelId ?? localDefaultModelId ?? fallbackModelQuery.data,
      defaultModelId: localDefaultModelId,
      pendingModelId: undefined,
      isLoading:
        projectQuery.isPending ||
        (personalDefaultUsed && defaultModelQuery.isPending) ||
        (usesFallback && fallbackModelQuery.isPending),
      error:
        projectQuery.error ??
        (personalDefaultUsed ? defaultModelQuery.error : null) ??
        (usesFallback ? fallbackModelQuery.error : null) ??
        undefined,
      setModel: modelId => {
        setDraftModelId(modelId);
        return Promise.resolve();
      },
    };
    return <ChatModelsContext.Provider value={draft}>{children}</ChatModelsContext.Provider>;
  }

  const live: ChatModelsApi = {
    activeModelId: state?.modelId ?? draftModelId,
    defaultModelId: sessionModelsQuery.isSuccess
      ? (('defaultModelId' in sessionModelsQuery.data ? sessionModelsQuery.data.defaultModelId : localDefaultModelId) ??
        undefined)
      : undefined,
    pendingModelId: switching ? switchingTo?.modelId : undefined,
    isLoading: sessionModelsQuery.isPending,
    error: sessionModelsQuery.error ?? undefined,
    setModel: modelId => switchModel({ modelId }),
  };
  return <ChatModelsContext.Provider value={live}>{children}</ChatModelsContext.Provider>;
}
