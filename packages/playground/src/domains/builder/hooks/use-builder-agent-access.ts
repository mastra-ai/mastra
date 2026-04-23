import { useBuilderSettings } from './use-builder-settings';
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
  /** Loading state (false if skipped due to missing permissions) */
  isLoading: boolean;
  /** Error from settings fetch (null if skipped) */
  error: Error | null;
  /** Reason access is denied, null if allowed */
  denialReason: DenialReason;
  /** Whether builder.enabled is true */
  isBuilderEnabled: boolean;
  /** Whether features.agent is defined */
  hasAgentFeature: boolean;
  /** Whether user has both agents:read and stored-agents:write */
  hasRequiredPermissions: boolean;
  /** Final access decision: all checks pass */
  canAccessAgentBuilder: boolean;
  /** Agent feature flags from builder config */
  agentFeatures: AgentFeatureFlags | undefined;
}

/**
 * Unified access check for Agent Builder.
 *
 * Checks:
 * 1. Permissions (agents:read + stored-agents:write) — checked first to avoid 403 on settings fetch
 * 2. Builder enabled (builder.enabled === true)
 * 3. Agent feature defined (features.agent exists)
 *
 * Returns `canAccessAgentBuilder: true` only when all checks pass.
 */
export function useBuilderAgentAccess(): UseBuilderAgentAccessResult {
  const { hasAllPermissions, rbacEnabled } = usePermissions();

  // Check permissions FIRST — before fetching settings
  const hasRequiredPermissions = !rbacEnabled || hasAllPermissions(['agents:read', 'stored-agents:write']);

  // Only fetch settings if user has agents:read permission
  const canFetchSettings = !rbacEnabled || hasAllPermissions(['agents:read']);
  const {
    data: builderSettings,
    isLoading,
    error,
  } = useBuilderSettings({
    enabled: canFetchSettings,
  });

  // Check builder state
  const isBuilderEnabled = builderSettings?.enabled === true;
  const hasAgentFeature = builderSettings?.features?.agent !== undefined;

  // Combined access decision
  const canAccessAgentBuilder = hasRequiredPermissions && isBuilderEnabled && hasAgentFeature;

  // Determine denial reason (priority order)
  const denialReason: DenialReason = !hasRequiredPermissions
    ? 'permission-denied'
    : error
      ? 'error'
      : !isBuilderEnabled
        ? 'not-configured'
        : !hasAgentFeature
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
