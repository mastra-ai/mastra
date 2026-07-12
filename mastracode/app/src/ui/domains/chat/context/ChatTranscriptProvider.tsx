import type { AgentControllerMessage } from '@mastra/client-js';
import type { ReactNode } from 'react';

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
  initialMessages?: AgentControllerMessage[];
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
