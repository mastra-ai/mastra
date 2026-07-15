import type { AgentControllerSessionState } from '@mastra/client-js';
import { createContext } from 'react';

import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';

export type ChatConnectionState = AgentControllerSessionState & { running?: boolean };

export interface ChatConnectionApi {
  status: ConnectionStatus;
  state?: ChatConnectionState;
  /** When the state snapshot was last fetched — bumps on reconnect refetches. */
  stateUpdatedAt?: number;
  createdThreadId?: string;
}

export const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
