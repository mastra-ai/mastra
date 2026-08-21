import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent, useReducer } from 'react';

import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { initialChatRuntime, runtimeReducer } from '../services/runtime';
import type { ChatRuntimeState } from '../services/runtime';
import type { TranscriptState } from '../services/transcript';
import { SessionFavicon } from '../components/SessionFavicon';
import type { SessionFaviconState } from '../components/SessionFavicon';
import { ChatConnectionProvider } from './ChatConnectionProvider';
import { ChatRuntimeContext } from './ChatRuntimeContext';
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

// Precedence mirrors `ChatMessageBoundary` so the favicon and the screen agree.
function faviconStateFor({
  hasThread,
  sessionError,
  initializing,
  warming,
  hasActivity,
  threadError,
  busy,
}: {
  hasThread: boolean;
  sessionError: boolean;
  initializing: boolean;
  warming: boolean;
  hasActivity: boolean;
  threadError: boolean;
  busy: boolean;
}): SessionFaviconState | undefined {
  if (sessionError) return 'error';
  if (initializing) return 'initializing';
  if (!hasThread) return warming ? 'initializing' : undefined;
  if (threadError) return 'error';
  if (busy) return 'working';
  // The background warm-up only masks a *fresh* idle session (matching the
  // prepare stepper). Once a run has produced transcript content, `awaiting`
  // must win — it is the one state telling the user to come back, and a run
  // can finish while `/ensure` is still warming.
  if (warming && !hasActivity) return 'initializing';
  return 'awaiting';
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
  const { sessionError, sandboxPreparing, sandboxWarming } = useChatSessionContext();
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
  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    busy,
    initialHistoryReady,
    localUser,
    failLocalUser,
    reset,
    resolvePrompt,
    clearPending,
    pushNotice,
    loadMore,
  };

  const faviconState = faviconStateFor({
    hasThread: Boolean(effectiveThreadId),
    sessionError: Boolean(sessionError),
    initializing: sandboxPreparing || messagesInitializing,
    // Messages load in parallel with the sandbox warm-up, so the favicon stays
    // on `initializing` while the warm-up is still provisioning/cloning even
    // after the chat surface renders — but only until the session has real
    // agent state to report (working/awaiting), which takes precedence.
    warming: sandboxWarming === true,
    hasActivity: effectiveTranscript.entries.length > 0,
    threadError: messagesError || connection.status === 'error',
    busy,
  });

  return (
    <ChatTranscriptContext.Provider value={transcriptValue}>
      <SessionFavicon state={faviconState} />
      {children}
    </ChatTranscriptContext.Provider>
  );
}
