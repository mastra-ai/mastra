import type { ToolCategory } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAgentControllerPermissions } from '../../../../../shared/hooks/useAgentControllerPermissions';
import { useSetPermissionForCategoryMutation } from '../../../../../shared/hooks/useAgentControllerPermissionMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import {
  ChatPermissionsQueryContext,
  PendingPermissionCategoryContext,
  SetPendingPermissionCategoryContext,
  SetPermissionMutationContext,
} from './ChatPermissionsContext';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatPermissionsProviderProps {
  children: ReactNode;
}

export function ChatPermissionsProvider({ children }: ChatPermissionsProviderProps) {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const [pendingPermissionCategory, setPendingPermissionCategory] = useState<ToolCategory>();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const permissionsQuery = useAgentControllerPermissions(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

  return (
    <ChatPermissionsQueryContext.Provider value={permissionsQuery}>
      <SetPermissionMutationContext.Provider value={setPermissionForCategoryMutation}>
        <PendingPermissionCategoryContext.Provider value={pendingPermissionCategory}>
          <SetPendingPermissionCategoryContext.Provider value={setPendingPermissionCategory}>
            {children}
          </SetPendingPermissionCategoryContext.Provider>
        </PendingPermissionCategoryContext.Provider>
      </SetPermissionMutationContext.Provider>
    </ChatPermissionsQueryContext.Provider>
  );
}
