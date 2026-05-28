import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import { useChat } from '@mastra/react';
import type { SendMessageArgs } from '@mastra/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDebounce } from 'use-debounce';
import { StreamMessagesContext, StreamRunningContext, StreamSendContext } from './stream-chat-context';
import type { MessagesContextValue, RunningContextValue, SendContextValue } from './stream-chat-context';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

export interface StreamChatProviderProps {
  agentId: string;
  threadId: string;
  initialMessages: MastraDBMessage[];
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
  debounceTime?: number;
  children: ReactNode;
}

export const StreamChatProvider = ({
  agentId,
  threadId,
  initialMessages,
  initialUserMessage,
  clientTools,
  extraInstructions,
  debounceTime = 0,
  children,
}: StreamChatProviderProps) => {
  const { messages, isRunning, sendMessage } = useChat({ agentId, initialMessages });
  const { data: currentUser } = useCurrentUser();

  // temping the fact that client tools open and closes multiple streams making the UI flicker with isStreaming: true, then false for a few MS
  const [debouncedIsRunning] = useDebounce(isRunning, debounceTime);

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
      const requestContext = new RequestContext();
      requestContext.set('user', currentUser);

      const payload: SendMessageArgs = {
        message,
        threadId: threadIdRef.current,
        modelSettings: {
          maxRetries: 3,
          maxSteps: 100,
          maxTokens: 1000,
          temperature: 1,
        },
        requestContext,
      };

      if (tools !== undefined) {
        payload.clientTools = tools;
      }
      if (instructions !== undefined && instructions.length > 0) {
        payload.modelSettings = { instructions };
      }

      void sendMessage(payload);
    },
    [sendMessage, currentUser],
  );

  const hasDispatchedStarterRef = useRef(false);
  useEffect(() => {
    if (hasDispatchedStarterRef.current) return;
    if (!initialUserMessage) return;
    if (initialMessages.length > 0) return;
    hasDispatchedStarterRef.current = true;
    send(initialUserMessage);
  }, [initialUserMessage, initialMessages, send]);

  const effectiveIsRunning = debounceTime === 0 ? isRunning : debouncedIsRunning;
  const runningValue = useMemo<RunningContextValue>(() => ({ isRunning: effectiveIsRunning }), [effectiveIsRunning]);
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
