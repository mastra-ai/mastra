import type { AppendMessage } from '@assistant-ui/react';
import { useExternalStoreRuntime, AssistantRuntimeProvider } from '@assistant-ui/react';
import { RequestContext } from '@mastra/core/di';
import type { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64 } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { toAssistantUIMessage, useMastraClient, useChat } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  buildMaxStepsStreamErrorMessage,
  buildStreamErrorMessage,
  isMaxStepsFinishChunk,
} from './stream-error-message';
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

/**
 * Converts a data-om-* part to dynamic-tool format so toAssistantUIMessage can transform it.
 * The ToolFallback component will detect the om-observation-* prefix and render ObservationMarkerBadge.
 *
 * Input: { type: 'data-om-observation-start', data: {...} }
 * Output: { type: 'dynamic-tool', toolCallId, toolName: 'om-observation-start', input: {...}, output: {...}, state: 'output-available' }
 */
const OM_TOOL_NAME = 'mastra-memory-om-observation';

type OmCycleParts = {
  start?: any;
  end?: any;
  failed?: any;
  bufferingStart?: any;
  bufferingEnd?: any;
  bufferingFailed?: any;
  activation?: any;
};

/**
 * Index data-om-* parts by cycleId from an array of parts.
 * Merges into an existing map so it can be called across multiple messages.
 */
const indexOmPartsByCycleId = (parts: any[], target: Map<string, OmCycleParts>) => {
  for (const part of parts) {
    const cycleId = (part as any).data?.cycleId;
    if (!cycleId) continue;

    const typeToKey: Record<string, keyof OmCycleParts> = {
      'data-om-observation-start': 'start',
      'data-om-observation-end': 'end',
      'data-om-observation-failed': 'failed',
      'data-om-buffering-start': 'bufferingStart',
      'data-om-buffering-end': 'bufferingEnd',
      'data-om-buffering-failed': 'bufferingFailed',
      'data-om-activation': 'activation',
    };

    const key = typeToKey[part.type];
    if (key) {
      const existing = target.get(cycleId) || {};
      existing[key] = part;
      target.set(cycleId, existing);
    }
  }
  return target;
};

/**
 * Build a global map of all OM cycle parts across all messages.
 * This gives each per-message converter the full picture of a cycle's state
 * (e.g., buffering-start on message A, activation on message B).
 */
const buildGlobalOmPartsByCycleId = (messages: MastraUIMessage[]) => {
  const map = new Map<string, OmCycleParts>();
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.parts)) continue;
    indexOmPartsByCycleId(msg.parts, map);
  }
  return map;
};

/**
 * Combines data-om-* parts in a message into single tool calls by cycleId.
 * - start marker creates a tool call in 'input-available' (loading) state
 * - end/failed marker with same cycleId updates it to 'output-available' (complete) state
 * If both start and end exist for the same cycleId, only the final state is kept.
 * The tool call is placed at the position of the START marker to preserve order.
 *
 * Note: cycleId is unique per observation cycle, while recordId is constant for the entire
 * memory record. Using cycleId ensures each observation cycle gets its own UI element.
 *
 * @param globalOmParts - Pre-built map of all OM cycle parts across ALL messages.
 *   This allows the converter to know the full state of a cycle even when its parts
 *   span multiple messages (e.g., buffering-start on msg A, activation on msg B).
 */
const convertOmPartsInMastraMessage = (
  message: MastraUIMessage,
  globalOmParts: Map<string, OmCycleParts>,
): MastraUIMessage => {
  if (!message || !Array.isArray(message.parts)) {
    return message;
  }

  // Build new parts array. Badges are ONLY rendered at start marker positions
  // (data-om-observation-start, data-om-buffering-start). All other OM parts
  // (end, failed, activation, status) are silently dropped — their data is already
  // captured in globalOmParts and merged into the badge at the start position.
  // This ensures badges stay in their original position even after reload.
  const convertedParts: any[] = [];

  for (const part of message.parts) {
    const cycleId = (part as any).data?.cycleId;
    const partType = part.type as string;

    // Only render badges at start marker positions
    if (partType === 'data-om-observation-start' && cycleId) {
      const cycle = globalOmParts.get(cycleId);
      if (!cycle) continue;

      const startData = cycle.start?.data || {};
      const endData = cycle.end?.data || {};
      const failedData = cycle.failed?.data || {};

      const isFailed = !!cycle.failed;
      const isComplete = !!cycle.end;
      const isDisconnected = !!startData.disconnectedAt || (isComplete && !!endData.disconnectedAt);
      const isLoading = !isFailed && !isComplete && !isDisconnected;

      const mergedData = {
        ...startData,
        ...(isComplete ? endData : {}),
        ...(isFailed ? failedData : {}),
        _state: isFailed ? 'failed' : isDisconnected ? 'disconnected' : isComplete ? 'complete' : 'loading',
      };

      convertedParts.push({
        type: 'dynamic-tool',
        toolCallId: `om-observation-${cycleId}`,
        toolName: OM_TOOL_NAME,
        input: mergedData,
        output: isLoading
          ? undefined
          : {
              status: isFailed ? 'failed' : isDisconnected ? 'disconnected' : 'complete',
              omData: mergedData,
            },
        state: isLoading ? 'input-available' : 'output-available',
      });
    } else if (partType === 'data-om-buffering-start' && cycleId) {
      const cycle = globalOmParts.get(cycleId);
      if (!cycle) continue;

      const startData = cycle.bufferingStart?.data || {};
      const endData = cycle.bufferingEnd?.data || {};
      const failedData = cycle.bufferingFailed?.data || {};
      const activationData = cycle.activation?.data || {};

      const isFailed = !!cycle.bufferingFailed;
      const isActivated = !!cycle.activation;
      const isComplete = !!cycle.bufferingEnd;
      const isDisconnected = !!startData.disconnectedAt;
      const isLoading = !isFailed && !isActivated && !isComplete && !isDisconnected;

      const mergedData: Record<string, unknown> = {
        ...startData,
        ...(isComplete ? endData : {}),
        ...(isFailed ? failedData : {}),
        ...(isActivated ? activationData : {}),
        _state: isFailed
          ? 'buffering-failed'
          : isActivated
            ? 'activated'
            : isDisconnected
              ? 'disconnected'
              : isComplete
                ? 'buffering-complete'
                : 'buffering',
      };
      // Map activation fields to badge fields so they display correctly on reload
      // (activation markers use tokensActivated, but the badge reads tokensObserved)
      if (!mergedData.tokensObserved && mergedData.tokensActivated) {
        mergedData.tokensObserved = mergedData.tokensActivated;
      }

      const bufferingStatus = isFailed
        ? 'buffering-failed'
        : isActivated
          ? 'activated'
          : isDisconnected
            ? 'disconnected'
            : 'buffering-complete';

      convertedParts.push({
        type: 'dynamic-tool',
        toolCallId: `om-buffering-${cycleId}`,
        toolName: OM_TOOL_NAME,
        input: mergedData,
        output: isLoading
          ? undefined
          : {
              status: bufferingStatus,
              omData: mergedData,
            },
        state: isLoading ? 'input-available' : 'output-available',
      });
    } else if (partType?.startsWith('data-om-')) {
      // Silently skip all other OM parts (end, failed, activation, status).
      // Their data is already in globalOmParts and merged into the start-position badge.
      continue;
    } else {
      // Keep non-OM parts as-is
      convertedParts.push(part);
    }
  }

  return {
    ...message,
    parts: convertedParts,
  };
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
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const { settings: tracingSettings } = useTracingSettings();

  // Errors emitted as `error` chunks (or thrown by sendMessage) are not persisted to
  // server memory, so they get wiped from useChat's `messages` state when
  // `initialMessages` refreshes after a stream ends. Track them in a parallel
  // state that survives those resets so the chat still surfaces the failure.
  const [streamErrors, setStreamErrors] = useState<MastraUIMessage[]>([]);
  const [pendingSignals, setPendingSignals] = useState<{ id: string; preview: string }[]>([]);
  const [threadSignalsUnsupported, setThreadSignalsUnsupported] = useState(false);
  const threadSignalsUnsupportedRef = useRef(false);
  const threadSignalsEnabled = window.MASTRA_AGENT_SIGNALS !== 'false';

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
  const handleProgressUpdate = (data: any) => {
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
  };

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

  // Helper to mark in-progress OM markers as disconnected in messages.
  // Preserves the original part type (keeps start markers as start markers)
  // so the badge stays anchored at the correct position. Only adds disconnection
  // metadata to the data payload.
  const markOmMarkersAsDisconnected = (msgs: any[]) => {
    return msgs.map(msg => {
      if (msg.role !== 'assistant') return msg;

      // Handle both 'parts' (v2/v3) and 'content' (legacy) message formats
      const partsKey = msg.parts ? 'parts' : msg.content ? 'content' : null;
      if (!partsKey || !Array.isArray(msg[partsKey])) return msg;

      const updatedParts = msg[partsKey].map((part: any) => {
        // Mark raw start markers as disconnected (keep original type for badge anchoring)
        if (part.type === 'data-om-observation-start' || part.type === 'data-om-buffering-start') {
          return {
            ...part,
            data: {
              ...part.data,
              disconnectedAt: new Date().toISOString(),
              _state: 'disconnected',
            },
          };
        }
        // Also check for already-converted tool-call format
        if (part.type === 'tool-call' && part.toolName === 'mastra-memory-om-observation') {
          const omData = part.metadata?.omData || part.args;
          // If it's in loading state (no completedAt, failedAt, or disconnectedAt), mark as disconnected
          if (!omData?.completedAt && !omData?.failedAt && !omData?.disconnectedAt) {
            return {
              ...part,
              metadata: {
                ...part.metadata,
                omData: {
                  ...omData,
                  disconnectedAt: new Date().toISOString(),
                  _state: 'disconnected',
                },
              },
            };
          }
        }
        return part;
      });

      return { ...msg, [partsKey]: updatedParts };
    });
  };

  // Mark in-progress buffering badges as complete after buffer-status resolves.
  // Injects synthetic data-om-buffering-end parts so convertOmPartsInMastraMessage
  // sees a matching end for each in-progress start. Uses the record from awaitBufferStatus
  // to populate token counts and observations for the badge display.
  const markBufferingBadgesAsComplete = (msgs: any[], record?: any) => {
    // Build a lookup from cycleId to chunk data for observation buffering
    const chunksByCycleId = new Map<string, any>();
    if (record?.bufferedObservationChunks) {
      for (const chunk of record.bufferedObservationChunks) {
        if (chunk.cycleId) {
          chunksByCycleId.set(chunk.cycleId, chunk);
        }
      }
    }

    return msgs.map(msg => {
      if (msg.role !== 'assistant') return msg;

      const partsKey = msg.parts ? 'parts' : msg.content ? 'content' : null;
      if (!partsKey || !Array.isArray(msg[partsKey])) return msg;

      const newParts: any[] = [];
      let changed = false;

      for (const part of msg[partsKey]) {
        newParts.push(part);
        // For each buffering-start that isn't already disconnected, inject a synthetic buffering-end
        if (part.type === 'data-om-buffering-start' && part.data?.cycleId && !part.data?.disconnectedAt) {
          const cycleId = part.data.cycleId;
          const opType = part.data.operationType;

          let endData: Record<string, any> = {
            cycleId,
            operationType: opType,
            completedAt: new Date().toISOString(),
          };

          if (opType === 'observation') {
            // Match chunk by cycleId for observation buffering
            const chunk = chunksByCycleId.get(cycleId);
            if (chunk) {
              endData.tokensBuffered = chunk.messageTokens;
              endData.bufferedTokens = chunk.tokenCount;
              endData.observations = chunk.observations;
            }
          } else if (opType === 'reflection') {
            // Use aggregate reflection data from the record
            if (record) {
              endData.tokensBuffered = record.bufferedReflectionInputTokens;
              endData.bufferedTokens = record.bufferedReflectionTokens;
              endData.observations = record.bufferedReflection;
            }
          }

          newParts.push({ type: 'data-om-buffering-end', data: endData });
          changed = true;
        }
      }

      return changed ? { ...msg, [partsKey]: newParts } : msg;
    });
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
    const allMessages = [...(initialMessages || [])];
    let lastProgress: any = null;
    for (const msg of allMessages) {
      const parts = (msg as any).parts || (msg as any).content || [];
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        if (part?.type === 'data-om-activation' && part?.data?.cycleId) {
          markCycleIdActivated(part.data.cycleId);
        }
        if (part?.type === 'data-om-status' && part?.data) {
          lastProgress = part.data;
        }
      }
    }
    // Restore the last known progress so sidebar shows accurate token counts on load
    if (lastProgress) {
      handleProgressUpdate(lastProgress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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
                setMessages(prev => markBufferingBadgesAsComplete(prev, result?.record));
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
            setMessages(prev => markBufferingBadgesAsComplete(prev, result?.record));

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
          setMessages(prev => markBufferingBadgesAsComplete(prev, result?.record));

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
  const vnextmessages = [...messages.filter(msg => msg.metadata?.status !== 'error'), ...streamErrors].map(msg => {
    const converted = convertOmPartsInMastraMessage(msg, globalOmParts);
    return toAssistantUIMessage(converted);
  });

  const runtime = useExternalStoreRuntime({
    isRunning: isRunningStream,
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
        isStreaming: isRunningStream,
        canSendWhileStreaming:
          isSupportedModel && threadSignalsEnabled && Boolean(threadId) && !threadSignalsUnsupported,
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
