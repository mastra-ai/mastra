import { useIsAgentStudioAvailable } from '@/domains/agent-studio/hooks/use-is-agent-studio-available';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

/**
 * Determines whether the current user can create agents from the UI.
 *
 * Satisfied by either:
 *   - the legacy `MASTRA_EXPERIMENTAL_UI` window flag (kept for compat), or
 *   - the EE Agent Builder being enabled AND the user holding
 *     `stored-agents:write` (or RBAC being disabled entirely).
 */
export const useCanCreateAgent = () => {
  const { isAgentStudioAvailable } = useIsAgentStudioAvailable();
  const { hasPermission, rbacEnabled } = usePermissions();

  const legacyFlagEnabled =
    typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI === 'true';

  const agentStudioAllows = isAgentStudioAvailable && (!rbacEnabled || hasPermission('stored-agents:write'));

  return { canCreateAgent: legacyFlagEnabled || agentStudioAllows };
};
