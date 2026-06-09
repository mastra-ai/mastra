import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import { useMastraClient, useChat } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ChatMessagesContext, ChatRunningContext, ChatSendContext } from './chat-context';
import type { ChatSendArgs, MessagesContextValue, RunningContextValue, SendContextValue } from './chat-context';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { getCanSendWhileStreaming } from '@/services/mastra-runtime-state';
import {
  buildGlobalOmPartsByCycleId,
  convertOmPartsInMastraMessage,
  injectBufferingEnds,
  markOmMarkersAsDisconnected,
  scanOmInitialState,
} from '@/services/om-parts-converter';
import {
  buildMaxStepsStreamErrorMessage,
  buildStreamErrorMessage,
  isMaxStepsFinishChunk,
} from '@/services/stream-error-message';
import type { ChatProps } from '@/types';

/**
 * The OM/error stream chunks this provider reacts to are not part of the
 * typed `useChat` chunk union (the SDK surfaces them with an opaque `data`
 * payload), so we narrow them locally. Each variant only declares the `data`
 * fields the OM handlers actually read.
 */
type OmStreamChunk =
  | { type: 'data-om-observation-start'; data?: { operationType?: string } }
  | { type: 'data-om-observation-end'; data?: { operationType?: string } }
  | { type: 'data-om-observation-failed'; data?: { operationType?: string } }
  | {
      type: 'data-om-status';
      data?: {
        windows?: unknown;
        recordId?: string;
        threadId?: string;
        stepNumber?: number;
        generationCount?: number;
      };
    }
  | { type: 'data-om-activation'; data?: { operationType?: string; cycleId?: string } };

type ErrorStreamChunk = { type: 'error'; runId?: string; payload?: { error?: unknown } };

type HandledStreamChunk = OmStreamChunk | ErrorStreamChunk;

/**
 * Narrow an arbitrary stream/network chunk to the OM/error variants this
 * provider handles. Returns the typed chunk when its `type` matches, else
 * `undefined`. Centralises the single boundary cast so the call sites stay
 * fully typed.
 */
const asHandledStreamChunk = (chunk: unknown): HandledStreamChunk | undefined => {
  const type = (chunk as { type?: unknown }).type;
  if (
    type === 'error' ||
    type === 'data-om-observation-start' ||
    type === 'data-om-observation-end' ||
    type === 'data-om-observation-failed' ||
    type === 'data-om-status' ||
    type === 'data-om-activation'
  ) {
    return chunk as HandledStreamChunk;
  }
  return undefined;
};

/**
 * Runtime + dispatch context for the main agent chat.
 *
 * Replaces the assistant-ui `MastraRuntimeProvider` (`useExternalStoreRuntime`)
 * and `ToolCallProvider`. It drives `useChat` from `@mastra/react`, preserves the
 * full streaming / generate / network behaviour (OM lifecycle, working-memory
 * refresh, thread-list refresh, stream errors, approvals, cancel), and exposes a
 * plain-prop context consumed by `MessageRow`/`MessageFactory` and the composer.
 */
export function ChatProvider({
  children,
  agentId,
  initialMessages,
  threadId,
  refreshThreadList,
  settings,
  requestContext,
  modelVersion,
  agentVersionId,
  supportsMemory,
}: Readonly<{ children: ReactNode }> & ChatProps) {
  const { settings: tracingSettings } = useTracingSettings();

  // Errors emitted as `error` chunks (or thrown by sendMessage) are not persisted
  // to server memory, so they get wiped from useChat's `messages` state when
  // `initialMessages` refreshes after a stream ends. Track them in a parallel
  // state that survives those resets so the chat still surfaces the failure.
  const [streamErrors, setStreamErrors] = useState<MastraDBMessage[]>([]);
  const [threadSignalsUnsupported, setThreadSignalsUnsupported] = useState(false);
  const threadSignalsUnsupportedRef = useRef(false);
  const threadSignalsEnabled =
    window.MASTRA_AGENT_SIGNALS !== 'false' &&
    supportsMemory !== false &&
    !settings?.modelSettings?.chatWithLegacyStream;

  // Clear persisted stream errors when switching threads/agents so they don't
  // leak across conversations.
  useEffect(() => {
    setStreamErrors([]);
    threadSignalsUnsupportedRef.current = false;
    setThreadSignalsUnsupported(false);
  }, [agentId, threadId]);

  const chatRequestContext = useMemo(() => {
    if (!agentVersionId && !requestContext) return undefined;
    const ctx = new RequestContext();
    Object.entries(requestContext ?? {}).forEach(([key, value]) => {
      ctx.set(key, value);
    });
    if (agentVersionId) {
      ctx.set('agentVersionId', agentVersionId);
    }
    return ctx;
  }, [agentVersionId, requestContext]);

  const {
    messages,
    sendMessage,
    cancelRun,
    isRunning: isRunningStream,
    isAwaitingToolApproval,
    setMessages,
    approveToolCall,
    declineToolCall,
    approveToolCallGenerate,
    declineToolCallGenerate,
    toolCallApprovals,
    approveNetworkToolCall,
    declineNetworkToolCall,
    networkToolCallApprovals,
  } = useChat({
    agentId,
    threadId,
    initialMessages,
    requestContext: chatRequestContext,
    enableThreadSignals: threadSignalsEnabled,
    onThreadSignalsUnsupported: () => {
      threadSignalsUnsupportedRef.current = true;
      setThreadSignalsUnsupported(true);
    },
  });

  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const { data: memoryConfigData } = useMemoryConfig(agentId);
  const omConfig = memoryConfigData?.config?.observationalMemory as unknown;
  const isOMEnabled =
    omConfig === true ||
    (typeof omConfig === 'object' && omConfig !== null && (!('enabled' in omConfig) || omConfig.enabled !== false));
  const {
    setIsObservingFromStream,
    setIsReflectingFromStream,
    signalObservationsUpdated,
    setStreamProgress,
    markCycleIdActivated,
  } = useObservationalMemoryContext();

  const handleObservationStart = (operationType?: string) => {
    if (operationType === 'reflection') {
      setIsReflectingFromStream(true);
    } else {
      setIsObservingFromStream(true);
    }
  };

  const handleProgressUpdate = useCallback(
    (data: any) => {
      if (data.threadId && data.threadId !== threadId) {
        return;
      }
      setStreamProgress({
        windows: data.windows,
        recordId: data.recordId,
        threadId: data.threadId,
        stepNumber: data.stepNumber,
        generationCount: data.generationCount,
      });
    },
    [setStreamProgress, threadId],
  );

  const refreshObservationalMemory = (operationType?: string) => {
    if (operationType === 'reflection') {
      setIsReflectingFromStream(false);
    } else {
      setIsObservingFromStream(false);
    }
    signalObservationsUpdated();
    void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
  };

  const handleActivation = (data: any) => {
    const cycleId = data?.cycleId;
    if (cycleId) {
      markCycleIdActivated(cycleId);
    }
  };

  const resetObservationalMemoryStreamState = () => {
    setIsObservingFromStream(false);
    setIsReflectingFromStream(false);
    setMessages(prev => markOmMarkersAsDisconnected(prev));
    void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
  };

  // On initial load, scan messages for activation markers + last progress so
  // buffering badges show as activated and token counts are accurate on reload.
  useEffect(() => {
    const { activatedCycleIds, lastProgress } = scanOmInitialState(initialMessages || []);
    for (const cycleId of activatedCycleIds) {
      markCycleIdActivated(cycleId);
    }
    if (lastProgress) {
      handleProgressUpdate(lastProgress);
    }
  }, [handleProgressUpdate, initialMessages, markCycleIdActivated]);

  const {
    frequencyPenalty,
    presencePenalty,
    maxRetries,
    maxSteps,
    maxTokens,
    temperature,
    topK,
    topP,
    seed,
    chatWithGenerate,
    chatWithNetwork,
    providerOptions,
    requireToolApproval,
  } = settings?.modelSettings ?? {};

  const modelSettingsArgs = {
    frequencyPenalty,
    presencePenalty,
    maxRetries,
    temperature,
    topK,
    topP,
    seed,
    maxTokens,
    providerOptions,
    maxSteps,
    requireToolApproval,
  };

  const baseClient = useMastraClient();
  const isSupportedModel = modelVersion === 'v2' || modelVersion === 'v3';

  // Latest-value refs so the `send`/`cancel` callbacks stay referentially stable
  // (composer relies on a stable handle) while still reading fresh settings.
  const sendDepsRef = useRef({
    requestContext,
    agentVersionId,
    threadId,
    modelSettingsArgs,
    chatWithNetwork,
    chatWithGenerate,
    maxSteps,
    isOMEnabled,
    tracingOptions: tracingSettings?.tracingOptions,
  });
  sendDepsRef.current = {
    requestContext,
    agentVersionId,
    threadId,
    modelSettingsArgs,
    chatWithNetwork,
    chatWithGenerate,
    maxSteps,
    isOMEnabled,
    tracingOptions: tracingSettings?.tracingOptions,
  };

  const send = useCallback(
    async ({ message, attachments = [] }: ChatSendArgs) => {
      const deps = sendDepsRef.current;
      if (threadSignalsUnsupportedRef.current && (isRunningStream || abortControllerRef.current)) return;

      setStreamErrors([]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestContextInstance = new RequestContext();
      Object.entries(deps.requestContext ?? {}).forEach(([key, value]) => {
        requestContextInstance.set(key, value);
      });
      if (deps.agentVersionId) {
        requestContextInstance.set('agentVersionId', deps.agentVersionId);
      }

      try {
        if (deps.chatWithNetwork) {
          await sendMessage({
            message,
            mode: 'network',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId: deps.threadId,
            modelSettings: deps.modelSettingsArgs,
            signal: controller.signal,
            tracingOptions: deps.tracingOptions,
            onNetworkChunk: async chunk => {
              if (
                chunk.type === 'tool-execution-end' &&
                chunk.payload?.toolName === 'updateWorkingMemory' &&
                typeof chunk.payload.result === 'object' &&
                'success' in chunk.payload.result! &&
                chunk.payload.result?.success
              ) {
                void refreshWorkingMemory?.();
              }
              if (chunk.type === 'network-execution-event-step-finish') {
                refreshThreadList?.();
              }
              const handled = asHandledStreamChunk(chunk);
              if (handled?.type === 'error') {
                setStreamErrors(prev => [...prev, buildStreamErrorMessage(handled)]);
              }
              if (handled?.type === 'data-om-observation-start') {
                handleObservationStart(handled.data?.operationType);
              }
              if (handled?.type === 'data-om-status') {
                handleProgressUpdate(handled.data);
              }
              if (
                handled?.type === 'data-om-observation-end' ||
                handled?.type === 'data-om-observation-failed' ||
                handled?.type === 'data-om-activation'
              ) {
                refreshObservationalMemory(handled.data?.operationType);
              }
              if (handled?.type === 'data-om-activation') {
                handleActivation(handled.data);
              }
            },
          });
        } else if (deps.chatWithGenerate) {
          await sendMessage({
            message,
            mode: 'generate',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId: deps.threadId,
            modelSettings: deps.modelSettingsArgs,
            signal: controller.signal,
            tracingOptions: deps.tracingOptions,
          });
          await refreshThreadList?.();
          return;
        } else {
          await sendMessage({
            message,
            mode: 'stream',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId: deps.threadId,
            modelSettings: deps.modelSettingsArgs,
            tracingOptions: deps.tracingOptions,
            onChunk: async chunk => {
              if (chunk.type === 'finish') {
                if (isMaxStepsFinishChunk(chunk)) {
                  setStreamErrors(prev => [...prev, buildMaxStepsStreamErrorMessage(chunk, deps.maxSteps)]);
                }
                await refreshThreadList?.();
              }
              if (chunk.type === 'error') {
                setStreamErrors(prev => [...prev, buildStreamErrorMessage(chunk)]);
              }
              if (
                chunk.type === 'tool-result' &&
                chunk.payload?.toolName === 'updateWorkingMemory' &&
                typeof chunk.payload.result === 'object' &&
                'success' in chunk.payload.result! &&
                chunk.payload.result?.success
              ) {
                void refreshWorkingMemory?.();
              }
              const handled = asHandledStreamChunk(chunk);
              if (handled?.type === 'data-om-observation-start') {
                handleObservationStart(handled.data?.operationType);
              }
              if (handled?.type === 'data-om-status') {
                handleProgressUpdate(handled.data);
              }
              if (
                handled?.type === 'data-om-observation-end' ||
                handled?.type === 'data-om-observation-failed' ||
                handled?.type === 'data-om-activation'
              ) {
                refreshObservationalMemory(handled.data?.operationType);
              }
              if (handled?.type === 'data-om-activation') {
                handleActivation(handled.data);
              }
            },
            signal: controller.signal,
          });

          if (deps.threadId && deps.isOMEnabled) {
            baseClient
              .awaitBufferStatus({ agentId, resourceId: agentId, threadId: deps.threadId })
              .then(result => {
                setMessages(prev => injectBufferingEnds(prev, result?.record));
                void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
                void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
              })
              .catch(() => {});
          }
          return;
        }

        setTimeout(() => {
          refreshThreadList?.();
        }, 500);

        if (deps.threadId && deps.isOMEnabled) {
          baseClient
            .awaitBufferStatus({ agentId, resourceId: agentId, threadId: deps.threadId })
            .then(result => {
              setMessages(prev => injectBufferingEnds(prev, result?.record));
              void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
              void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
            })
            .catch(() => {});
        }
      } catch (error: any) {
        console.error('Error occurred in ChatProvider', error);
        if (error.name === 'AbortError') {
          return;
        }
        setStreamErrors(prev => [...prev, buildStreamErrorMessage({ runId: 'thrown', payload: { error } })]);
        resetObservationalMemoryStreamState();
      } finally {
        abortControllerRef.current = null;
      }
    },
    // Intentionally stable: fresh values are read through sendDepsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendMessage, agentId, baseClient, queryClient, refreshThreadList, refreshWorkingMemory, isRunningStream, setMessages],
  );

  const cancel = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetObservationalMemoryStreamState();
    cancelRun?.();

    if (sendDepsRef.current.threadId && sendDepsRef.current.isOMEnabled) {
      baseClient
        .awaitBufferStatus({ agentId, resourceId: agentId, threadId: sendDepsRef.current.threadId })
        .then(result => {
          setMessages(prev => injectBufferingEnds(prev, result?.record));
          void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
          void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelRun, agentId, baseClient, queryClient, setMessages]);

  // Build a global OM cycle index then convert OM parts to dynamic-tool form so
  // OM badges render. Strip transient error messages from `messages` (the same
  // errors live in `streamErrors`, which survives the post-stream refresh).
  const globalOmParts = useMemo(() => buildGlobalOmPartsByCycleId(messages), [messages]);

  const renderMessages = useMemo<MastraDBMessage[]>(
    () =>
      [...messages.filter(msg => msg.content?.metadata?.status !== 'error'), ...streamErrors].map(msg =>
        convertOmPartsInMastraMessage(msg, globalOmParts),
      ),
    [messages, streamErrors, globalOmParts],
  );

  const isRunning = isRunningStream || isAwaitingToolApproval;
  const canSendWhileStreaming = getCanSendWhileStreaming({
    isSupportedModel,
    threadSignalsEnabled,
    threadId,
    threadSignalsUnsupported,
  });

  const messagesValue = useMemo<MessagesContextValue>(() => ({ messages: renderMessages }), [renderMessages]);
  const runningValue = useMemo<RunningContextValue>(
    () => ({ isRunning, cancelRun: cancel, canSendWhileStreaming }),
    [isRunning, cancel, canSendWhileStreaming],
  );
  const sendValue = useMemo<SendContextValue>(() => ({ send }), [send]);

  return (
    <ChatRunningContext.Provider value={runningValue}>
      <ChatMessagesContext.Provider value={messagesValue}>
        <ChatSendContext.Provider value={sendValue}>
          <ToolCallProvider
            approveToolcall={approveToolCall}
            declineToolcall={declineToolCall}
            approveToolcallGenerate={approveToolCallGenerate}
            declineToolcallGenerate={declineToolCallGenerate}
            approveNetworkToolcall={approveNetworkToolCall}
            declineNetworkToolcall={declineNetworkToolCall}
            isRunning={isRunningStream}
            toolCallApprovals={toolCallApprovals}
            networkToolCallApprovals={networkToolCallApprovals}
          >
            {children}
          </ToolCallProvider>
        </ChatSendContext.Provider>
      </ChatMessagesContext.Provider>
    </ChatRunningContext.Provider>
  );
}
