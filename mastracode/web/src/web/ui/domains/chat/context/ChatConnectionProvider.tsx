import type { AgentControllerEvent } from '@mastra/client-js';
import type { ReactNode } from 'react';

import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatConnectionContext } from './ChatConnectionContext';
import type { ChatConnectionApi } from './ChatConnectionContext';
import { useChatSessionContext } from './useChatSessionContext';

export function ChatConnectionProvider({
  children,
  onEvent,
}: {
  children: ReactNode;
  onEvent: (event: AgentControllerEvent) => void;
}) {
  const { resourceId, projectPath, projectState, sessionEnabled, baseUrl } = useChatSessionContext();
  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    projectState,
    baseUrl,
    enabled: sessionEnabled,
    onEvent,
  });

  const connectionValue: ChatConnectionApi = {
    status: connection.status,
    state: connection.state,
    threadId: connection.threadId,
    createdThreadId: connection.threadId,
  };

  return <ChatConnectionContext.Provider value={connectionValue}>{children}</ChatConnectionContext.Provider>;
}
