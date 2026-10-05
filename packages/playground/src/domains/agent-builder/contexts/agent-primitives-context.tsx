import type { MastraClient, StoredSkillResponse } from '@mastra/client-js';
import type { StoredAgent } from '@mastra/react/hooks';
import {
  useWorkflows,
  useStoredWorkspaces,
  useTools,
  useCurrentUser,
  useAgents,
  useStoredAgent,
  useStoredSkills,
} from '@mastra/react/hooks';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AvailableWorkspace } from '../hooks/use-agent-builder-tool';
import { useBuilderAgentAccess } from '../hooks/use-builder-agent-access';
import { useBuilderAgentFeatures } from '../hooks/use-builder-agent-features';
import { useStarterUserMessage } from '../hooks/use-starter-user-message';

type ToolsData = Awaited<ReturnType<MastraClient['listTools']>>;
type AgentsData = Awaited<ReturnType<MastraClient['listAgents']>>;
type WorkflowsData = Awaited<ReturnType<MastraClient['listWorkflows']>>;

export interface AgentPrimitivesValue {
  agentId: string;
  storedAgent?: StoredAgent;
  toolsData: ToolsData;
  agentsData: AgentsData;
  workflowsData: WorkflowsData;
  availableSkills: StoredSkillResponse[];
  availableWorkspaces: AvailableWorkspace[];
  initialUserMessage: string | undefined;
  isOwner: boolean;
  canWrite: boolean;
  isReady: boolean;
}

const AgentPrimitivesContext = createContext<AgentPrimitivesValue | null>(null);

interface AgentPrimitivesProviderProps {
  agentId: string;
  children: ReactNode;
}

/**
 * Loads and shapes the data the edit/view surfaces share: stored agent,
 * tools/agents/workflows pickers, skills, workspaces, current user, and the
 * starter user message. Computes `isReady`, `isOwner`, and `canWrite` so
 * downstream components don't have to repeat the same gating logic.
 */
export const AgentPrimitivesProvider = ({ agentId, children }: AgentPrimitivesProviderProps) => {
  const features = useBuilderAgentFeatures();
  const { canWrite } = useBuilderAgentAccess();
  const initialUserMessage = useStarterUserMessage();

  const { data: storedAgent, isLoading: isStoredAgentLoading } = useStoredAgent({
    agentId: agentId,
    status: 'draft',
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { data: toolsData, isPending: isToolsPending } = useTools({ queryOptions: { enabled: features.tools } });
  const { data: agentsData, isPending: isAgentsPending } = useAgents({ queryOptions: { enabled: features.agents } });
  const { data: workflowsData, isPending: isWorkflowsPending } = useWorkflows({
    queryOptions: { enabled: features.workflows },
  });
  const { data: storedSkillsResponse, isPending: isSkillsPending } = useStoredSkills({
    queryOptions: { enabled: features.skills },
  });
  const { data: workspacesData } = useStoredWorkspaces();
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();

  const isOwner = !storedAgent?.authorId || currentUser?.id === storedAgent.authorId;
  const isOwnershipLoading = Boolean(storedAgent?.authorId) && isCurrentUserLoading;

  const isReady =
    Boolean(agentId) &&
    !isStoredAgentLoading &&
    !isOwnershipLoading &&
    (!features.tools || !isToolsPending) &&
    (!features.skills || !isSkillsPending) &&
    (!features.agents || !isAgentsPending) &&
    (!features.workflows || !isWorkflowsPending);

  const availableWorkspaces = useMemo<AvailableWorkspace[]>(
    () =>
      (workspacesData?.workspaces ?? [])
        .filter(ws => ws.status !== 'archived')
        .sort((a, b) => (b.runtimeRegistered ? 1 : 0) - (a.runtimeRegistered ? 1 : 0))
        .map(ws => ({ id: ws.id, name: ws.name })),
    [workspacesData],
  );

  const availableSkills = useMemo<StoredSkillResponse[]>(
    () => storedSkillsResponse?.skills ?? [],
    [storedSkillsResponse],
  );

  const value = useMemo<AgentPrimitivesValue>(
    () => ({
      agentId: agentId!,
      storedAgent: storedAgent ?? undefined,
      toolsData: toolsData ?? {},
      agentsData: agentsData ?? {},
      workflowsData: workflowsData ?? {},
      availableSkills,
      availableWorkspaces,
      initialUserMessage,
      isOwner,
      canWrite,
      isReady,
    }),
    [
      agentId,
      storedAgent,
      toolsData,
      agentsData,
      workflowsData,
      availableSkills,
      availableWorkspaces,
      initialUserMessage,
      isOwner,
      canWrite,
      isReady,
    ],
  );

  return <AgentPrimitivesContext.Provider value={value}>{children}</AgentPrimitivesContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAgentPrimitives = (): AgentPrimitivesValue => {
  const ctx = useContext(AgentPrimitivesContext);
  if (!ctx) {
    throw new Error('useAgentPrimitives must be used inside <AgentPrimitivesProvider>');
  }
  return ctx;
};
