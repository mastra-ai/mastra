import { FACTORY_FALLBACK_THINKING_LEVEL } from '@mastra/factory/session/model-selection';
import type { ModelSelection } from '@mastra/factory/session/model-selection';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { DefaultModelResponse } from '../../../../api/types';
import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import type { FactoryProjectPayload } from '../../workspaces/services/github';
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
  const { factorySessionState } = useChatSessionContext();
  const factoryProjectQuery = useFactoryProjectQuery(factorySessionState?.factoryProjectId);
  const defaultModelQuery = useDefaultModelQuery();
  const [draftModelId, setDraftModelId] = useState<string>();
  const isLoading = factoryProjectQuery.isPending || defaultModelQuery.isPending;
  const defaultModel = draftDefaultModel(defaultModelQuery.data, factoryProjectQuery.data);
  const value: ChatModelsApi = {
    activeModelId: draftModelId ?? defaultModel?.modelId,
    defaultModelId: defaultModel?.modelId,
    defaultThinkingLevel: isLoading ? undefined : (defaultModel?.thinkingLevel ?? FACTORY_FALLBACK_THINKING_LEVEL),
    isLoading,
    error: defaultModelQuery.error ?? factoryProjectQuery.error ?? undefined,
    setModel: modelId => {
      setDraftModelId(modelId);
      return Promise.resolve();
    },
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}

function draftDefaultModel(
  personal: DefaultModelResponse | undefined,
  factory: FactoryProjectPayload | undefined,
): ModelSelection | undefined {
  if (personal?.modelId) return { modelId: personal.modelId, thinkingLevel: personal.thinkingLevel };
  if (factory?.defaultModelId) return { modelId: factory.defaultModelId, thinkingLevel: null };
  return undefined;
}

function LiveChatModelsProvider({ children }: ChatModelsProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { state } = useChatConnection();
  const defaultModelQuery = useDefaultModelQuery();
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const value: ChatModelsApi = {
    activeModelId: state?.modelId,
    defaultModelId: defaultModelQuery.data?.modelId ?? undefined,
    defaultThinkingLevel: FACTORY_FALLBACK_THINKING_LEVEL,
    isLoading: false,
    error: undefined,
    setModel: modelId => switchModel({ modelId }),
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
