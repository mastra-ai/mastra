import { useBuilderAgentAccess } from '@/domains/builder/hooks/use-builder-agent-access';

// CMS route used for legacy env-var mode
const CMS_AGENT_CREATE_ROUTE = '/cms/agents/create';
// Builder route for agent creation (Phase 2 adds this route)
const BUILDER_AGENT_CREATE_ROUTE = '/agent-builder/agents/create';

export interface UseCanCreateAgentResult {
  /** Whether user can create agents (via env flag or builder access) */
  canCreateAgent: boolean;
  /** Route to navigate to for agent creation */
  createRoute: string;
  /** Loading state */
  isLoading: boolean;
}

export const useCanCreateAgent = (): UseCanCreateAgentResult => {
  const { canAccessAgentBuilder, isLoading } = useBuilderAgentAccess();

  // Legacy: env var check (for users without EE license)
  const hasEnvFlag =
    typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI === 'true';

  const canCreateAgent = hasEnvFlag || canAccessAgentBuilder;

  // Route to builder if has builder access, else CMS for legacy env mode
  const createRoute = canAccessAgentBuilder ? BUILDER_AGENT_CREATE_ROUTE : CMS_AGENT_CREATE_ROUTE;

  return { canCreateAgent, createRoute, isLoading };
};
