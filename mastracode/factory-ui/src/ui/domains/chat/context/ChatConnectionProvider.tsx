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
  const { resourceId, projectPath, sessionThreadId, factorySessionState, resourceReady, baseUrl } =
    useChatSessionContext();
  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    sessionThreadId,
    factorySessionState,
    baseUrl,
    // Open the SSE stream + init the session as soon as the resource is
    // addressable, so transcript history and live events start streaming
    // without waiting on a sandbox. This includes `POST /sessions` (session
    // create) and `PUT /state` (state seed) — writes fired before any sandbox
    // exists. MSW proves the UI stays quiet on this path; the
    // real server acceptance was NOT validated by a runtime spot-check in
    // Phase 1 (see `.mastracode/plans/factory-session-eager-render.progress.md`).
    // If the runtime spot-check surfaces a red server-error notice from
    // early session-init, revert this single line back to `sessionEnabled`;
    // the rest of the eager-render split still delivers the win.
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
