import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ReactNode } from 'react';
import { useEffect, useReducer, useRef } from 'react';

import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { initialChatRuntime, runtimeReducer } from '../services/runtime';
import type { ChatRuntimeState } from '../services/runtime';
import type { TranscriptState } from '../services/transcript';
import { ChatConnectionProvider } from './ChatConnectionProvider';
import { ChatRuntimeContext } from './ChatRuntimeContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import type { ChatTranscriptApi, LoadMoreHistory } from './ChatTranscriptContext';
import { useChatConnection } from './useChatConnection';

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

  // The history query seeds the transcript once at mount (via `initialMessages`).
  // When the user loads more, the query grows its limit and refetches a larger
  // newest-N window; feed each larger result to `prependOlder`, which keeps only
  // the messages older than what is already on screen and prepends them. The
  // first (mount) result is skipped because it already seeded the transcript.
  const { prependOlder } = transcriptApi;
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }
    if (initialMessages && initialMessages.length > 0) {
      prependOlder(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { transcript, reset, localUser, resolvePrompt, clearPending, pushNotice } = transcriptApi;

  const effectiveTranscript: TranscriptState = {
    ...transcript,
    threadId: transcript.threadId ?? threadId ?? connection.createdThreadId,
    omProgress: transcript.omProgress ?? connection.state?.omProgress,
    usage: transcript.usage ?? connection.state?.tokenUsage,
  };
  const busy = connection.state?.running === true || effectiveTranscript.pending;
  const lastEntry = effectiveTranscript.entries.at(-1);
  const showWorkingIndicator = busy && !(lastEntry?.kind === 'message' && lastEntry.streaming);
  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    busy,
    showWorkingIndicator,
    localUser,
    reset,
    resolvePrompt,
    clearPending,
    pushNotice,
    loadMore,
  };

  return <ChatTranscriptContext.Provider value={transcriptValue}>{children}</ChatTranscriptContext.Provider>;
}
