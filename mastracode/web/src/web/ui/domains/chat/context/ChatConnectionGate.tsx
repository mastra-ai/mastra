import type { AgentControllerEvent } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useRef } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { Wordmark } from '../../../ui';
import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatSessionRuntime } from './ChatSessionRuntime';

interface ChatConnectionGateProps {
  children: ReactNode;
  resourceId: string;
  projectPath?: string;
  sessionEnabled: boolean;
}

export function ChatConnectionGate({ children, resourceId, projectPath, sessionEnabled }: ChatConnectionGateProps) {
  const { baseUrl } = useApiConfig();
  const eventHandlerRef = useRef<((event: AgentControllerEvent) => void) | null>(null);
  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
    onEvent: event => eventHandlerRef.current?.(event),
  });

  if (!sessionEnabled) {
    return (
      <ChatSessionRuntime
        key="dormant"
        resourceId={resourceId}
        sessionEnabled={sessionEnabled}
        status="connecting"
        modes={[]}
        eventHandlerRef={eventHandlerRef}
      >
        {children}
      </ChatSessionRuntime>
    );
  }

  if (!connection.state) {
    return connection.status === 'error' ? <ConnectionErrorState /> : <ConnectionLoadingState />;
  }

  const initialThreadId = eventHandlerRef.current
    ? connection.state.threadId
    : (connection.createdThreadId ?? connection.state.threadId);
  const runtimeKey = [
    'connected',
    connection.stateUpdatedAt,
    connection.state.threadId ?? '',
    connection.state.modeId ?? '',
    connection.state.modelId ?? '',
  ].join(':');

  return (
    <ChatSessionRuntime
      key={runtimeKey}
      resourceId={resourceId}
      sessionEnabled={sessionEnabled}
      status={connection.status}
      modes={connection.modes}
      eventHandlerRef={eventHandlerRef}
      state={connection.state}
      stateUpdatedAt={connection.stateUpdatedAt}
      initialThreadId={initialThreadId}
    >
      {children}
    </ChatSessionRuntime>
  );
}

function ConnectionLoadingState() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
      <Wordmark className="h-8" />
      <div className="flex items-center gap-2 font-mono text-sm text-icon3">
        <Spinner className="size-4" />
        <span>Connecting to agent…</span>
      </div>
    </div>
  );
}

function ConnectionErrorState() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div role="alert" className="w-full max-w-120">
        <Notice variant="destructive">Disconnected. Check the server and reload to reconnect.</Notice>
      </div>
    </div>
  );
}
