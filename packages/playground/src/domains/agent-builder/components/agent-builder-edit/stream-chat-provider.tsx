import { useChat } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { StreamMessagesContext, StreamRunningContext, StreamSendContext } from './stream-chat-context';
import type { MessagesContextValue, RunningContextValue, SendContextValue } from './stream-chat-context';

export interface StreamChatProviderProps {
  agentId: string;
  threadId: string;
  initialMessages: MastraUIMessage[];
  clientTools?: Record<string, unknown>;
  children: ReactNode;
}

export const StreamChatProvider = ({
  agentId,
  threadId,
  initialMessages,
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
