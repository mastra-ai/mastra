import type { AgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ReactNode } from 'react';
import { useContext, useEffect, useEffectEvent, useMemo, useReducer } from 'react';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
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
  const viewerId = useFactoryAuth().data?.user?.userId;
  const transcriptApi = useAgentControllerTranscript({ initialThreadId: threadId, initialMessages, viewerId });
  const [runtime, dispatchRuntime] = useReducer(runtimeReducer, initialChatRuntime);
  const onEvent = (event: AgentControllerEvent) => {
    transcriptApi.onEvent(event);
    dispatchRuntime({ type: 'event', event });
  };
  const reset = (nextThreadId: string) => {
    transcriptApi.reset(nextThreadId);
    dispatchRuntime({ type: 'reset' });
  };
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
    <ChatConnectionProvider
      initialThreadId={threadId}
      threadId={transcriptApi.transcript.threadId ?? threadId}
      onEvent={onEvent}
    >
      <ChatRuntimeValueProvider runtime={runtime}>
        <ChatTranscriptValueProvider
          threadId={threadId}
          viewerId={viewerId}
          transcriptApi={transcriptApi}
          reset={reset}
          loadMore={loadMore}
        >
          {children}
        </ChatTranscriptValueProvider>
      </ChatRuntimeValueProvider>
    </ChatConnectionProvider>
  );
}

function ChatRuntimeValueProvider({ children, runtime }: { children: ReactNode; runtime: ChatRuntimeState }) {
  const { state } = useChatConnection();
  const usage = runtime.usage ?? state?.tokenUsage;
  const omProgress = runtime.omProgress ?? state?.omProgress;
  const runtimeValue = useMemo(
    () => ({
      usage,
      followUpCount: runtime.followUpCount,
      omProgress,
      omPhase: runtime.omPhase,
      bufferingMessages: runtime.bufferingMessages,
      bufferingObservations: runtime.bufferingObservations,
      goal: runtime.goal,
      tokensPerSec: runtime.tokensPerSec,
    }),
    [runtime, usage, omProgress],
  );
  return <ChatRuntimeContext.Provider value={runtimeValue}>{children}</ChatRuntimeContext.Provider>;
}

function ChatTranscriptValueProvider({
  children,
  threadId,
  viewerId,
  transcriptApi,
  reset,
  loadMore,
}: {
  children: ReactNode;
  threadId?: string;
  viewerId?: string;
  transcriptApi: ReturnType<typeof useAgentControllerTranscript>;
  reset: ChatTranscriptApi['reset'];
  loadMore: LoadMoreHistory;
}) {
  const connection = useChatConnection();
  const { sessionError, sandboxPreparing } = useChatSessionContext();
  const messagesThreadId = useContext(ChatThreadMessagesContext)?.threadId;
  const messagesInitializing = useChatMessagesInitializing();
  const messagesError = useChatMessagesError();
  const { transcript, initialHistoryReady, localUser, failLocalUser, resolvePrompt, clearPending, pushNotice } =
    transcriptApi;
  const effectiveThreadId = transcript.threadId ?? threadId ?? connection.createdThreadId;

  const effectiveTranscript: TranscriptState = {
    ...transcript,
    threadId: effectiveThreadId,
  };
  const busy = connection.state?.running === true || effectiveTranscript.pending;
  const historyInitializing = Boolean(messagesThreadId) && !messagesError && !initialHistoryReady;
  const initializing = sandboxPreparing || messagesInitializing || historyInitializing;
  const connectionFailed = connection.status === 'error' || connection.status === 'conflict';
  const phase = chatSessionPhase({
    sessionError: Boolean(sessionError),
    threadError: messagesError || connectionFailed,
    hasThread: Boolean(effectiveThreadId),
    running: connection.state?.running === true,
    initializing,
    pending: effectiveTranscript.pending,
  });
  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    viewerId,
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
