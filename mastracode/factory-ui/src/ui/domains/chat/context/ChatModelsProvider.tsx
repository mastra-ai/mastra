import type { ReactNode } from 'react';
import { useState } from 'react';

import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
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
  const { resourceId, projectPath, baseUrl, sessionEnabled, draftSessionId, factorySessionState } =
    useChatSessionContext();
  const { state } = useChatConnection();
  const switchModelMutation = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  // A draft has no session to hold a model, so the pick lives here and travels
  // with the prompt that creates the session. It starts on the Factory default.
  const factoryProjectQuery = useFactoryProjectQuery(
    draftSessionId ? factorySessionState?.factoryProjectId : undefined,
  );
  const [draftModelId, setDraftModelId] = useState<string>();

  const value: ChatModelsApi = draftSessionId
    ? {
        activeModelId: draftModelId ?? factoryProjectQuery.data?.defaultModelId ?? undefined,
        setModel: modelId => Promise.resolve(setDraftModelId(modelId)),
      }
    : {
        activeModelId: state?.modelId,
        setModel: modelId => switchModelMutation.mutateAsync(modelId),
      };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
