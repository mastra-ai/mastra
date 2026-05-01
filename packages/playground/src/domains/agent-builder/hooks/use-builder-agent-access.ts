import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';

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
  agentFeatures: AgentFeatureFlags | undefined;
}

export function useBuilderAgentAccess(): UseBuilderAgentAccessResult {
  const { hasAllPermissions, rbacEnabled } = usePermissions();

  const hasRequiredPermissions = !rbacEnabled || hasAllPermissions(['stored-agents:read', 'stored-agents:write']);
  const canFetchSettings = !rbacEnabled || hasAllPermissions(['stored-agents:read']);
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
    agentFeatures: builderSettings?.features?.agent as AgentFeatureFlags | undefined,
  };
}
