import { useContext } from 'react';

import { ChatPermissionsContext } from './ChatPermissionsContext';
import type { ChatPermissionsApi } from './ChatPermissionsContext';

export function useChatPermissions(): ChatPermissionsApi {
  const ctx = useContext(ChatPermissionsContext);
  if (!ctx) throw new Error('useChatPermissions must be used within a ChatPermissionsProvider');
  return ctx;
}

/** The permissions capability, or `undefined` when the host doesn't provide one. */
export function useOptionalChatPermissions(): ChatPermissionsApi | undefined {
  return useContext(ChatPermissionsContext) ?? undefined;
}
