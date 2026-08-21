import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import { useChat } from '@mastra/react';
import type { ClientToolsInput, ClientToolsResolver, SendMessageArgs } from '@mastra/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDebounce } from 'use-debounce';
import {
  StreamApprovalContext,
  StreamCancelContext,
  StreamMessagesContext,
  StreamRunningContext,
  StreamSendContext,
} from './stream-chat-context';
import type {
  ApprovalContextValue,
  CancelContextValue,
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
  clientToolsResolver?: ClientToolsResolver;
  /**
   * Optional per-call system-prompt augmentation forwarded to the agent on
   * every send via `modelSettings.instructions`. Read fresh at send time so the
   * snapshot stays in sync with the form, but never enters the visible message
   * list and is not persisted as a chat turn.
   */
  extraInstructions?: string;
  /**
   * How `extraInstructions` reaches the agent.
   *
   * - `'replace'` (default) sends them as `modelSettings.instructions`, which
   *   *replaces* the agent's configured instructions. Correct when the text is
   *   a complete standalone prompt.
   * - `'append'` sends them as `modelSettings.system`, which the agent appends
   *   to its own resolved instructions. Required when the text is per-turn
   *   state and the agent's constructor prompt must survive.
   */
  extraInstructionsMode?: 'replace' | 'append';
  streamPath?: string;
  enableThreadSignals?: boolean;
  debounceTime?: number;
  maxSteps?: number;
  /** Receives the outgoing message text, before the stream is opened. */
  onSendStart?: (message: string) => void;
  onSendComplete?: () => void;
  onSendError?: (error: Error) => void;
  /**
   * Fires instead of `onSendComplete`/`onSendError` when the run was cancelled
   * by the user. Aborting resolves or rejects the in-flight send like any other
   * ending, so consumers would otherwise report a stopped run as a failed one.
   */
  onSendCancel?: () => void;
  children: ReactNode;
}

export const StreamChatProvider = ({
  agentId,
  threadId,
  initialMessages,
  initialUserMessage,
  clientTools,
  createClientTools,
  clientToolsResolver,
  extraInstructions,
  extraInstructionsMode = 'replace',
  streamPath,
  enableThreadSignals,
  debounceTime = 0,
  maxSteps = 100,
  onSendStart,
  onSendComplete,
  onSendError,
  onSendCancel,
  children,
}: StreamChatProviderProps) => {
  const threadSignalsEnabled = enableThreadSignals ?? window.MASTRA_AGENT_SIGNALS !== 'false';
  const { messages, isRunning, sendMessage, approveToolCall, declineToolCall, cancelRun } = useChat({
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
  const cancelRunRef = useRef(cancelRun);
  cancelRunRef.current = cancelRun;
  const onSendCancelRef = useRef(onSendCancel);
  onSendCancelRef.current = onSendCancel;
  // Identifies the run a settled `sendMessage` belongs to, so a cancellation
  // only suppresses the send it actually aborted.
  const sendRunRef = useRef(0);
  const inFlightRunRef = useRef<number | undefined>(undefined);
  const cancelledRunRef = useRef<number | undefined>(undefined);

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
      if (clientToolsResolver !== undefined) {
        payload.clientToolsResolver = clientToolsResolver;
      }
      if (instructions !== undefined && instructions.length > 0) {
        payload.modelSettings =
          extraInstructionsMode === 'append'
            ? { ...payload.modelSettings, system: instructions }
            : { ...payload.modelSettings, instructions };
      }

      const run = ++sendRunRef.current;
      inFlightRunRef.current = run;
      // A cancelled run already reported itself at cancel time; an abort can
      // settle late or not at all, so nothing here may speak for it again.
      const settle = (report: () => void) => {
        if (inFlightRunRef.current === run) inFlightRunRef.current = undefined;
        if (cancelledRunRef.current === run) return;
        report();
      };

      onSendStart?.(message);
      void sendMessage(payload)
        .then(() => settle(() => onSendComplete?.()))
        .catch(error => settle(() => onSendError?.(error instanceof Error ? error : new Error(String(error)))));
    },
    [
      sendMessage,
      currentUser,
      createClientTools,
      clientToolsResolver,
      extraInstructionsMode,
      maxSteps,
      onSendStart,
      onSendComplete,
      onSendError,
    ],
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

  const cancel = useCallback(() => {
    // A run that already settled has nothing to abort, and marking it cancelled
    // would misreport the next send.
    if (inFlightRunRef.current === undefined) return;
    cancelledRunRef.current = inFlightRunRef.current;
    inFlightRunRef.current = undefined;
    cancelRunRef.current();
    onSendCancelRef.current?.();
  }, []);
  const cancelValue = useMemo<CancelContextValue>(() => ({ cancel }), [cancel]);

  return (
    <StreamRunningContext.Provider value={runningValue}>
      <StreamMessagesContext.Provider value={messagesValue}>
        <StreamApprovalContext.Provider value={approvalValue}>
          <StreamCancelContext.Provider value={cancelValue}>
            <StreamSendContext.Provider value={sendValue}>{children}</StreamSendContext.Provider>
          </StreamCancelContext.Provider>
        </StreamApprovalContext.Provider>
      </StreamMessagesContext.Provider>
    </StreamRunningContext.Provider>
  );
};
