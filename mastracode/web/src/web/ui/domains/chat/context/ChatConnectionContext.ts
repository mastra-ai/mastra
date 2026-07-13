import { createContext } from 'react';

import type { ConnectionStatus, useAgentControllerConnection } from '../hooks/useAgentControllerConnection';

export type ChatConnectionState = ReturnType<typeof useAgentControllerConnection>['state'];

export interface ChatConnectionApi {
  status: ConnectionStatus;
  state?: ChatConnectionState;
  /** When the state snapshot was last fetched — bumps on reconnect refetches. */
  stateUpdatedAt?: number;
  createdThreadId?: string;
}

export const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
