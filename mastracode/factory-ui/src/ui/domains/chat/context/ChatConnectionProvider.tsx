import type { AgentControllerEvent } from '@mastra/client-js';
import type { ReactNode } from 'react';

import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatConnectionContext } from './ChatConnectionContext';
import type { ChatConnectionApi } from './ChatConnectionContext';
import { useChatSessionContext } from './useChatSessionContext';

export function ChatConnectionProvider({
  children,
  threadId,
  initialThreadId,
  onEvent,
}: {
  children: ReactNode;
  threadId?: string;
  initialThreadId?: string;
  onEvent: (event: AgentControllerEvent) => void;
}) {
  const { resourceId, projectPath, sessionThreadId, factorySessionState, resourceReady, baseUrl } =
    useChatSessionContext();
  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    sessionThreadId,
    initialThreadId,
    displayThreadId: threadId,
    factorySessionState,
    baseUrl,
    enabled: resourceReady,
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
