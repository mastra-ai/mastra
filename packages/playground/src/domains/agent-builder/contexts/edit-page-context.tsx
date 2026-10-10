import type { StoredSkillResponse } from '@mastra/client-js';
import type { StoredAgent } from '@mastra/react/hooks/agents';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ConversationPanelProvider } from '../components/agent-edit/conversation-panel';
import { useAutosaveAgent } from '../hooks/use-autosave-agent';
import type { useBuilderAgentFeatures } from '../hooks/use-builder-agent-features';
import { useBuilderAgentFeatures as useFeatures } from '../hooks/use-builder-agent-features';
import type { AgentTool } from '../types/agent-tool';
import { useAgentPrimitives } from './agent-primitives-context';

type Features = ReturnType<typeof useBuilderAgentFeatures>;

export interface EditPageContextValue {
  agentId: string;
  isOwner: boolean;
  canPublishToChannel: boolean;
  features: Features;
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  availableWorkspaces: ReturnType<typeof useAgentPrimitives>['availableWorkspaces'];
  autosave: ReturnType<typeof useAutosaveAgent>;
  onModeToggle: (() => void) | undefined;
}

const EditPageContext = createContext<EditPageContextValue | null>(null);

interface EditPageProviderProps {
  storedAgent: StoredAgent;
  availableAgentTools: AgentTool[];
  onModeToggle: (() => void) | undefined;
  children: ReactNode;
}

export const EditPageProvider = ({
  storedAgent,
  availableAgentTools,
  onModeToggle,
  children,
}: EditPageProviderProps) => {
  const { agentId, availableSkills, availableWorkspaces, initialUserMessage, isOwner } = useAgentPrimitives();
  const features = useFeatures();

  const canPublishToChannel = isOwner && storedAgent.visibility === 'public';
  const isFreshThread = initialUserMessage !== undefined;

  const autosave = useAutosaveAgent({ storedAgent, availableAgentTools, availableSkills });

  const value = useMemo<EditPageContextValue>(
    () => ({
      agentId: agentId!,
      isOwner,
      canPublishToChannel,
      features,
      availableAgentTools,
      availableSkills,
      availableWorkspaces,
      autosave,
      onModeToggle,
    }),
    [
      agentId,
      isOwner,
      canPublishToChannel,
      features,
      availableAgentTools,
      availableSkills,
      availableWorkspaces,
      autosave,
      onModeToggle,
    ],
  );

  return (
    <EditPageContext.Provider value={value}>
      <ConversationPanelProvider
        agentId={agentId!}
        features={features}
        availableAgentTools={availableAgentTools}
        availableWorkspaces={availableWorkspaces}
        availableSkills={availableSkills}
        initialUserMessage={initialUserMessage}
        isFreshThread={isFreshThread}
        toolsReady
      >
        {children}
      </ConversationPanelProvider>
    </EditPageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useEditPage = (): EditPageContextValue => {
  const ctx = useContext(EditPageContext);
  if (!ctx) {
    throw new Error('useEditPage must be used inside <EditPageProvider>');
  }
  return ctx;
};
