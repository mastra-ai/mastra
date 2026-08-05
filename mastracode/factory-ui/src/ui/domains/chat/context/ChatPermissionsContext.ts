import { createContext } from 'react';
import type { PermissionPolicy, PermissionRules, ToolCategory } from '@mastra/client-js';

export interface ChatPermissionsApi {
  permissions: PermissionRules | undefined;
  permissionsLoading: boolean;
  pendingPermissionCategory: ToolCategory | null;
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
}

export const ChatPermissionsContext = createContext<ChatPermissionsApi | null>(null);
