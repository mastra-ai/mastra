import type { StoredSkillResponse } from '@mastra/client-js';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ConversationPanelProvider } from '../components/agent-edit/conversation-panel';
import { useAutosaveAgent } from '../hooks/use-autosave-agent';
import type { useBuilderAgentFeatures } from '../hooks/use-builder-agent-features';
import { useBuilderAgentFeatures as useFeatures } from '../hooks/use-builder-agent-features';
import type { AgentTool } from '../types/agent-tool';
import { useAgentPrimitives } from './agent-primitives-context';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

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

/**
 * Owns the edit-page shared state and the chat conversation provider.
 *
 * Pulls fetched data from `<AgentPrimitivesProvider>` and only takes the
 * form-derived inputs (`availableAgentTools`) plus the navigation callback
 * as props. Wraps `<ConversationPanelProvider>` internally so the page tree
 * has a single place where edit-page state and chat state are introduced.
 */
export const EditPageProvider = ({
  storedAgent,
  availableAgentTools,
  onModeToggle,
  children,
}: EditPageProviderProps) => {
  const { agentId, availableSkills, availableWorkspaces, initialUserMessage, isOwner } = useAgentPrimitives();
  const features = useFeatures();

  // Gate publishing on the *saved* visibility — unsaved form edits should not unlock publishing.
  const canPublishToChannel = isOwner && storedAgent.visibility === 'public';
  const isFreshThread = initialUserMessage !== undefined;

  const autosave = useAutosaveAgent({ agentId: agentId!, availableAgentTools, availableSkills });

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
