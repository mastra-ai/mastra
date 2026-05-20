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
  /**
   * Optional per-call system-prompt augmentation forwarded to the agent on
   * every send via `modelSettings.instructions`. Read fresh at send time so the
   * snapshot stays in sync with the form, but never enters the visible message
   * list and is not persisted as a chat turn.
   */
  extraInstructions?: string;
  children: ReactNode;
}

type SendPayload = {
  message: string;
  threadId: string;
  clientTools?: Record<string, unknown>;
  modelSettings?: { instructions?: string };
};

export const StreamChatProvider = ({
  agentId,
  threadId,
  initialMessages,
  initialUserMessage,
  clientTools,
  extraInstructions,
  children,
}: StreamChatProviderProps) => {
  const { messages, isRunning, sendMessage } = useChat({ agentId, initialMessages });

  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  const clientToolsRef = useRef(clientTools);
  clientToolsRef.current = clientTools;
  const instructionsRef = useRef(extraInstructions);
  instructionsRef.current = extraInstructions;

  const send = useCallback(
    (message: string) => {
      const tools = clientToolsRef.current;
      const instructions = instructionsRef.current;

      const payload: SendPayload = {
        message,
        threadId: threadIdRef.current,
      };

      if (tools !== undefined) {
        payload.clientTools = tools;
      }
      if (instructions !== undefined && instructions.length > 0) {
        payload.modelSettings = { instructions };
      }

      void sendMessage(payload);
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
