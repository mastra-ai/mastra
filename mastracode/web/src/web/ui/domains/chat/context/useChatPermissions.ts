import { useContext } from 'react';

import {
  ChatPermissionsQueryContext,
  PendingPermissionCategoryContext,
  SetPendingPermissionCategoryContext,
  SetPermissionMutationContext,
} from './ChatPermissionsContext';
import type { ChatPermissionsApi } from './ChatPermissionsContext';

export function useChatPermissions(): ChatPermissionsApi {
  const permissionsQuery = useContext(ChatPermissionsQueryContext);
  const setPermissionMutation = useContext(SetPermissionMutationContext);
  const pendingPermissionCategory = useContext(PendingPermissionCategoryContext);
  const setPendingPermissionCategory = useContext(SetPendingPermissionCategoryContext);

  if (
    permissionsQuery === undefined ||
    setPermissionMutation === undefined ||
    setPendingPermissionCategory === undefined
  ) {
    throw new Error('useChatPermissions must be used within a ChatPermissionsProvider');
  }

  const setPermissionForCategory: ChatPermissionsApi['setPermissionForCategory'] = async (category, policy) => {
    setPendingPermissionCategory(category);
    try {
      await setPermissionMutation.mutateAsync({ category, policy });
    } finally {
      setPendingPermissionCategory(undefined);
    }
  };

  return {
    permissions: permissionsQuery.data,
    permissionsLoading: permissionsQuery.isLoading,
    permissionsError: permissionsQuery.error ?? undefined,
    pendingPermissionCategory,
    setPermissionForCategory,
  };
}
