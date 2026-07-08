import type { AgentControllerEvent, AgentControllerMessage } from '@mastra/client-js';
import { useEffect, useEffectEvent } from 'react';
import type { ReactNode, RefObject } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import type { TranscriptInit } from '../hooks/useAgentControllerTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { deriveRunIndicators } from '../services/transcript';
import { ChatSessionContext } from './ChatSessionProvider';
import type { ChatSessionApi } from './ChatSessionProvider';
import { ChatThreadMessagesProvider } from './ChatThreadMessages';

type SessionStateSnapshot = TranscriptInit['state'];

type ChatMode = ChatSessionApi['modes'][number];

interface ChatSessionRuntimeProps {
  children: ReactNode;
  resourceId: string;
  sessionEnabled: boolean;
  status: ConnectionStatus;
  modes: ChatMode[];
  eventHandlerRef: RefObject<((event: AgentControllerEvent) => void) | null>;
  state?: SessionStateSnapshot;
  stateUpdatedAt?: number;
  initialThreadId?: string;
}

export function ChatSessionRuntime({
  children,
  resourceId,
  sessionEnabled,
  status,
  modes,
  eventHandlerRef,
  state,
  stateUpdatedAt,
  initialThreadId,
}: ChatSessionRuntimeProps) {
  const { baseUrl } = useApiConfig();
  const {
    transcript,
    hydrateMessages,
    reset,
    resetHydration,
    resetCurrentThread,
    syncState,
    onEvent,
    localUser,
    resolvePrompt,
    pushNotice,
  } = useAgentControllerTranscript(
    // First sync: the gate only mounts the connected runtime once session
    // state exists, so the reducer initializes from it directly — preferring
    // the freshly created thread over whatever the server was last on.
    state ? { state, threadId: initialThreadId ?? state.threadId } : undefined,
  );

  eventHandlerRef.current = onEvent;

  const { busy, showWorkingIndicator } = deriveRunIndicators(transcript);

  const value: ChatSessionApi = {
    transcript,
    status,
    modes,
    busy,
    showWorkingIndicator,
    localUser,
    resetHydration,
    resetCurrentThread,
    syncState,
    reset,
    resolvePrompt,
    pushNotice,
  };

  return (
    <ChatSessionContext.Provider value={value}>
      <ThreadMessagesHydrator
        resourceId={resourceId}
        sessionEnabled={sessionEnabled}
        threadId={transcript.threadId}
        baseUrl={baseUrl}
        syncEpoch={stateUpdatedAt}
        onMessages={hydrateMessages}
      >
        {children}
      </ThreadMessagesHydrator>
    </ChatSessionContext.Provider>
  );
}

function ThreadMessagesHydrator({
  children,
  resourceId,
  sessionEnabled,
  threadId,
  baseUrl,
  syncEpoch,
  onMessages,
}: {
  children: ReactNode;
  resourceId: string;
  sessionEnabled: boolean;
  threadId?: string;
  baseUrl?: string;
  syncEpoch?: number;
  onMessages: (messages?: AgentControllerMessage[]) => void;
}) {
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    threadId,
    baseUrl,
    enabled: sessionEnabled,
    syncEpoch,
  });
  const handleMessages = useEffectEvent(onMessages);

  useEffect(() => {
    handleMessages(messagesQuery.data);
  }, [messagesQuery.data]);

  return (
    <ChatThreadMessagesProvider messagesPending={Boolean(threadId) && messagesQuery.isPending}>
      {children}
    </ChatThreadMessagesProvider>
  );
}
