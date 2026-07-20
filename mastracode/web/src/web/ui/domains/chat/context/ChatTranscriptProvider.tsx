import type { MastraDBMessage } from '@mastra/client-js';
import type { ReactNode } from 'react';

import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { ChatConnectionProvider } from './ChatConnectionProvider';
import { ChatRuntimeContext } from './ChatRuntimeContext';
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
  const chatApi = useAgentControllerTranscript({ initialThreadId: threadId, initialMessages });
  return (
    <ChatConnectionProvider onEvent={chatApi.onEvent}>
      <ChatRuntimeContext.Provider value={chatApi.runtime}>
        <ChatTranscriptValueProvider threadId={threadId} chatApi={chatApi}>
          {children}
        </ChatTranscriptValueProvider>
      </ChatRuntimeContext.Provider>
    </ChatConnectionProvider>
  );
}

function ChatTranscriptValueProvider({
  children,
  threadId,
  chatApi,
}: {
  children: ReactNode;
  threadId?: string;
  chatApi: ReturnType<typeof useAgentControllerTranscript>;
}) {
  const connection = useChatConnection();
  const { messageState, surface, reset, localUser, resolvePrompt, clearPending, pushNotice } = chatApi;
  const effectiveThreadId = messageState.threadId ?? threadId ?? connection.createdThreadId;
  const busy = connection.state?.running === true || surface.pending;
  const lastMessage = messageState.messages.at(-1);
  const lastMessageIsStreamingAssistant =
    lastMessage?.role === 'assistant' && connection.state?.running === true;
  const value: ChatTranscriptApi = {
    messages: messageState.messages,
    prompts: surface.prompts,
    notices: surface.notices,
    notifications: surface.notifications,
    notificationSummaries: surface.notificationSummaries,
    subagents: surface.subagents,
    tasks: surface.tasks,
    pending: surface.pending,
    threadId: effectiveThreadId,
    workspaceReady: surface.workspaceReady,
    busy,
    showWorkingIndicator: busy && !lastMessageIsStreamingAssistant,
    localUser,
    reset,
    resolvePrompt,
    clearPending,
    pushNotice,
  };
  return <ChatTranscriptContext.Provider value={value}>{children}</ChatTranscriptContext.Provider>;
}
