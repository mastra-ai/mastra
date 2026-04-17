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
 *   - End-users (no `stored-agents:write`) always see it when it's available.
 *   - Admins see it only when they flip the "View as end-user" preview toggle.
 */
export const useShouldShowAgentStudio = () => {
  const { isAgentStudioAvailable } = useIsAgentStudioAvailable();
  const { hasPermission, rbacEnabled } = usePermissions();
  const { isPreviewMode, setPreviewMode } = useAgentStudioPreviewMode();

  // When RBAC is off, treat everyone as an admin — they already have full access.
  const isAdmin = !rbacEnabled || hasPermission('stored-agents:write');

  const showAgentStudio = isAgentStudioAvailable && (!isAdmin || isPreviewMode);

  return {
    showAgentStudio,
    isAgentStudioAvailable,
    isAdmin,
    isPreviewMode,
    setPreviewMode,
  };
};
