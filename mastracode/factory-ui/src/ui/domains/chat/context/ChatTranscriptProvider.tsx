import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ReactNode } from 'react';
import { useContext, useEffect, useEffectEvent, useReducer } from 'react';

import { chatSessionPhase } from '../../workspaces/services/sessionStatus';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { initialChatRuntime, runtimeReducer } from '../services/runtime';
import type { ChatRuntimeState } from '../services/runtime';
import type { TranscriptState } from '../services/transcript';
import { SessionFavicon } from '../components/SessionFavicon';
import { ChatConnectionProvider } from './ChatConnectionProvider';
import { ChatRuntimeContext } from './ChatRuntimeContext';
import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import type { ChatTranscriptApi, LoadMoreHistory } from './ChatTranscriptContext';
import { useChatConnection } from './useChatConnection';
import { useChatMessagesError } from './useChatMessagesError';
import { useChatMessagesInitializing } from './useChatMessagesInitializing';
import { useChatSessionContext } from './useChatSessionContext';

export function ChatTranscriptProvider({
  children,
  threadId,
  initialMessages,
  hasMoreHistory = false,
  isLoadingMoreHistory = false,
  loadMoreHistory,
}: {
  children: ReactNode;
  threadId?: string;
  initialMessages?: MastraDBMessage[];
  hasMoreHistory?: boolean;
  isLoadingMoreHistory?: boolean;
  loadMoreHistory?: () => void;
}) {
  const transcriptApi = useAgentControllerTranscript({ initialThreadId: threadId, initialMessages });
  const [runtime, dispatchRuntime] = useReducer(runtimeReducer, initialChatRuntime);
  const onEvent = (event: Parameters<typeof transcriptApi.onEvent>[0]) => {
    transcriptApi.onEvent(event);
    dispatchRuntime(event);
  };

  // Merge is by id and idempotent — mount seed, grown load-more window and
  // post-navigation revalidation all fold in through the same path.
  const mergeWindow = useEffectEvent((messages: MastraDBMessage[]) => transcriptApi.mergeWindow(messages));
  useEffect(() => {
    if (initialMessages === undefined) return;
    mergeWindow(initialMessages);
  }, [initialMessages]);

  const loadMore: LoadMoreHistory = {
    hasMore: hasMoreHistory,
    isLoading: isLoadingMoreHistory,
    load: loadMoreHistory,
  };

  return (
    <ChatConnectionProvider onEvent={onEvent}>
      <ChatRuntimeValueProvider runtime={runtime}>
        <ChatTranscriptValueProvider threadId={threadId} transcriptApi={transcriptApi} loadMore={loadMore}>
          {children}
        </ChatTranscriptValueProvider>
      </ChatRuntimeValueProvider>
    </ChatConnectionProvider>
  );
}

function ChatRuntimeValueProvider({ children, runtime }: { children: ReactNode; runtime: ChatRuntimeState }) {
  const { state } = useChatConnection();
  return (
    <ChatRuntimeContext.Provider
      value={{
        usage: runtime.usage ?? state?.tokenUsage,
        followUpCount: runtime.followUpCount,
        omProgress: runtime.omProgress ?? state?.omProgress,
        omPhase: runtime.omPhase,
        bufferingMessages: runtime.bufferingMessages,
        bufferingObservations: runtime.bufferingObservations,
        goal: runtime.goal,
        tokensPerSec: runtime.tokensPerSec,
      }}
    >
      {children}
    </ChatRuntimeContext.Provider>
  );
}

function ChatTranscriptValueProvider({
  children,
  threadId,
  transcriptApi,
  loadMore,
}: {
  children: ReactNode;
  threadId?: string;
  transcriptApi: ReturnType<typeof useAgentControllerTranscript>;
  loadMore: LoadMoreHistory;
}) {
  const connection = useChatConnection();
  const { sessionError, sandboxPreparing } = useChatSessionContext();
  const messagesThreadId = useContext(ChatThreadMessagesContext)?.threadId;
  const messagesInitializing = useChatMessagesInitializing();
  const messagesError = useChatMessagesError();
  const { transcript, initialHistoryReady, reset, localUser, failLocalUser, resolvePrompt, clearPending, pushNotice } =
    transcriptApi;
  const effectiveThreadId = transcript.threadId ?? threadId ?? connection.createdThreadId;

  const effectiveTranscript: TranscriptState = {
    ...transcript,
    threadId: effectiveThreadId,
    tasks: connection.state?.tasks ?? transcript.tasks,
    omProgress: transcript.omProgress ?? connection.state?.omProgress,
    usage: transcript.usage ?? connection.state?.tokenUsage,
  };
  const busy = connection.state?.running === true || effectiveTranscript.pending;
  const historyInitializing = Boolean(messagesThreadId) && !messagesError && !initialHistoryReady;
  const initializing = sandboxPreparing || messagesInitializing || historyInitializing;
  const phase = chatSessionPhase({
    sessionError: Boolean(sessionError),
    threadError: messagesError || connection.status === 'error',
    hasThread: Boolean(effectiveThreadId),
    running: connection.state?.running === true,
    initializing,
    pending: effectiveTranscript.pending,
  });
  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    busy,
    phase,
    initializing,
    historyInitializing,
    initialHistoryReady,
    localUser,
    failLocalUser,
    reset,
    resolvePrompt,
    clearPending,
    pushNotice,
    loadMore,
  };

  return (
    <ChatTranscriptContext.Provider value={transcriptValue}>
      <SessionFavicon state={phase} />
      {children}
    </ChatTranscriptContext.Provider>
  );
}
