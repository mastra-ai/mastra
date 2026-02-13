import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { useState, useMemo, ReactNode, useRef, useEffect } from 'react';
import { RequestContext } from '@mastra/core/di';
import { ChatProps } from '@/types';
import { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64 } from '@/lib/file/toBase64';
import { toAssistantUIMessage, useMastraClient } from '@mastra/react';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { MastraClient, UIMessageWithMetadata } from '@mastra/client-js';
import { useAdapters } from '@/lib/ai-ui/hooks/use-adapters';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { MastraUIMessage, useChat } from '@mastra/react';
import { ToolCallProvider } from './tool-call-provider';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { useQueryClient } from '@tanstack/react-query';
import { useMemoryConfig } from '@/domains/memory/hooks';

const handleFinishReason = (finishReason: string) => {
  switch (finishReason) {
    case 'tool-calls':
      throw new Error('Stream finished with reason tool-calls, try increasing maxSteps');
    default:
      break;
  }
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

const initializeMessageState = (initialMessages: UIMessageWithMetadata[]) => {
  // @ts-expect-error - TODO: fix the ThreadMessageLike type, it's missing some properties like "data" from the role.
  const convertedMessages: ThreadMessageLike[] = initialMessages
    ?.map((message: UIMessageWithMetadata) => {
      const attachmentsAsContentParts = (message.experimental_attachments || []).map((image: any) => ({
        type: image.contentType.startsWith(`image/`)
          ? 'image'
          : image.contentType.startsWith(`audio/`)
            ? 'audio'
            : 'file',
        mimeType: image.contentType,
        image: image.url,
      }));

      const formattedParts = (message.parts || [])
        .map((part: any) => {
          if (part.type === 'reasoning') {
            return {
              type: 'reasoning',
              text:
                part.reasoning ||
                part?.details
                  ?.filter((detail: any) => detail.type === 'text')
                  ?.map((detail: any) => detail.text)
                  .join(' '),
            };
          }
          if (part.type === 'tool-invocation') {
            if (part.toolInvocation.state === 'result') {
              return {
                type: 'tool-call',
                toolCallId: part.toolInvocation.toolCallId,
                toolName: part.toolInvocation.toolName,
                args: part.toolInvocation.args,
                result: part.toolInvocation.result,
              };
            } else if (part.toolInvocation.state === 'call') {
              // Only return pending tool calls that are legitimately awaiting approval
              const toolCallId = part.toolInvocation.toolCallId;
              const toolName = part.toolInvocation.toolName;
              const pendingToolApprovals = message.metadata?.pendingToolApprovals as Record<string, any> | undefined;
              const suspensionData = pendingToolApprovals?.[toolCallId];
              if (suspensionData) {
                return {
                  type: 'tool-call',
                  toolCallId,
                  toolName,
                  args: part.toolInvocation.args,
                  metadata: {
                    mode: 'stream',
                    requireApprovalMetadata: {
                      [toolName]: suspensionData,
                    },
                  },
                };
              }
            }
          }

          if (part.type === 'file') {
            return {
              type: 'file',
              mimeType: part.mimeType,
              data: part.data,
            };
          }

          if (part.type === 'text') {
            return {
              type: 'text',
              text: part.text,
            };
          }

          // Keep data-om-* parts as-is - they'll be converted by convertOmPartsInMastraMessage later
          if (part.type?.startsWith('data-om-')) {
            return part;
          }
        })
        .filter(Boolean);

      return {
        ...message,
        content: [...formattedParts, ...attachmentsAsContentParts],
      };
    })
    .filter(Boolean);

  return convertedMessages;
};

export function MastraRuntimeProvider({
  children,
  agentId,
  initialMessages,
  initialLegacyMessages,
  memory,
  threadId,
  refreshThreadList,
  settings,
  requestContext,
  modelVersion,
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const { settings: tracingSettings } = useTracingSettings();
  const [isLegacyRunning, setIsLegacyRunning] = useState(false);
  const [legacyMessages, setLegacyMessages] = useState<ThreadMessageLike[]>([]);

  useEffect(() => {
    setLegacyMessages(initializeMessageState(initialLegacyMessages || []));
  }, [initialLegacyMessages]);

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
    initialMessages,
  });

  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Check if OM is enabled from the agent's memory config.
  // The config value can be `true`, `false`, `undefined`, or an object with/without `.enabled`.
  const { data: memoryConfigData } = useMemoryConfig(agentId);
  const omConfig = memoryConfigData?.config?.observationalMemory;
  const isOMEnabled =
    omConfig === true || (typeof omConfig === 'object' && omConfig !== null && omConfig.enabled !== false);
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
    queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
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
    setLegacyMessages(prev => markOmMarkersAsDisconnected(prev));

    // Refresh to get latest state from server
    queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
  };

  // On initial load, scan messages for activation markers and the last progress part.
  // This ensures buffering badges show as activated and token counts are accurate on reload.
  useEffect(() => {
    const allMessages = [...(initialMessages || []), ...(initialLegacyMessages || [])];
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
    chatWithGenerateLegacy,
    chatWithGenerate,
    chatWithNetwork,
    providerOptions,
    requireToolApproval,
  } = settings?.modelSettings ?? {};
  const toolCallIdToName = useRef<Record<string, string>>({});

  const modelSettingsArgs = {
    frequencyPenalty,
    presencePenalty,
    maxRetries,
    temperature,
    topK,
    topP,
    seed,
    maxOutputTokens: maxTokens, // AI SDK v5 uses maxOutputTokens
    providerOptions,
    maxSteps,
    requireToolApproval,
  };

  const baseClient = useMastraClient();

  const isSupportedModel = modelVersion === 'v2' || modelVersion === 'v3';

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const attachments = await convertToAIAttachments(message.attachments);

    const input = message.content[0].text;
    if (!isSupportedModel) {
      setLegacyMessages(s => [...s, { role: 'user', content: input, attachments: message.attachments }]);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient.options,
      abortSignal: controller.signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const requestContextInstance = new RequestContext();
    Object.entries(requestContext ?? {}).forEach(([key, value]) => {
      requestContextInstance.set(key, value);
    });

    try {
      if (isSupportedModel) {
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
                refreshWorkingMemory?.();
              }

              if (chunk.type === 'network-execution-event-step-finish') {
                refreshThreadList?.();
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
                  await refreshThreadList?.();
                }

                if (
                  chunk.type === 'tool-result' &&
                  chunk.payload?.toolName === 'updateWorkingMemory' &&
                  typeof chunk.payload.result === 'object' &&
                  'success' in chunk.payload.result! &&
                  chunk.payload.result?.success
                ) {
                  refreshWorkingMemory?.();
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
                  queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
                  queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
                })
                .catch(() => {});
            }

            return;
          }
        }
      } else {
        if (chatWithGenerateLegacy) {
          setIsLegacyRunning(true);
          const generateResponse = await agent.generateLegacy({
            messages: [
              {
                role: 'user',
                content: input,
              },
              ...attachments,
            ],
            frequencyPenalty,
            presencePenalty,
            maxRetries,
            maxSteps,
            maxTokens,
            temperature,
            topK,
            topP,
            seed,
            requestContext: requestContextInstance,
            ...(memory ? { threadId, resourceId: agentId } : {}),
            providerOptions,
          });
          if (generateResponse.response && 'messages' in generateResponse.response) {
            const latestMessage = generateResponse.response.messages.reduce(
              (acc: ThreadMessageLike, message: any) => {
                const _content = Array.isArray(acc.content) ? acc.content : [];
                if (typeof message.content === 'string') {
                  return {
                    ...acc,
                    content: [
                      ..._content,
                      ...(generateResponse.reasoning ? [{ type: 'reasoning', text: generateResponse.reasoning }] : []),
                      {
                        type: 'text',
                        text: message.content,
                      },
                    ],
                  };
                }
                if (message.role === 'assistant') {
                  const toolCallContent = Array.isArray(message.content)
                    ? message.content.find((content: any) => content.type === 'tool-call')
                    : undefined;
                  const reasoningContent = Array.isArray(message.content)
                    ? message.content.find((content: any) => content.type === 'reasoning')
                    : undefined;

                  if (toolCallContent) {
                    const newContent = _content.map(c => {
                      if (c.type === 'tool-call' && c.toolCallId === toolCallContent?.toolCallId) {
                        return { ...c, ...toolCallContent };
                      }
                      return c;
                    });

                    const containsToolCall = newContent.some(c => c.type === 'tool-call');
                    return {
                      ...acc,
                      content: containsToolCall
                        ? [...(reasoningContent ? [reasoningContent] : []), ...newContent]
                        : [..._content, ...(reasoningContent ? [reasoningContent] : []), toolCallContent],
                    };
                  }

                  const textContent = Array.isArray(message.content)
                    ? message.content.find((content: any) => content.type === 'text' && content.text)
                    : undefined;

                  if (textContent) {
                    return {
                      ...acc,
                      content: [..._content, ...(reasoningContent ? [reasoningContent] : []), textContent],
                    };
                  }
                }

                if (message.role === 'tool') {
                  const toolResult = Array.isArray(message.content)
                    ? message.content.find((content: any) => content.type === 'tool-result')
                    : undefined;

                  if (toolResult) {
                    const newContent = _content.map(c => {
                      if (c.type === 'tool-call' && c.toolCallId === toolResult?.toolCallId) {
                        return { ...c, result: toolResult.result };
                      }
                      return c;
                    });
                    const containsToolCall = newContent.some(c => c.type === 'tool-call');

                    return {
                      ...acc,
                      content: containsToolCall
                        ? newContent
                        : [
                            ..._content,
                            { type: 'tool-result', toolCallId: toolResult.toolCallId, result: toolResult.result },
                          ],
                    };
                  }

                  return {
                    ...acc,
                    content: [..._content, toolResult],
                  };
                }
                return acc;
              },
              { role: 'assistant', content: [] },
            );
            setLegacyMessages(currentConversation => [...currentConversation, latestMessage as ThreadMessageLike]);
            handleFinishReason(generateResponse.finishReason);
          }

          setIsLegacyRunning(false);
        } else {
          setIsLegacyRunning(true);
          const response = await agent.streamLegacy({
            messages: [
              {
                role: 'user',
                content: input,
              },
              ...attachments,
            ],
            frequencyPenalty,
            presencePenalty,
            maxRetries,
            maxSteps,
            maxTokens,
            temperature,
            topK,
            topP,
            seed,
            requestContext: requestContextInstance,
            ...(memory ? { threadId, resourceId: agentId } : {}),
            providerOptions,
          });

          if (!response.body) {
            throw new Error('No response body');
          }

          let content = '';
          let assistantMessageAdded = false;
          let assistantToolCallAddedForUpdater = false;
          let assistantToolCallAddedForContent = false;

          function updater() {
            setLegacyMessages(currentConversation => {
              const message: ThreadMessageLike = {
                role: 'assistant',
                content: [{ type: 'text', text: content }],
              };

              if (!assistantMessageAdded) {
                assistantMessageAdded = true;
                if (assistantToolCallAddedForUpdater) {
                  assistantToolCallAddedForUpdater = false;
                }
                return [...currentConversation, message];
              }

              if (assistantToolCallAddedForUpdater) {
                // add as new message item in messages array if tool call was added
                assistantToolCallAddedForUpdater = false;
                return [...currentConversation, message];
              }
              return [...currentConversation.slice(0, -1), message];
            });
          }

          await response.processDataStream({
            onTextPart(value: any) {
              if (assistantToolCallAddedForContent) {
                // start new content value to add as next message item in messages array
                assistantToolCallAddedForContent = false;
                content = value;
              } else {
                content += value;
              }
              updater();
            },
            async onToolCallPart(value: any) {
              // Update the messages state
              setLegacyMessages(currentConversation => {
                // Get the last message (should be the assistant's message)
                const lastMessage = currentConversation[currentConversation.length - 1];

                // Only process if the last message is from the assistant
                if (lastMessage && lastMessage.role === 'assistant') {
                  // Check if this tool call already exists in the content
                  if (Array.isArray(lastMessage.content)) {
                    const existingToolCall = lastMessage.content.find(
                      (part: any) => part.type === 'tool-call' && part.toolCallId === value.toolCallId,
                    );
                    if (existingToolCall) {
                      // Tool call already exists, skip adding duplicate
                      return currentConversation;
                    }
                  }

                  // Create a new message with the tool call part
                  const updatedMessage: ThreadMessageLike = {
                    ...lastMessage,
                    content: Array.isArray(lastMessage.content)
                      ? [
                          ...lastMessage.content,
                          {
                            type: 'tool-call',
                            toolCallId: value.toolCallId,
                            toolName: value.toolName,
                            args: value.args,
                          },
                        ]
                      : [
                          ...(typeof lastMessage.content === 'string'
                            ? [{ type: 'text', text: lastMessage.content }]
                            : []),
                          {
                            type: 'tool-call',
                            toolCallId: value.toolCallId,
                            toolName: value.toolName,
                            args: value.args,
                          },
                        ],
                  };

                  assistantToolCallAddedForUpdater = true;
                  assistantToolCallAddedForContent = true;

                  // Replace the last message with the updated one
                  return [...currentConversation.slice(0, -1), updatedMessage];
                }

                // If there's no assistant message yet, create one
                const newMessage: ThreadMessageLike = {
                  role: 'assistant',
                  content: [
                    { type: 'text', text: content },
                    {
                      type: 'tool-call',
                      toolCallId: value.toolCallId,
                      toolName: value.toolName,
                      args: value.args,
                    },
                  ],
                };
                assistantToolCallAddedForUpdater = true;
                assistantToolCallAddedForContent = true;
                return [...currentConversation, newMessage];
              });
              toolCallIdToName.current[value.toolCallId] = value.toolName;
            },
            async onToolResultPart(value: any) {
              // Update the messages state
              setLegacyMessages(currentConversation => {
                // Get the last message (should be the assistant's message)
                const lastMessage = currentConversation[currentConversation.length - 1];

                // Only process if the last message is from the assistant and has content array
                if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
                  // Find the tool call content part that this result belongs to
                  const updatedContent = lastMessage.content.map(part => {
                    if (typeof part === 'object' && part.type === 'tool-call' && part.toolCallId === value.toolCallId) {
                      return {
                        ...part,
                        result: value.result,
                      };
                    }
                    return part;
                  });

                  // Create a new message with the updated content
                  const updatedMessage: ThreadMessageLike = {
                    ...lastMessage,
                    content: updatedContent,
                  };
                  // Replace the last message with the updated one
                  return [...currentConversation.slice(0, -1), updatedMessage];
                }
                return currentConversation;
              });
              try {
                const toolName = toolCallIdToName.current[value.toolCallId];
                if (toolName === 'updateWorkingMemory' && value.result?.success) {
                  await refreshWorkingMemory?.();
                }
              } finally {
                // Clean up
                delete toolCallIdToName.current[value.toolCallId];
              }
            },
            onErrorPart(error: any) {
              throw new Error(error);
            },
            onFinishMessagePart({ finishReason }: { finishReason: any }) {
              handleFinishReason(finishReason);
            },
            onReasoningPart(value: any) {
              setLegacyMessages(currentConversation => {
                // Get the last message (should be the assistant's message)
                const lastMessage = currentConversation[currentConversation.length - 1];

                // Only process if the last message is from the assistant
                if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
                  // Find and update the reasoning content type
                  const updatedContent = lastMessage.content.map(part => {
                    if (typeof part === 'object' && part.type === 'reasoning') {
                      return {
                        ...part,
                        text: part.text + value,
                      };
                    }
                    return part;
                  });
                  // Create a new message with the updated reasoning content
                  const updatedMessage: ThreadMessageLike = {
                    ...lastMessage,
                    content: updatedContent,
                  };

                  // Replace the last message with the updated one
                  return [...currentConversation.slice(0, -1), updatedMessage];
                }

                // If there's no assistant message yet, create one
                const newMessage: ThreadMessageLike = {
                  role: 'assistant',
                  content: [
                    {
                      type: 'reasoning',
                      text: value,
                    },
                    { type: 'text', text: content },
                  ],
                };
                return [...currentConversation, newMessage];
              });
            },
          });
        }
        setIsLegacyRunning(false);
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
            setLegacyMessages(prev => markBufferingBadgesAsComplete(prev, result?.record));
            queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
            queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
          })
          .catch(() => {});
      }
    } catch (error: any) {
      console.error('Error occurred in MastraRuntimeProvider', error);
      setIsLegacyRunning(false);

      // Handle cancellation gracefully
      if (error.name === 'AbortError') {
        // Don't add an error message for user-initiated cancellation
        return;
      }

      if (isSupportedModel) {
        setMessages(currentConversation => [
          ...currentConversation,
          { role: 'assistant', parts: [{ type: 'text', text: `${error}` }] } as MastraUIMessage,
        ]);
      } else {
        setLegacyMessages(currentConversation => [
          ...currentConversation,
          { role: 'assistant', content: [{ type: 'text', text: `${error}` }] },
        ]);
      }
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLegacyRunning(false);
      // Reset OM streaming state in case observation was in progress
      resetObservationalMemoryStreamState();
      cancelRun?.();

      // Fire-and-forget: await any in-flight buffering operations, then refresh sidebar
      if (threadId && isOMEnabled) {
        baseClient
          .awaitBufferStatus({ agentId, resourceId: agentId, threadId })
          .then(result => {
            setMessages(prev => markBufferingBadgesAsComplete(prev, result?.record));
            setLegacyMessages(prev => markBufferingBadgesAsComplete(prev, result?.record));
            queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
            queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
          })
          .catch(() => {});
      }
    }
  };

  const { adapters, isReady } = useAdapters(agentId);

  // Build a global index of all OM cycle parts across all messages synchronously.
  // This gives each per-message converter the full picture of a cycle's state even when
  // parts are spread across messages (e.g., buffering-start on msg A, activation on msg B).
  const globalOmParts = useMemo(() => buildGlobalOmPartsByCycleId(messages), [messages]);

  // Convert data-om-* parts to dynamic-tool format BEFORE toAssistantUIMessage
  const vnextmessages = messages.map(msg => {
    const converted = convertOmPartsInMastraMessage(msg, globalOmParts);
    return toAssistantUIMessage(converted);
  });

  const runtime = useExternalStoreRuntime({
    isRunning: isLegacyRunning || isRunningStream,
    messages: isSupportedModel ? vnextmessages : legacyMessages,
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

  if (!isReady) return null;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
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
    </AssistantRuntimeProvider>
  );
}
