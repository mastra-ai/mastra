import { useAuthCapabilities } from './use-auth-capabilities';
import { usePermissions } from './use-permissions';

export type AgentVersionAccess = {
  canRead: boolean;
  canPublish: boolean;
  canExecute: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
};

/** Resource-scoped permission view for agent version management and execution. */
export const useAgentVersionAccess = (agentId?: string): AgentVersionAccess => {
  const { hasPermission, isLoading } = usePermissions();
  const authorizationQuery = useAuthCapabilities();
  const isAuthorizationPending = isLoading || authorizationQuery.isFetching;
  const authorizationReady =
    !isAuthorizationPending && !authorizationQuery.isError && authorizationQuery.data !== undefined && Boolean(agentId);

  return {
    canRead: authorizationReady && hasPermission(`stored-agents:read:${agentId}`),
    canPublish: authorizationReady && hasPermission(`stored-agents:publish:${agentId}`),
    canExecute: authorizationReady && hasPermission(`agents:execute:${agentId}`),
    isLoading: isAuthorizationPending,
    isFetching: authorizationQuery.isFetching,
    isError: authorizationQuery.isError,
  };
};
