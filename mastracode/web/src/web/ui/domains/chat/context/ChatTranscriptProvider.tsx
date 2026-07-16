import type { MastraDBMessage } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import type { TranscriptState } from '../services/transcript';
import { ChatConnectionProvider } from './ChatConnectionProvider';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import type { ChatTranscriptApi } from './ChatTranscriptContext';
import { useChatConnection } from './useChatConnection';

export function ChatTranscriptProvider({
  children,
  threadId,
  initialMessages,
}: {
  children: ReactNode;
  threadId?: string;
  initialMessages?: MastraDBMessage[];
}) {
  const transcriptApi = useAgentControllerTranscript({
    initialThreadId: threadId,
    initialMessages,
  });

  return (
    <ChatConnectionProvider onEvent={transcriptApi.onEvent}>
      <ChatTranscriptValueProvider threadId={threadId} transcriptApi={transcriptApi}>
        {children}
      </ChatTranscriptValueProvider>
    </ChatConnectionProvider>
  );
}

function ChatTranscriptValueProvider({
  children,
  threadId,
  transcriptApi,
}: {
  children: ReactNode;
  threadId?: string;
  transcriptApi: ReturnType<typeof useAgentControllerTranscript>;
}) {
  const connection = useChatConnection();
  const { transcript, reset, syncState, localUser, resolvePrompt, pushNotice } = transcriptApi;

  // Hydrate the run flag from the authoritative `session.state()` snapshot so
  // attaching to a session that's already mid-run (page load, worktree switch,
  // SSE reconnect) shows the working indicator immediately. Live events own
  // the flag from then on via agent_start/agent_end/display_state_changed.
  // Only the run flag is synced: a delayed reconnect refetch must not roll
  // back newer SSE-driven OM progress/usage (those hydrate via the fallbacks
  // in `effectiveTranscript` below until live events supply them).
  const stateRunning = connection.state?.running;
  const stateUpdatedAt = connection.stateUpdatedAt;
  useEffect(() => {
    if (typeof stateRunning !== 'boolean') return;
    syncState({ running: stateRunning });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-apply only when a fresh snapshot lands
  }, [stateRunning, stateUpdatedAt]);

  const effectiveTranscript: TranscriptState = {
    ...transcript,
    threadId: transcript.threadId ?? threadId ?? connection.createdThreadId,
    omProgress: transcript.omProgress ?? connection.state?.omProgress,
    usage: transcript.usage ?? connection.state?.tokenUsage,
  };

  const busy = effectiveTranscript.running || effectiveTranscript.pending;
  const lastEntry = effectiveTranscript.entries.at(-1);
  const showWorkingIndicator = busy && !(lastEntry?.kind === 'message' && lastEntry.streaming);

  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    busy,
    showWorkingIndicator,
    localUser,
    syncState,
    reset,
    resolvePrompt,
    pushNotice,
  };

  return <ChatTranscriptContext.Provider value={transcriptValue}>{children}</ChatTranscriptContext.Provider>;
}
