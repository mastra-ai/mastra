import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useIsBuilderEnabled } from '@/domains/builder/hooks/use-builder-settings';

export const useCanCreateAgent = () => {
  const { hasPermission, rbacEnabled } = usePermissions();
  const { isEnabled: isBuilderEnabled } = useIsBuilderEnabled();

  // Legacy: env var check (for users without EE license)
  const hasEnvFlag =
    typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI === 'true';

  // New: builder enabled (EE) + RBAC permission
  const hasBuilderAccess = isBuilderEnabled && (!rbacEnabled || hasPermission('stored-agents:write'));

  return { canCreateAgent: hasEnvFlag || hasBuilderAccess };
};
