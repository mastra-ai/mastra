import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import { useChat } from '@mastra/react';
import type { ClientToolsInput, SendMessageArgs } from '@mastra/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDebounce } from 'use-debounce';
import {
  StreamApprovalContext,
  StreamMessagesContext,
  StreamRunningContext,
  StreamSendContext,
} from './stream-chat-context';
import type {
  ApprovalContextValue,
  MessagesContextValue,
  RunningContextValue,
  SendContextValue,
} from './stream-chat-context';
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
  clientTools?: ClientToolsInput;
  createClientTools?: () => ClientToolsInput;
  /**
   * Optional per-call system-prompt augmentation forwarded to the agent on
   * every send via `modelSettings.instructions`. Read fresh at send time so the
   * snapshot stays in sync with the form, but never enters the visible message
   * list and is not persisted as a chat turn.
   */
  extraInstructions?: string;
  streamPath?: string;
  enableThreadSignals?: boolean;
  debounceTime?: number;
  maxSteps?: number;
  onSendStart?: () => void;
  onSendComplete?: () => void;
  onSendError?: (error: Error) => void;
  children: ReactNode;
}

export const StreamChatProvider = ({
  agentId,
  threadId,
  initialMessages,
  initialUserMessage,
  clientTools,
  createClientTools,
  extraInstructions,
  streamPath,
  enableThreadSignals,
  debounceTime = 0,
  maxSteps = 100,
  onSendStart,
  onSendComplete,
  onSendError,
  children,
}: StreamChatProviderProps) => {
  const threadSignalsEnabled = enableThreadSignals ?? window.MASTRA_AGENT_SIGNALS !== 'false';
  const { messages, isRunning, sendMessage, approveToolCall, declineToolCall } = useChat({
    agentId,
    initialMessages,
    enableThreadSignals: threadSignalsEnabled,
    streamPath,
  });
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
      const tools = createClientTools?.() ?? clientToolsRef.current;
      const instructions = instructionsRef.current;
      const requestContext = new RequestContext();
      requestContext.set('user', currentUser);

      const payload: SendMessageArgs = {
        message,
        threadId: threadIdRef.current,
        modelSettings: {
          maxRetries: 3,
          maxSteps,
          // Sized to fit one `set-agent-instructions` tool call carrying up to
          // ~3,000 chars of generated instructions plus the JSON envelope and
          // any hidden reasoning tokens emitted by the builder model. Below
          // ~2,000 we see mid-stream JSON truncation surface as an OpenAI
          // server_error on the next request.
          maxTokens: 5000,
          temperature: 1,
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
            },
          },
        },
        requestContext,
      };

      if (tools !== undefined) {
        payload.clientTools = tools;
      }
      if (instructions !== undefined && instructions.length > 0) {
        payload.modelSettings = { ...payload.modelSettings, instructions };
      }

      onSendStart?.();
      void sendMessage(payload)
        .then(() => onSendComplete?.())
        .catch(error => onSendError?.(error instanceof Error ? error : new Error(String(error))));
    },
    [sendMessage, currentUser, createClientTools, maxSteps, onSendStart, onSendComplete, onSendError],
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

  const approve = useCallback(
    (toolCallId: string) => {
      void approveToolCall(toolCallId);
    },
    [approveToolCall],
  );
  const decline = useCallback(
    (toolCallId: string) => {
      void declineToolCall(toolCallId);
    },
    [declineToolCall],
  );
  const approvalValue = useMemo<ApprovalContextValue>(
    () => ({ approveToolCall: approve, declineToolCall: decline }),
    [approve, decline],
  );

  return (
    <StreamRunningContext.Provider value={runningValue}>
      <StreamMessagesContext.Provider value={messagesValue}>
        <StreamApprovalContext.Provider value={approvalValue}>
          <StreamSendContext.Provider value={sendValue}>{children}</StreamSendContext.Provider>
        </StreamApprovalContext.Provider>
      </StreamMessagesContext.Provider>
    </StreamRunningContext.Provider>
  );
};
