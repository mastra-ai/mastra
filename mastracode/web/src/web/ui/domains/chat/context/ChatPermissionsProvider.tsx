import type { PermissionPolicy, ToolCategory } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAgentControllerPermissions } from '../../../../../shared/hooks/useAgentControllerPermissions';
import { useSetPermissionForCategoryMutation } from '../../../../../shared/hooks/useAgentControllerPermissionMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatPermissionsContext } from './ChatPermissionsContext';
import type { ChatPermissionsApi } from './ChatPermissionsContext';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatPermissionsProviderProps {
  children: ReactNode;
}

export function ChatPermissionsProvider({ children }: ChatPermissionsProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const [pendingPermissionCategory, setPendingPermissionCategory] = useState<ToolCategory | null>(null);
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const permissionsQuery = useAgentControllerPermissions(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

  const setPermissionForCategory = async (category: ToolCategory, policy: PermissionPolicy) => {
    setPendingPermissionCategory(category);
    try {
      await setPermissionForCategoryMutation.mutateAsync({ category, policy });
    } finally {
      setPendingPermissionCategory(null);
    }
  };

  const value: ChatPermissionsApi = {
    permissions: permissionsQuery.data,
    permissionsLoading: permissionsQuery.isLoading,
    pendingPermissionCategory,
    setPermissionForCategory,
  };

  return <ChatPermissionsContext.Provider value={value}>{children}</ChatPermissionsContext.Provider>;
}
