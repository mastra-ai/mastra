import { useAgentStudioPreviewMode } from './use-agent-studio-preview-mode';
import { useIsAgentStudioAvailable } from './use-is-agent-studio-available';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

/**
 * Determines whether the end-user Agent Studio experience (recents sidebar,
 * marketplace, configure) should be shown instead of the default admin
 * Studio sidebar.
 *
 * Rules:
 *   - The feature must be enabled on the server (MastraAgentBuilder attached).
 *   - End-users need `stored-agents:read` to participate in the studio — without
 *     it, they can't see agents anyway, so we fall back to the admin sidebar.
 *   - Admins (RBAC off, or full `*` grant) see it only when they flip the
 *     "View as end-user" preview toggle.
 */
export const useShouldShowAgentStudio = () => {
  const { isAgentStudioAvailable } = useIsAgentStudioAvailable();
  const { hasPermission, rbacEnabled } = usePermissions();
  const { isPreviewMode, setPreviewMode } = useAgentStudioPreviewMode();

  // When RBAC is off, treat everyone as an admin — they already have full access.
  const isAdmin = !rbacEnabled || hasPermission('*');

  // Only users who can read stored agents participate in the agent studio.
  const canUseStudio = hasPermission('stored-agents:read');

  const showAgentStudio = isAgentStudioAvailable && canUseStudio && (!isAdmin || isPreviewMode);

  return {
    showAgentStudio,
    isAgentStudioAvailable,
    isAdmin,
    isPreviewMode,
    setPreviewMode,
  };
};
