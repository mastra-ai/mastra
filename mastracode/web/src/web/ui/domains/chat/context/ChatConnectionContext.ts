import { createContext } from 'react';

import type { ConnectionStatus, useAgentControllerConnection } from '../hooks/useAgentControllerConnection';

export type ChatConnectionState = ReturnType<typeof useAgentControllerConnection>['state'];

export interface ChatConnectionApi {
  status: ConnectionStatus;
  error: ReturnType<typeof useAgentControllerConnection>['error'];
  state?: ChatConnectionState;
  createdThreadId?: string;
  retry: () => Promise<void>;
}

export const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
