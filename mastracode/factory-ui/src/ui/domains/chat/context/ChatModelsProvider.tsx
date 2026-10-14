import type { ReactNode } from 'react';
import { useState } from 'react';

import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useChatModelScope } from './useChatModelScope';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
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
  const defaultModelId =
    (modelScope === 'factory' ? factoryProjectQuery.data?.defaultModelId : defaultModelQuery.data?.modelId) ??
    undefined;
  const value: ChatModelsApi = {
    activeModelId: draftModelId ?? defaultModelId ?? factoryProjectQuery.data?.defaultModelId ?? undefined,
    defaultModelId,
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
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const { projectQuery, modelScope } = useChatModelScope();
  const defaultModelQuery = useDefaultModelQuery();
  const defaultModelId =
    (modelScope === 'factory' ? projectQuery.data?.defaultModelId : defaultModelQuery.data?.modelId) ?? undefined;
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const value: ChatModelsApi = {
    activeModelId: state?.modelId,
    defaultModelId,
    isLoading: false,
    error: undefined,
    setModel: modelId => switchModel({ modelId }),
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
