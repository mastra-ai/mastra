import type { PermissionPolicy, PermissionRules, ToolCategory } from '@mastra/client-js';
import { createContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface ChatPermissionsApi {
  permissions: PermissionRules | undefined;
  permissionsLoading: boolean;
  permissionsError: Error | undefined;
  pendingPermissionCategory: ToolCategory | undefined;
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
}

interface ChatPermissionsQueryValue {
  data: PermissionRules | undefined;
  isLoading: boolean;
  error: Error | null;
}

interface SetPermissionMutationValue {
  mutateAsync: (variables: { category: ToolCategory; policy: PermissionPolicy }) => Promise<void>;
}

export const ChatPermissionsQueryContext = createContext<ChatPermissionsQueryValue | undefined>(undefined);
export const SetPermissionMutationContext = createContext<SetPermissionMutationValue | undefined>(undefined);
export const PendingPermissionCategoryContext = createContext<ToolCategory | undefined>(undefined);
export const SetPendingPermissionCategoryContext = createContext<
  Dispatch<SetStateAction<ToolCategory | undefined>> | undefined
>(undefined);
