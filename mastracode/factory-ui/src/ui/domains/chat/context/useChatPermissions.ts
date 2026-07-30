import { useContext } from 'react';

import { ChatPermissionsContext } from './ChatPermissionsContext';
import type { ChatPermissionsApi } from './ChatPermissionsContext';

export function useChatPermissions(): ChatPermissionsApi {
  const ctx = useContext(ChatPermissionsContext);
  if (!ctx) throw new Error('useChatPermissions must be used within a ChatPermissionsProvider');
  return ctx;
}
