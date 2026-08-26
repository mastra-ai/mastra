import { createContext } from 'react';

import type { ConnectionStatus, useAgentControllerConnection } from '../hooks/useAgentControllerConnection';

export type ChatConnectionState = ReturnType<typeof useAgentControllerConnection>['state'];

export interface ChatConnectionApi {
  status: ConnectionStatus;
  state?: ChatConnectionState;
  /** Timestamp of the last real state fetch (event patches excluded). */
  stateUpdatedAt?: number;
  threadId?: string;
  createdThreadId?: string;
}

export const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
