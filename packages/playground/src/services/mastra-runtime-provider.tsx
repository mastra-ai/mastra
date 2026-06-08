import type { AppendMessage } from '@assistant-ui/react';
import { useExternalStoreRuntime, AssistantRuntimeProvider } from '@assistant-ui/react';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import type { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64 } from '@mastra/playground-ui';
import { useMastraClient, useChat } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getCanSendWhileStreaming } from './mastra-runtime-state';
import {
  buildGlobalOmPartsByCycleId,
  convertOmPartsInMastraMessage,
  injectBufferingEnds,
  markOmMarkersAsDisconnected,
  scanOmInitialState,
} from './om-parts-converter';
import {
  buildMaxStepsStreamErrorMessage,
  buildStreamErrorMessage,
  isMaxStepsFinishChunk,
} from './stream-error-message';
import { toAssistantUIMessages } from './to-assistant-ui-message';
import { ToolCallProvider } from './tool-call-provider';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useAdapters } from '@/lib/ai-ui/hooks/use-adapters';
import { ThreadRuntimeStateProvider } from '@/lib/ai-ui/thread-runtime-state';
import type { ChatProps } from '@/types';

const getAppendMessageText = (message: AppendMessage) => {
  const text = (message.content[0] as { text?: unknown } | undefined)?.text;

  if (typeof text === 'string') return text;

  if (text && typeof text === 'object' && 'content' in text && Array.isArray(text.content)) {
    return text.content
      .map(part => (part?.type === 'text' && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }

  throw new Error('Only text messages are supported');
};

const convertToAIAttachments = async (attachments: AppendMessage['attachments']): Promise<Array<CoreUserMessage>> => {
  const promises = (attachments ?? [])
    .filter(attachment => attachment.type === 'image' || attachment.type === 'document')
    .map(async attachment => {
      const isFileFromURL = attachment.name.startsWith('https://');

      if (attachment.type === 'document') {
        if (attachment.contentType === 'application/pdf') {
          // @ts-expect-error - TODO: fix this type issue somehow
          const pdfText = attachment.content?.[0]?.text || '';
          return {
            role: 'user' as const,
            content: [
              {
                type: 'file' as const,
                data: isFileFromURL ? attachment.name : `data:application/pdf;base64,${pdfText}`,
                mimeType: attachment.contentType,
                filename: attachment.name,
              },
            ],
          };
        }

        return {
          role: 'user' as const,
          // @ts-expect-error - TODO: fix this type issue somehow
          content: attachment.content[0]?.text || '',
        };
      }

      return {
        role: 'user' as const,

        content: [
          {
            type: 'image' as const,
            image: isFileFromURL ? attachment.name : await fileToBase64(attachment.file!),
            mimeType: attachment.file!.type,
          },
        ],
      };
    });

  return Promise.all(promises);
};

export function MastraRuntimeProvider({
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
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const { settings: tracingSettings } = useTracingSettings();

  // Errors emitted as `error` chunks (or thrown by sendMessage) are not persisted to
  // server memory, so they get wiped from useChat's `messages` state when
  // `initialMessages` refreshes after a stream ends. Track them in a parallel
  // state that survives those resets so the chat still surfaces the failure.
  const [streamErrors, setStreamErrors] = useState<MastraDBMessage[]>([]);
  const [pendingSignals, setPendingSignals] = useState<{ id: string; preview: string }[]>([]);
  const [threadSignalsUnsupported, setThreadSignalsUnsupported] = useState(false);
  const threadSignalsUnsupportedRef = useRef(false);
  const threadSignalsEnabled =
    window.MASTRA_AGENT_SIGNALS !== 'false' &&
    supportsMemory !== false &&
    !settings?.modelSettings?.chatWithLegacyStream;

  const addPendingSignal = useCallback((signalId: string, preview: string) => {
    setPendingSignals(prev => [...prev.filter(signal => signal.id !== signalId), { id: signalId, preview }]);
  }, []);

  const removePendingSignal = useCallback((signalId: string) => {
    setPendingSignals(prev => prev.filter(signal => signal.id !== signalId));
  }, []);

  // Clear any persisted stream errors when switching threads or agents so they
  // don't leak across conversations.
  useEffect(() => {
    setStreamErrors([]);
    setPendingSignals([]);
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
    onSignalSent: addPendingSignal,
    onSignalEcho: removePendingSignal,
    onThreadSignalsUnsupported: () => {
      threadSignalsUnsupportedRef.current = true;
      setThreadSignalsUnsupported(true);
      setPendingSignals([]);
    },
  });

  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Check if OM is enabled from the agent's memory config.
  // The config value can be `true`, `false`, `undefined`, or an object with/without `.enabled`.
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

  // Helper to signal observation/reflection started (from streaming)
  const handleObservationStart = (operationType?: string) => {
    if (operationType === 'reflection') {
      setIsReflectingFromStream(true);
    } else {
      setIsObservingFromStream(true);
    }
  };

  // Helper to update progress from streamed data-om-status parts
  const handleProgressUpdate = useCallback(
    (data: any) => {
      // Ignore progress from a different thread (e.g., if user switched threads mid-stream)
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

  // Helper to refresh OM sidebar when observation/reflection completes
  const refreshObservationalMemory = (operationType?: string) => {
    if (operationType === 'reflection') {
      setIsReflectingFromStream(false);
    } else {
      setIsObservingFromStream(false);
    }
    // Don't clear streamProgress — keep last known values so sidebar shows
    // accurate token counts even after the stream ends or on page reload
    signalObservationsUpdated();
    // Invalidate both the OM data and status queries to trigger refetch
    void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
  };

  // Helper to handle activation markers - marks cycleId as activated so buffering badges update
  const handleActivation = (data: any) => {
    const cycleId = data?.cycleId;
    if (cycleId) {
      markCycleIdActivated(cycleId);
    }
  };

  // Helper to reset OM streaming state when stream is interrupted
  // (user cancel, network error, process exit, etc.)
  const resetObservationalMemoryStreamState = () => {
    setIsObservingFromStream(false);
    setIsReflectingFromStream(false);
    // Don't clear streamProgress — keep last known values so the sidebar
    // continues to show accurate token counts instead of resetting to 0.
    // The next stream will naturally update streamProgress via data-om-status events.

    // Mark any in-progress observation markers as disconnected
    setMessages(prev => markOmMarkersAsDisconnected(prev));

    // Refresh to get latest state from server
    void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
  };

  // On initial load, scan messages for activation markers and the last progress part.
  // This ensures buffering badges show as activated and token counts are accurate on reload.
  useEffect(() => {
    const { activatedCycleIds, lastProgress } = scanOmInitialState(initialMessages || []);
    for (const cycleId of activatedCycleIds) {
      markCycleIdActivated(cycleId);
    }
    // Restore the last known progress so sidebar shows accurate token counts on load
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

  const onNew = async (message: AppendMessage) => {
    if (threadSignalsUnsupportedRef.current && (isRunningStream || abortControllerRef.current)) return;
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const attachments = await convertToAIAttachments(message.attachments);

    const input = getAppendMessageText(message);

    // Reset persisted errors at the start of a new turn so a fresh send doesn't
    // carry over errors from a previous failed run.
    setStreamErrors([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestContextInstance = new RequestContext();
    Object.entries(requestContext ?? {}).forEach(([key, value]) => {
      requestContextInstance.set(key, value);
    });
    if (agentVersionId) {
      requestContextInstance.set('agentVersionId', agentVersionId);
    }

    try {
      if (chatWithNetwork) {
        await sendMessage({
          message: input,
          mode: 'network',
          coreUserMessages: attachments,
          requestContext: requestContextInstance,
          threadId,
          modelSettings: modelSettingsArgs,
          signal: controller.signal,
          tracingOptions: tracingSettings?.tracingOptions,
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

            if ((chunk as any).type === 'error') {
              setStreamErrors(prev => [...prev, buildStreamErrorMessage(chunk as any)]);
            }

            // Signal observation/reflection started (for sidebar status)
            if ((chunk as any).type === 'data-om-observation-start') {
              handleObservationStart((chunk as any).data?.operationType);
            }

            // Update progress from streamed data-om-status parts
            if ((chunk as any).type === 'data-om-status') {
              handleProgressUpdate((chunk as any).data);
            }

            // Refresh OM sidebar when observation/reflection completes (if OM chunks are passed through network mode)
            if (
              (chunk as any).type === 'data-om-observation-end' ||
              (chunk as any).type === 'data-om-observation-failed' ||
              (chunk as any).type === 'data-om-activation'
            ) {
              refreshObservationalMemory((chunk as any).data?.operationType);
            }

            // Mark cycleIds as activated for UI update of buffering badges
            if ((chunk as any).type === 'data-om-activation') {
              handleActivation((chunk as any).data);
            }
          },
        });
      } else {
        if (chatWithGenerate) {
          await sendMessage({
            message: input,
            mode: 'generate',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId,
            modelSettings: modelSettingsArgs,
            signal: controller.signal,
            tracingOptions: tracingSettings?.tracingOptions,
          });

          await refreshThreadList?.();

          return;
        } else {
          await sendMessage({
            message: input,
            mode: 'stream',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId,
            modelSettings: modelSettingsArgs,
            tracingOptions: tracingSettings?.tracingOptions,
            onChunk: async chunk => {
              if (chunk.type === 'finish') {
                if (isMaxStepsFinishChunk(chunk)) {
                  setStreamErrors(prev => [...prev, buildMaxStepsStreamErrorMessage(chunk, maxSteps)]);
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

              // Signal observation started (for sidebar status)
              if (chunk.type === 'data-om-observation-start') {
                handleObservationStart((chunk as any).data?.operationType);
              }

              // Update progress from streamed data-om-status parts
              if (chunk.type === 'data-om-status') {
                handleProgressUpdate((chunk as any).data);
              }

              // Refresh OM sidebar when observation completes or buffered observations are activated
              if (
                chunk.type === 'data-om-observation-end' ||
                chunk.type === 'data-om-observation-failed' ||
                chunk.type === 'data-om-activation'
              ) {
                refreshObservationalMemory((chunk as any).data?.operationType);
              }

              // Mark cycleIds as activated for UI update of buffering badges
              if (chunk.type === 'data-om-activation') {
                handleActivation((chunk as any).data);
              }
            },
            signal: controller.signal,
          });

          // Fire-and-forget: await any in-flight buffering operations, then refresh sidebar
          if (threadId && isOMEnabled) {
            baseClient
              .awaitBufferStatus({ agentId, resourceId: agentId, threadId })
              .then(result => {
                setMessages(prev => injectBufferingEnds(prev, result?.record));
                void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
                void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
              })
              .catch(() => {});
          }

          return;
        }
      }

      setTimeout(() => {
        refreshThreadList?.();
      }, 500);

      // Fire-and-forget: await any in-flight buffering operations, then refresh sidebar
      if (threadId && isOMEnabled) {
        baseClient
          .awaitBufferStatus({ agentId, resourceId: agentId, threadId })
          .then(result => {
            setMessages(prev => injectBufferingEnds(prev, result?.record));

            void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
            void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
          })
          .catch(() => {});
      }
    } catch (error: any) {
      console.error('Error occurred in MastraRuntimeProvider', error);

      // Handle cancellation gracefully
      if (error.name === 'AbortError') {
        // Don't add an error message for user-initiated cancellation
        return;
      }

      setStreamErrors(prev => [...prev, buildStreamErrorMessage({ runId: 'thrown', payload: { error } })]);
      // Reset OM streaming state when an error occurs (stream was interrupted)
      resetObservationalMemoryStreamState();
    } finally {
      // Clean up the abort controller reference
      abortControllerRef.current = null;
      // Note: We don't reset OM streaming state here on successful completion.
      // The streamProgress is kept to show accurate token counts in the sidebar.
    }
  };

  const onCancel = async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPendingSignals([]);
    // Reset OM streaming state in case observation was in progress
    resetObservationalMemoryStreamState();
    cancelRun?.();

    // Fire-and-forget: await any in-flight buffering operations, then refresh sidebar
    if (threadId && isOMEnabled) {
      baseClient
        .awaitBufferStatus({ agentId, resourceId: agentId, threadId })
        .then(result => {
          setMessages(prev => injectBufferingEnds(prev, result?.record));

          void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
          void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
        })
        .catch(() => {});
    }
  };

  const { adapters, isReady } = useAdapters(agentId);

  // Build a global index of all OM cycle parts across all messages synchronously.
  // This gives each per-message converter the full picture of a cycle's state even when
  // parts are spread across messages (e.g., buffering-start on msg A, activation on msg B).
  const globalOmParts = useMemo(() => buildGlobalOmPartsByCycleId(messages), [messages]);

  // Convert data-om-* parts to dynamic-tool format BEFORE toAssistantUIMessage.
  // Strip transient error messages from `messages` because the same errors are
  // tracked in `streamErrors` (which survives the post-stream initialMessages
  // refresh). Without filtering here we would briefly render duplicate errors
  // during the streaming window.
  const vnextmessages = toAssistantUIMessages(
    [...messages.filter(msg => msg.content?.metadata?.status !== 'error'), ...streamErrors].map(msg =>
      convertOmPartsInMastraMessage(msg, globalOmParts),
    ),
  );

  const runtime = useExternalStoreRuntime({
    isRunning: isRunningStream || isAwaitingToolApproval,
    messages: vnextmessages,
    convertMessage: x => x,
    onNew,
    onCancel,
    adapters: isReady ? adapters : undefined,
    extras: {
      approveToolCall,
      declineToolCall,
      approveNetworkToolCall,
      declineNetworkToolCall,
    },
  });

  return (
    <ThreadRuntimeStateProvider
      value={{
        isStreaming: isRunningStream || isAwaitingToolApproval,
        canSendWhileStreaming: getCanSendWhileStreaming({
          isSupportedModel,
          threadSignalsEnabled,
          threadId,
          threadSignalsUnsupported,
        }),
        cancelStream: onCancel,
        pendingSignals,
        hasPendingMessages: pendingSignals.length > 0,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        {isReady ? (
          <ToolCallProvider
            approveToolcall={approveToolCall}
            declineToolcall={declineToolCall}
            approveToolcallGenerate={approveToolCallGenerate}
            declineToolcallGenerate={declineToolCallGenerate}
            isRunning={isRunningStream}
            toolCallApprovals={toolCallApprovals}
            approveNetworkToolcall={approveNetworkToolCall}
            declineNetworkToolcall={declineNetworkToolCall}
            networkToolCallApprovals={networkToolCallApprovals}
          >
            {children}
          </ToolCallProvider>
        ) : null}
      </AssistantRuntimeProvider>
    </ThreadRuntimeStateProvider>
  );
}
