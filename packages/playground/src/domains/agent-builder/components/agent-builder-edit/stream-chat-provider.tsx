import { useChat } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { StreamMessagesContext, StreamRunningContext, StreamSendContext } from './stream-chat-context';
import type { MessagesContextValue, RunningContextValue, SendContextValue } from './stream-chat-context';

export interface StreamChatProviderProps {
  agentId: string;
  threadId: string;
  initialMessages: MastraUIMessage[];
  /**
   * Optional starter prompt forwarded from the agent-builder starter page. When
   * present, it is dispatched once on mount, *after* `useChat`'s own
   * `initialMessages` reset effect has run — otherwise that reset would clobber
   * the optimistic user message inserted by `sendMessage`. Sibling effects in
   * children fire before parent effects, so dispatching here guarantees correct
   * ordering.
   */
  initialUserMessage?: string;
  clientTools?: Record<string, unknown>;
  children: ReactNode;
}

export const StreamChatProvider = ({
  agentId,
  threadId,
  initialMessages,
  initialUserMessage,
  clientTools,
  children,
}: StreamChatProviderProps) => {
  const { messages, isRunning, sendMessage } = useChat({ agentId, initialMessages });

  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  const clientToolsRef = useRef(clientTools);
  clientToolsRef.current = clientTools;

  const send = useCallback(
    (message: string) => {
      void sendMessage({
        message,
        threadId: threadIdRef.current,
        ...(clientToolsRef.current ? { clientTools: clientToolsRef.current } : {}),
      });
    },
    [sendMessage],
  );

  const hasDispatchedStarterRef = useRef(false);
  useEffect(() => {
    if (hasDispatchedStarterRef.current) return;
    if (!initialUserMessage) return;
    if (initialMessages.length > 0) return;
    hasDispatchedStarterRef.current = true;
    send(initialUserMessage);
  }, [initialUserMessage, initialMessages, send]);

  const runningValue = useMemo<RunningContextValue>(() => ({ isRunning }), [isRunning]);
  const messagesValue = useMemo<MessagesContextValue>(() => ({ messages }), [messages]);
  const sendValue = useMemo<SendContextValue>(() => ({ send }), [send]);

  return (
    <StreamRunningContext.Provider value={runningValue}>
      <StreamMessagesContext.Provider value={messagesValue}>
        <StreamSendContext.Provider value={sendValue}>{children}</StreamSendContext.Provider>
      </StreamMessagesContext.Provider>
    </StreamRunningContext.Provider>
  );
};
