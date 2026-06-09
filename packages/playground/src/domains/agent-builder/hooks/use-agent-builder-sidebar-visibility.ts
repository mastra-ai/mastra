import { useBuilderAgentAccess } from './use-builder-agent-access';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';

export interface UseAgentBuilderSidebarVisibilityResult {
  isVisible: boolean;
}

/**
 * Visibility rule for the top-left "Agent Builder" sidebar shortcut.
 *
 * The entry is shown when:
 * - Auth capabilities have resolved.
 * - Either auth is disabled (single local user) OR the user is authenticated.
 * - Agent Builder is configured and enabled, and the user has the
 *   `stored-agents:read` / `:write` permission required to access it.
 *   This matches `useBuilderAgentAccess().canAccessAgentBuilder`, which is
 *   the same signal `AgentBuilderRootLayout` uses to gate `/agent-builder/*`.
 *   Members with `stored-agents:read` can reach the view page, so they
 *   should also see the sidebar shortcut.
 */
export function useAgentBuilderSidebarVisibility(): UseAgentBuilderSidebarVisibilityResult {
  const { data: capabilities, isLoading: capabilitiesLoading } = useAuthCapabilities();
  const { isLoading: builderAccessLoading, canAccessAgentBuilder } = useBuilderAgentAccess();

  if (capabilitiesLoading || builderAccessLoading) {
    return { isVisible: false };
  }

  if (!capabilities) {
    return { isVisible: false };
  }

  const isAuthDisabled = !capabilities.enabled;
  if (!isAuthDisabled && !isAuthenticated(capabilities)) {
    return { isVisible: false };
  }

  return { isVisible: canAccessAgentBuilder };
}
