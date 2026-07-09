import { createContext } from 'react';

import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';
import type { SessionStateSnapshot } from '../hooks/useAgentControllerTranscript';

export interface ChatConnectionApi {
  status: ConnectionStatus;
  state?: SessionStateSnapshot;
}

export const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
