import { createContext, useContext } from 'react';
import type { PlatformConnectActions } from './platform-connect-providers';

export const PlatformConnectActionsContext = createContext<PlatformConnectActions | null>(null);

export function usePlatformConnectActions(): PlatformConnectActions {
  const actions = useContext(PlatformConnectActionsContext);
  if (!actions) throw new Error('Platform connect buttons need a PlatformConnectActionsProvider');
  return actions;
}
