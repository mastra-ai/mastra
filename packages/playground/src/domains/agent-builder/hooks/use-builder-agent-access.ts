import { useBuilderSettings } from '@/domains/agent-builder/hooks/use-builder-settings';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export type DenialReason = 'permission-denied' | 'not-configured' | 'error' | null;

export interface AgentFeatureFlags {
  tools?: boolean;
  agents?: boolean;
  workflows?: boolean;
  scorers?: boolean;
  skills?: boolean;
  memory?: boolean;
  variables?: boolean;
}

export interface UseBuilderAgentAccessResult {
  isLoading: boolean;
  error: Error | null;
  denialReason: DenialReason;
  isBuilderEnabled: boolean;
  hasAgentFeature: boolean;
  hasRequiredPermissions: boolean;
  canAccessAgentBuilder: boolean;
  canWrite: boolean;
  canExecute: boolean;
  canManageSkills: boolean;
  canUseFavorites: boolean;
  agentFeatures: AgentFeatureFlags | undefined;
}

export function useBuilderAgentAccess(): UseBuilderAgentAccessResult {
  const { hasAnyPermission, hasPermission, rbacEnabled } = usePermissions();

  // Access requires read OR write (operators can browse but not create)
  const hasRequiredPermissions = !rbacEnabled || hasAnyPermission(['stored-agents:read', 'stored-agents:write']);
  const canFetchSettings = !rbacEnabled || hasAnyPermission(['stored-agents:read', 'stored-agents:write']);

  // Granular capability flags
  const canWrite = !rbacEnabled || hasPermission('stored-agents:write');
  const canExecute = !rbacEnabled || hasAnyPermission(['stored-agents:read', 'stored-agents:write']);
  const canManageSkills = !rbacEnabled || hasPermission('stored-skills:read');
  const canUseFavorites = !rbacEnabled || hasAnyPermission(['stored-agents:read', 'stored-skills:read']);

  const {
    data: builderSettings,
    isLoading,
    error,
  } = useBuilderSettings({
    enabled: canFetchSettings,
  });

  const isBuilderEnabled = builderSettings?.enabled === true;
  const hasAgentFeature = builderSettings?.features?.agent !== undefined;
  const canAccessAgentBuilder = hasRequiredPermissions && isBuilderEnabled && hasAgentFeature;

  const denialReason: DenialReason = !hasRequiredPermissions
    ? 'permission-denied'
    : error
      ? 'error'
      : !isBuilderEnabled || !hasAgentFeature
        ? 'not-configured'
        : null;

  return {
    isLoading: canFetchSettings && isLoading,
    error: canFetchSettings ? (error as Error | null) : null,
    denialReason,
    isBuilderEnabled,
    hasAgentFeature,
    hasRequiredPermissions,
    canAccessAgentBuilder,
    canWrite,
    canExecute,
    canManageSkills,
    canUseFavorites,
    agentFeatures: builderSettings?.features?.agent as AgentFeatureFlags | undefined,
  };
}
