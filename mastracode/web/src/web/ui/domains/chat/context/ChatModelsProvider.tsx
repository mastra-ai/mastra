import type { ReactNode } from 'react';

import { useSwitchAgentControllerModelMutation } from '../hooks/useAgentControllerStateMutations';
import { ChatModelsContext } from './ChatModelsContext';
import type { ChatModelsApi } from './ChatModelsContext';

interface ChatModelsProviderProps {
  children: ReactNode;
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
  sessionModelId?: string;
  transcriptModelId?: string;
}

export function ChatModelsProvider({
  children,
  agentControllerId,
  resourceId,
  baseUrl,
  enabled = true,
  sessionModelId,
  transcriptModelId,
}: ChatModelsProviderProps) {
  const switchModelMutation = useSwitchAgentControllerModelMutation({ agentControllerId, resourceId, baseUrl, enabled });
  const value: ChatModelsApi = {
    activeModelId: sessionModelId ?? transcriptModelId,
    setModel: modelId => switchModelMutation.mutateAsync(modelId),
  };

  return <ChatModelsContext.Provider value={value}>{children}</ChatModelsContext.Provider>;
}
