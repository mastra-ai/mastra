import type { AgentControllerEvent, AgentControllerMessage } from '@mastra/client-js';
import { useState } from 'react';
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
  createdThreadId?: string;
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
  createdThreadId,
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
    state ? { state, threadId: createdThreadId ?? state.threadId } : undefined,
  );

  eventHandlerRef.current = onEvent;

  // Subsequent syncs (poll refresh, reconnect after an SSE drop): adjust
  // state during render instead of in an effect. React re-renders with the
  // reset transcript before committing, so no stale frame is ever painted.
  const [prevStateUpdatedAt, setPrevStateUpdatedAt] = useState(stateUpdatedAt);
  if (stateUpdatedAt !== prevStateUpdatedAt) {
    setPrevStateUpdatedAt(stateUpdatedAt);
    if (state && stateUpdatedAt) reset(state, state.threadId);
  }

  // Thread history for the transcript's current thread. `syncEpoch` in the
  // query key makes every re-sync fetch fresh history (replacing the old
  // imperative queryClient eviction).
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    threadId: transcript.threadId,
    baseUrl,
    enabled: sessionEnabled,
    syncEpoch: stateUpdatedAt,
  });

  // Fold fetched history into the transcript at render time. The reducer's
  // hydrateMessages action is guarded (once per thread, empty idle transcript
  // only), so this dispatch is idempotent.
  const [prevMessages, setPrevMessages] = useState<AgentControllerMessage[] | undefined>(undefined);
  if (messagesQuery.data !== prevMessages) {
    setPrevMessages(messagesQuery.data);
    hydrateMessages(messagesQuery.data);
  }

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
      <ChatThreadMessagesProvider messagesPending={Boolean(transcript.threadId) && messagesQuery.isPending}>
        {children}
      </ChatThreadMessagesProvider>
    </ChatSessionContext.Provider>
  );
}
