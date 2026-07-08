import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { TranscriptState } from '../services/transcript';

export interface ChatSessionApi {
  transcript: TranscriptState;
  status: ConnectionStatus;
  modes: ReturnType<typeof useAgentControllerConnection>['modes'];
  messagesPending: boolean;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean) => void;
  resetHydration: () => void;
  resetCurrentThread: (threadId?: string) => void;
  syncState: (state: { modeId?: string; modelId?: string; omProgress?: TranscriptState['omProgress']; tokenUsage?: TranscriptState['usage'] }) => void;
  reset: (state?: Parameters<ReturnType<typeof useAgentControllerTranscript>['reset']>[0], threadId?: string) => void;
  resolvePrompt: (id: string) => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

const ChatSessionContext = createContext<ChatSessionApi | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const projectPath = deriveProjectPath(activeProject);

  const {
    transcript,
    hydrateMessages,
    reset,
    resetDormant,
    resetHydration,
    resetCurrentThread,
    syncState,
    onEvent,
    localUser,
    resolvePrompt,
    pushNotice,
  } = useAgentControllerTranscript();

  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    threadId: transcript.threadId,
    baseUrl,
    enabled: sessionEnabled,
  });

  useEffect(() => {
    hydrateMessages(messagesQuery.data);
  }, [hydrateMessages, messagesQuery.data]);

  const handleReconnectState = useCallback(
    (state: Parameters<typeof reset>[0]) => {
      reset(state);
      resetHydration();
    },
    [reset, resetHydration],
  );

  const handleReconnectMessagesInvalidated = useCallback(
    (queryKey: QueryKey) => {
      queryClient.removeQueries({ queryKey });
    },
    [queryClient],
  );

  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
    onEvent,
    onInitialState: reset,
    onReconnectState: handleReconnectState,
    onReconnectMessagesInvalidated: handleReconnectMessagesInvalidated,
  });

  useEffect(() => {
    if (sessionEnabled) return;
    resetDormant();
  }, [sessionEnabled, resetDormant]);

  const busy = transcript.running || transcript.pending;
  const lastEntry = transcript.entries[transcript.entries.length - 1];
  const lastEntryHasText =
    lastEntry?.kind === 'message' &&
    lastEntry.message.role === 'assistant' &&
    lastEntry.message.content.parts.some(part => part.type === 'text' && part.text.trim().length > 0);
  const showWorkingIndicator =
    busy &&
    !(
      lastEntry?.kind === 'message' &&
      lastEntry.message.role === 'assistant' &&
      lastEntry.streaming &&
      lastEntryHasText
    );

  const value: ChatSessionApi = {
    transcript,
    status: connection.status,
    modes: connection.modes,
    messagesPending: Boolean(transcript.threadId) && messagesQuery.isPending,
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

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSessionApi {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error('useChatSession must be used within a ChatSessionProvider');
  return ctx;
}
