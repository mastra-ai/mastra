import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useChatModelScope } from './useChatModelScope';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { chatStartModelId, routedDefaultModelId } from './chatDefaultModel';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';
import { useChatConnection } from './useChatConnection';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatModelsProviderProps {
  children: ReactNode;
}

export function ChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { draftSessionId } = useChatSessionContext();
  return draftSessionId ? (
    <DraftChatModelsProvider>{children}</DraftChatModelsProvider>
  ) : (
    <LiveChatModelsProvider>{children}</LiveChatModelsProvider>
  );
}

function DraftChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { projectQuery: factoryProjectQuery, modelScope } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const [draftModelId, setDraftModelId] = useState<string>();
  const defaults = { factory: factoryProjectQuery.data?.defaultModelId, personal: defaultModelQuery.data?.modelId };
  const value: ChatModelsApi = {
    activeModelId: draftModelId ?? chatStartModelId(modelScope, defaults),
    defaultModelId: routedDefaultModelId(modelScope, defaults),
    isLoading: factoryProjectQuery.isPending || defaultModelQuery.isPending,
    error: defaultModelQuery.error ?? factoryProjectQuery.error ?? undefined,
    setModel: modelId => {
      setDraftModelId(modelId);
      return Promise.resolve();
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
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
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const value: ChatModelsApi = {
    activeModelId: state?.modelId,
    defaultModelId,
    isLoading: sessionModelsQuery.isPending,
    error: sessionModelsQuery.error ?? undefined,
    setModel: modelId => switchModel({ modelId }),
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
