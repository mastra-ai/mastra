import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export type WorkflowBuilderDenialReason = 'permission-denied' | 'not-configured' | 'error' | null;

export const useWorkflowBuilderSettings = (enabled = true) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workflow-builder-settings'],
    queryFn: () => client.getWorkflowBuilderSettings(),
    enabled,
  });
};

export const useWorkflowBuilderAccess = () => {
  const { hasAnyPermission, hasPermission, canExecute, rbacEnabled } = usePermissions();
  const canRead = !rbacEnabled || hasAnyPermission(['stored-workflows:read', 'stored-workflows:write']);
  const canWrite = !rbacEnabled || hasPermission('stored-workflows:write');
  const canRun = !rbacEnabled || canExecute('workflows');
  const settings = useWorkflowBuilderSettings(canRead);
  const isBuilderEnabled = settings.data?.enabled === true;

  const denialReason: WorkflowBuilderDenialReason = !canRead
    ? 'permission-denied'
    : settings.error
      ? 'error'
      : !isBuilderEnabled
        ? 'not-configured'
        : null;

  return {
    isLoading: canRead && settings.isLoading,
    error: canRead ? (settings.error as Error | null) : null,
    denialReason,
    canRead,
    canWrite,
    canRun,
    isBuilderEnabled,
    canUseBuilder: canRead && canWrite && isBuilderEnabled,
    modelPolicy: settings.data?.modelPolicy,
  };
};
