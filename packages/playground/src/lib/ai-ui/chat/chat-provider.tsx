import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import { memoryStatusQueryKey } from '@mastra/playground-ui/domains/memory/hooks/use-memory-status';
import { memoryThreadMessagesQueryKey } from '@mastra/playground-ui/domains/memory/hooks/use-memory-thread-messages';
import { observationalMemoryQueryKey } from '@mastra/playground-ui/domains/memory/hooks/use-observational-memory';
import { useChat, useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  ChatAgentContext,
  ChatMessagesContext,
  ChatRunningContext,
  ChatRunVersionIdentityContext,
  ChatSendContext,
  ChatTasksContext,
} from './chat-context';
import type {
  AgentContextValue,
  MessagesContextValue,
  RunningContextValue,
  SendContextValue,
  TasksContextValue,
} from './chat-context';
import { useChatSendHandler } from './use-chat-send-handler';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { usePlaygroundModelOptional } from '@/domains/agents/context/playground-model-context';
import { classifyAgentRunContinuationError } from '@/domains/agents/utils/agent-run-continuation-error';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { getCanSendWhileStreaming } from '@/services/mastra-runtime-state';
import {
  buildGlobalOmPartsByCycleId,
  convertOmPartsInMastraMessage,
  hasInProgressBufferingMarkers,
  injectBufferingEnds,
  markOmMarkersAsDisconnected,
  scanOmInitialState,
} from '@/services/om-parts-converter';
import type { OmTerminalExtractionCache } from '@/services/om-parts-converter';
import { buildStreamErrorMessage } from '@/services/stream-error-message';
import { ToolCallProvider } from '@/services/tool-call-provider';
import type { ChatProps } from '@/types';

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
  versions,
  canStartRun = true,
  runBlockedReason,
  canContinueRun = true,
  continuationBlockedReason,
  onRunVersionSelectorError,
  onRunAuthorizationError,
  agentVersionId,
  supportsMemory,
}: Readonly<{ children: ReactNode }> & ChatProps) {
  const { settings: tracingSettings } = useTracingSettings();
  const modelOverride = usePlaygroundModelOptional()?.modelOverride;

  // Errors emitted as `error` chunks (or thrown by sendMessage) are not persisted
  // to server memory, so they get wiped from useChat's `messages` state when
  // `initialMessages` refreshes after a stream ends. Track them in a parallel
  // state that survives those resets so the chat still surfaces the failure.
  const [streamErrors, setStreamErrors] = useState<MastraDBMessage[]>([]);
  const [isToolContinuationBlocked, setIsToolContinuationBlocked] = useState(false);
  const [threadSignalsUnsupported, setThreadSignalsUnsupported] = useState(false);
  const threadSignalsUnsupportedRef = useRef(false);
  const modelSettings = settings?.modelSettings ?? {};
  const threadSignalsEnabled =
    window.MASTRA_AGENT_SIGNALS !== 'false' && supportsMemory !== false && !modelSettings.chatWithLegacyStream;

  // Clear persisted stream errors when switching threads/agents so they don't
  // leak across conversations.
  useEffect(() => {
    setStreamErrors([]);
    setIsToolContinuationBlocked(false);
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
    tasks,
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
    runVersionIdentity,
  } = useChat({
    agentId,
    threadId,
    initialMessages,
    versions,
    requestContext: chatRequestContext,
    enableThreadSignals: threadSignalsEnabled,
    onThreadSignalsUnsupported: () => {
      threadSignalsUnsupportedRef.current = true;
      setThreadSignalsUnsupported(true);
    },
  });

  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const queryClient = useQueryClient();
  const baseClient = useMastraClient();

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

  const handleObservationStart = useCallback(
    (operationType?: string) => {
      if (operationType === 'reflection') {
        setIsReflectingFromStream(true);
      } else {
        setIsObservingFromStream(true);
      }
    },
    [setIsObservingFromStream, setIsReflectingFromStream],
  );

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

  const refreshObservationalMemory = useCallback(
    (operationType?: string) => {
      if (operationType === 'reflection') {
        setIsReflectingFromStream(false);
      } else {
        setIsObservingFromStream(false);
      }
      signalObservationsUpdated();
      void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
      // Force an immediate refetch of the memory timeline panel, which uses the
      // playground-ui hooks keyed under the ['memory', ...] prefix. Scope to the
      // active thread so unrelated memory caches and other threads are untouched,
      // and refetch (not just invalidate) so the panel shows live data right away.
      void queryClient.refetchQueries({ queryKey: observationalMemoryQueryKey(agentId, threadId) });
      void queryClient.refetchQueries({ queryKey: memoryThreadMessagesQueryKey(threadId) });
      void queryClient.refetchQueries({ queryKey: memoryStatusQueryKey(agentId, threadId) });
    },
    [agentId, queryClient, setIsObservingFromStream, setIsReflectingFromStream, signalObservationsUpdated, threadId],
  );

  const handleActivation = useCallback(
    (data: any) => {
      const cycleId = data?.cycleId;
      if (cycleId) {
        markCycleIdActivated(cycleId);
      }
    },
    [markCycleIdActivated],
  );

  const resetObservationalMemoryStreamState = useCallback(() => {
    setIsObservingFromStream(false);
    setIsReflectingFromStream(false);
    setMessages(prev => markOmMarkersAsDisconnected(prev));
    void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
    // Force an immediate refetch of the memory timeline panel on stream reset (see refreshObservationalMemory).
    void queryClient.refetchQueries({ queryKey: observationalMemoryQueryKey(agentId, threadId) });
    void queryClient.refetchQueries({ queryKey: memoryThreadMessagesQueryKey(threadId) });
    void queryClient.refetchQueries({ queryKey: memoryStatusQueryKey(agentId, threadId) });
  }, [agentId, queryClient, setIsObservingFromStream, setIsReflectingFromStream, setMessages, threadId]);

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

  useEffect(() => {
    if (!threadId || !hasInProgressBufferingMarkers(initialMessages || [])) return;

    let cancelled = false;
    baseClient
      .awaitBufferStatus({ agentId, resourceId: agentId, threadId })
      .then(result => {
        if (cancelled) return;
        setMessages(prev => injectBufferingEnds(prev, result?.record));
      })
      .catch(() => {
        if (cancelled) return;
        setMessages(prev => markOmMarkersAsDisconnected(prev));
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, baseClient, initialMessages, setMessages, threadId]);

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
    chatWithLegacyStream,
    providerOptions,
    requireToolApproval,
  } = modelSettings;

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

  const { send, cancel } = useChatSendHandler({
    agentId,
    requestContext,
    agentVersionId,
    threadId,
    modelSettingsArgs,
    model: modelOverride,
    chatWithNetwork,
    chatWithGenerate,
    maxSteps,
    isOMEnabled,
    tracingOptions: tracingSettings?.tracingOptions,
    threadSignalsUnsupportedRef,
    isRunningStream,
    sendMessage,
    cancelRun,
    setMessages,
    setStreamErrors,
    refreshThreadList,
    refreshWorkingMemory,
    handleObservationStart,
    handleProgressUpdate,
    refreshObservationalMemory,
    handleActivation,
    resetObservationalMemoryStreamState,
    signalTimelineRefresh: signalObservationsUpdated,
    onRunVersionSelectorError,
    onRunAuthorizationError,
  });

  const handleToolContinuationError = (error: unknown) => {
    const continuationError = classifyAgentRunContinuationError(error);
    if (continuationError.type !== 'other') {
      setIsToolContinuationBlocked(true);
    }
    if (continuationError.type === 'authorization') {
      onRunAuthorizationError?.();
    }
    const displayedError = continuationError.type === 'other' ? continuationError.error : continuationError.message;
    setStreamErrors(prev => [
      ...prev,
      buildStreamErrorMessage({ runId: 'tool-continuation', payload: { error: displayedError } }),
    ]);
  };

  const runToolContinuation = (continuation: () => Promise<unknown>) => {
    if (isToolContinuationBlocked || !canContinueRun) return;
    void continuation().catch(handleToolContinuationError);
  };

  const handleApproveToolCall = (toolCallId: string, resumeData?: unknown) => {
    runToolContinuation(() => approveToolCall(toolCallId, resumeData));
  };

  const handleDeclineToolCall = (toolCallId: string) => {
    runToolContinuation(() => declineToolCall(toolCallId));
  };

  const handleApproveToolCallGenerate = (toolCallId: string) => {
    runToolContinuation(() => approveToolCallGenerate(toolCallId));
  };

  const handleDeclineToolCallGenerate = (toolCallId: string) => {
    runToolContinuation(() => declineToolCallGenerate(toolCallId));
  };

  const handleApproveNetworkToolCall = (toolName: string, runId?: string) => {
    runToolContinuation(() => approveNetworkToolCall(toolName, runId));
  };

  const handleDeclineNetworkToolCall = (toolName: string, runId?: string) => {
    runToolContinuation(() => declineNetworkToolCall(toolName, runId));
  };

  const isSupportedModel = modelVersion === 'v2' || modelVersion === 'v3';

  // Build a global OM cycle index then convert OM parts to dynamic-tool form so
  // OM badges render. Strip transient error messages from `messages` (the same
  // errors live in `streamErrors`, which survives the post-stream refresh).
  const omTerminalExtractionCacheRef = useRef<OmTerminalExtractionCache>(new Map());
  const globalOmParts = useMemo(
    () => buildGlobalOmPartsByCycleId(messages, omTerminalExtractionCacheRef.current),
    [messages],
  );

  const renderMessages = useMemo<MastraDBMessage[]>(
    () =>
      [...messages.filter(msg => msg.content?.metadata?.status !== 'error'), ...streamErrors].map(msg =>
        convertOmPartsInMastraMessage(msg, globalOmParts),
      ),
    [messages, streamErrors, globalOmParts],
  );

  const isRunning = isRunningStream || isAwaitingToolApproval;
  const isContinuationBlocked = isToolContinuationBlocked || !canContinueRun;
  const effectiveContinuationBlockedReason = isToolContinuationBlocked
    ? 'Cancel the current run before sending another message.'
    : continuationBlockedReason;
  const usesSignalStreamTransport = !chatWithGenerate && !chatWithNetwork && !chatWithLegacyStream;
  const canSendWhileStreaming = getCanSendWhileStreaming({
    isSupportedModel,
    threadSignalsEnabled: threadSignalsEnabled && usesSignalStreamTransport,
    threadId,
    threadSignalsUnsupported,
  });

  const messagesValue = useMemo<MessagesContextValue>(() => ({ messages: renderMessages }), [renderMessages]);
  const runningValue = useMemo<RunningContextValue>(
    () => ({
      isRunning,
      isRunningStream,
      cancelRun: () => {
        setIsToolContinuationBlocked(false);
        return cancel();
      },
      canSendWhileStreaming,
      canStartRun,
      runBlockedReason,
      canContinueRun,
      continuationBlockedReason: effectiveContinuationBlockedReason,
      isContinuationBlocked,
    }),
    [
      isRunning,
      isRunningStream,
      cancel,
      canSendWhileStreaming,
      canStartRun,
      runBlockedReason,
      canContinueRun,
      effectiveContinuationBlockedReason,
      isContinuationBlocked,
    ],
  );
  const guardedSend = useCallback<SendContextValue['send']>(
    args => {
      if (isToolContinuationBlocked) return;
      if (isRunning ? !canContinueRun : !canStartRun) return;
      void send(args);
    },
    [canContinueRun, canStartRun, isRunning, isToolContinuationBlocked, send],
  );
  const sendValue = useMemo<SendContextValue>(() => ({ send: guardedSend }), [guardedSend]);
  const tasksValue = useMemo<TasksContextValue>(() => ({ tasks }), [tasks]);
  const agentValue = useMemo<AgentContextValue>(
    () => ({ agentId, agentVersionId: runVersionIdentity?.resolvedVersionId ?? agentVersionId, requestContext }),
    [agentId, agentVersionId, requestContext, runVersionIdentity?.resolvedVersionId],
  );

  return (
    <ChatAgentContext.Provider value={agentValue}>
      <ChatRunVersionIdentityContext.Provider value={runVersionIdentity}>
        <ChatRunningContext.Provider value={runningValue}>
          <ChatMessagesContext.Provider value={messagesValue}>
            <ChatTasksContext.Provider value={tasksValue}>
              <ChatSendContext.Provider value={sendValue}>
                <ToolCallProvider
                  approveToolcall={handleApproveToolCall}
                  declineToolcall={handleDeclineToolCall}
                  approveToolcallGenerate={handleApproveToolCallGenerate}
                  declineToolcallGenerate={handleDeclineToolCallGenerate}
                  approveNetworkToolcall={handleApproveNetworkToolCall}
                  declineNetworkToolcall={handleDeclineNetworkToolCall}
                  isRunning={isRunningStream}
                  isContinuationBlocked={isContinuationBlocked}
                  toolCallApprovals={toolCallApprovals}
                  networkToolCallApprovals={networkToolCallApprovals}
                >
                  {children}
                </ToolCallProvider>
              </ChatSendContext.Provider>
            </ChatTasksContext.Provider>
          </ChatMessagesContext.Provider>
        </ChatRunningContext.Provider>
      </ChatRunVersionIdentityContext.Provider>
    </ChatAgentContext.Provider>
  );
}
