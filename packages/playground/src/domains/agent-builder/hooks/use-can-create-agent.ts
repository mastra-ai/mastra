import { useBuilderAgentAccess } from './use-builder-agent-access';

const BUILDER_AGENT_CREATE_ROUTE = '/agent-builder/agents/create';

export interface UseCanCreateAgentResult {
  canCreateAgent: boolean;
  createRoute: string;
  isLoading: boolean;
}

export const useCanCreateAgent = (): UseCanCreateAgentResult => {
  const { canAccessAgentBuilder, canWrite, isLoading } = useBuilderAgentAccess();

  const canCreateAgent = canAccessAgentBuilder && canWrite;
  const createRoute = BUILDER_AGENT_CREATE_ROUTE;

  return { canCreateAgent, createRoute, isLoading };
};
