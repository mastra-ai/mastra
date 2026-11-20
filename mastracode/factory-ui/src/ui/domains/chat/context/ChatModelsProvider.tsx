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
  const { draftSessionId } = useChatSessionContext();
  const [draftModelId, setDraftModelId] = useState(initialDraftModelId);
  const draft = useDraftModels(draftModelId, setDraftModelId);
  const live = useLiveModels(draftModelId);
  return <ChatModelsContext.Provider value={draftSessionId ? draft : live}>{children}</ChatModelsContext.Provider>;
}

function useDraftModels(draftModelId: string | undefined, setDraftModelId: (modelId: string) => void): ChatModelsApi {
  const { projectQuery, modelScope, catalogTarget } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const fallbackModelQuery = useFallbackModelQuery(catalogTarget);
  const defaultModelId = routedDefaultModelId(modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });
  const personalDefaultUsed = modelScope !== 'factory';
  const usesFallback = !defaultModelId;
  return {
    activeModelId: draftModelId ?? defaultModelId ?? fallbackModelQuery.data,
    defaultModelId,
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
}

function useLiveModels(draftModelId: string | undefined): ChatModelsApi {
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const { projectQuery, modelScope, sessionModelsQuery } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const localDefaultModelId = routedDefaultModelId(modelScope, {
    factory: projectQuery.data?.defaultModelId,
    personal: defaultModelQuery.data?.modelId,
  });
  const defaultModelId = sessionModelsQuery.isSuccess
    ? (('defaultModelId' in sessionModelsQuery.data ? sessionModelsQuery.data.defaultModelId : localDefaultModelId) ??
      undefined)
    : undefined;
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
  return {
    activeModelId: state?.modelId ?? draftModelId,
    defaultModelId,
    pendingModelId: switching ? switchingTo?.modelId : undefined,
    isLoading: sessionModelsQuery.isPending,
    error: sessionModelsQuery.error ?? undefined,
    setModel: modelId => switchModel({ modelId }),
  };
}
