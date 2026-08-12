import type { PermissionPolicy, ToolCategory } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAgentControllerPermissions } from '../../../../hooks/useAgentControllerPermissions';
import { useSetPermissionForCategoryMutation } from '../../../../hooks/useAgentControllerPermissionMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatPermissionsContext } from './ChatPermissionsContext';
import type { ChatPermissionsApi } from './ChatPermissionsContext';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatPermissionsProviderProps {
  children: ReactNode;
}

export function ChatPermissionsProvider({ children }: ChatPermissionsProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled, resourceReady, resourceEnabled } = useChatSessionContext();
  const [pendingPermissionCategory, setPendingPermissionCategory] = useState<ToolCategory | null>(null);
  const commonArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
  };
  // Read permissions as soon as the resource is addressable — the read is
  // resource-keyed and does not require the sandbox. Session-less factory
  // surfaces (routed Settings pages) still address the factory-level session.
  const permissionsQuery = useAgentControllerPermissions({
    ...commonArgs,
    enabled: resourceReady || (resourceEnabled && Boolean(resourceId)),
  });
  // In-session writes wait for sandboxReady (= sessionEnabled). The existing
  // resourceEnabled fallback remains for session-less factory Settings pages,
  // where the factory-level controller resource is already addressable.
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation({
    ...commonArgs,
    enabled: sessionEnabled || (resourceEnabled && Boolean(resourceId)),
  });

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
