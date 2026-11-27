import { PlatformConnectActionsProvider } from '@mastra/playground-ui/domains/factory';
import type { ReactNode } from 'react';

import { usePlatformConnectActions } from '../../../../hooks/usePlatformConnections';

/** Lets the shared Platform connect buttons connect accounts through Factory's own routes. */
export function FactoryPlatformConnect({ children }: { children: ReactNode }) {
  return (
    <PlatformConnectActionsProvider actions={usePlatformConnectActions()}>{children}</PlatformConnectActionsProvider>
  );
}
