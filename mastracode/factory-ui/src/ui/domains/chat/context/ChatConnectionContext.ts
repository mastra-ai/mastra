import type { AgentControllerSessionState } from '@mastra/client-js';
import { createContext } from 'react';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';

export type ChatConnectionState = AgentControllerSessionState;

export interface ChatConnectionApi {
  status: ConnectionStatus;
  state?: ChatConnectionState;
  threadId?: string;
  createdThreadId?: string;
}

export const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
