import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AgentChatPanelProvider } from '../components/agent-edit/agent-chat-panel';
import { useBuilderAgentFeatures } from '../hooks/use-builder-agent-features';
import type { AgentConfig } from '../services/stored-agent-to-agent-config';
import { storedAgentToAgentConfig } from '../services/stored-agent-to-agent-config';
import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

export interface ViewPageContextValue {
  agentId: string;
  isOwner: boolean;
  /** True when the current user can modify this agent (write access + ownership). */
  canModify: boolean;
  /** True when the *saved* visibility is public — unsaved edits never unlock publishing. */
  isPublishable: boolean;
  /** True when the browser feature is enabled and the stored agent has a browser config. */
  hasBrowser: boolean;
  /** The view-facing agent config derived from the stored agent. */
  agent: AgentConfig;
  /** Memory thread id; falls back to the agent id when no current user. */
  threadId: string;
  /** Navigate to the edit page; undefined for non-owners. */
  onModeToggle: (() => void) | undefined;
}

const ViewPageContext = createContext<ViewPageContextValue | null>(null);

interface ViewPageProviderProps {
  agentId: string;
  storedAgent: StoredAgent;
  currentUserId: string | undefined;
  canWrite: boolean;
  children: ReactNode;
}

/**
 * Owns the view-page shared state and the chat panel provider.
 *
 * Receives the already-loaded `storedAgent` and the ambient identity/access
 * (current user id, write capability) from the page so the view does not
 * have to fetch the rest of the builder ecosystem (tools, agents, workflows,
 * skills, workspaces) the way `AgentPrimitivesProvider` does for the editor.
 *
 * Exposes the derivations the view page used to compute inline (mode-toggle
 * navigation, publishability, browser availability, agent config, memory
 * thread id), and wraps `<AgentChatPanelProvider>` so the page tree has a
 * single place where view-page state and chat state are introduced.
 */
export const ViewPageProvider = ({
  agentId,
  storedAgent,
  currentUserId,
  canWrite,
  children,
}: ViewPageProviderProps) => {
  const features = useBuilderAgentFeatures();
  const navigate = useNavigate();

  const agent = useMemo(() => storedAgentToAgentConfig(storedAgent, agentId), [storedAgent, agentId]);
  const isOwner = !storedAgent.authorId || currentUserId === storedAgent.authorId;
  const isPublishable = storedAgent.visibility === 'public';
  const canModify = canWrite && isOwner;
  const hasBrowser = features.browser && storedAgent.browser != null;
  const threadId = currentUserId ? `${currentUserId}-${agentId}` : agentId;

  const onModeToggle = useMemo(
    () => (isOwner ? () => navigate(`/agent-builder/agents/${agentId}/edit`, { viewTransition: true }) : undefined),
    [isOwner, agentId, navigate],
  );

  const value = useMemo<ViewPageContextValue>(
    () => ({
      agentId,
      isOwner,
      canModify,
      isPublishable,
      hasBrowser,
      agent,
      threadId,
      onModeToggle,
    }),
    [agentId, isOwner, canModify, isPublishable, hasBrowser, agent, threadId, onModeToggle],
  );

  return (
    <ViewPageContext.Provider value={value}>
      <AgentChatPanelProvider
        agentId={agentId}
        agentName={storedAgent.name}
        agentDescription={storedAgent.description}
        agentAvatarUrl={agent.avatarUrl}
      >
        {children}
      </AgentChatPanelProvider>
    </ViewPageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useViewPage = (): ViewPageContextValue => {
  const ctx = useContext(ViewPageContext);
  if (!ctx) {
    throw new Error('useViewPage must be used inside <ViewPageProvider>');
  }
  return ctx;
};
