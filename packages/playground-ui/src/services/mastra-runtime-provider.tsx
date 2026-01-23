import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { useState, ReactNode, useRef } from 'react';
import { RequestContext } from '@mastra/core/di';
import { ChatProps, Message } from '@/types';
import { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64 } from '@/lib/file/toBase64';
import { toAssistantUIMessage, useMastraClient } from '@mastra/react';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { MastraClient, UIMessageWithMetadata } from '@mastra/client-js';
import { useAdapters } from '@/lib/ai-ui/hooks/use-adapters';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { ModelSettings, MastraUIMessage, useChat } from '@mastra/react';
import { ToolCallProvider } from './tool-call-provider';
import { useAgentPromptExperiment, useObservationalMemoryContext } from '@/domains/agents/context';
import { useQueryClient } from '@tanstack/react-query';

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

/**
 * Combines data-om-* parts in a message into single tool calls by cycleId.
 * - start marker creates a tool call in 'input-available' (loading) state
 * - end/failed marker with same cycleId updates it to 'output-available' (complete) state
 * If both start and end exist for the same cycleId, only the final state is kept.
 * The tool call is placed at the position of the START marker to preserve order.
 * 
 * Note: cycleId is unique per observation cycle, while recordId is constant for the entire
 * memory record. Using cycleId ensures each observation cycle gets its own UI element.
 */
const convertOmPartsInMastraMessage = (message: MastraUIMessage): MastraUIMessage => {
  if (!message || !Array.isArray(message.parts)) {
    return message;
  }

  // First pass: collect all OM parts grouped by cycleId
  const omPartsByCycleId = new Map<string, { start?: any; end?: any; failed?: any }>();

  for (const part of message.parts) {
    if (part.type === 'data-om-observation-start') {
      const cycleId = part.data?.cycleId;
      if (cycleId) {
        const existing = omPartsByCycleId.get(cycleId) || {};
        existing.start = part;
        omPartsByCycleId.set(cycleId, existing);
      }
    } else if (part.type === 'data-om-observation-end') {
      const cycleId = part.data?.cycleId;
      if (cycleId) {
        const existing = omPartsByCycleId.get(cycleId) || {};
        existing.end = part;
        omPartsByCycleId.set(cycleId, existing);
      }
    } else if (part.type === 'data-om-observation-failed') {
      const cycleId = part.data?.cycleId;
      if (cycleId) {
        const existing = omPartsByCycleId.get(cycleId) || {};
        existing.failed = part;
        omPartsByCycleId.set(cycleId, existing);
      }
    }
  }

  // Second pass: build new parts array, replacing start markers with merged tool calls
  // and removing end/failed markers (they're merged into the start position)
  const convertedParts: any[] = [];
  const processedCycleIds = new Set<string>();

  for (const part of message.parts) {
    const cycleId = (part as any).data?.cycleId;
    
    if (part.type === 'data-om-observation-start' && cycleId && !processedCycleIds.has(cycleId)) {
      // Replace start marker with merged tool call
      const parts = omPartsByCycleId.get(cycleId)!;
      const startData = parts.start?.data || {};
      const endData = parts.end?.data || {};
      const failedData = parts.failed?.data || {};
      
      const isFailed = !!parts.failed;
      const isComplete = !!parts.end;
      const isLoading = !isFailed && !isComplete;
      
      const mergedData = {
        ...startData,
        ...(isComplete ? endData : {}),
        ...(isFailed ? failedData : {}),
        _state: isFailed ? 'failed' : isComplete ? 'complete' : 'loading',
      };

      convertedParts.push({
        type: 'dynamic-tool',
        toolCallId: `om-observation-${cycleId}`,
        toolName: OM_TOOL_NAME,
        input: mergedData,
        output: isLoading ? undefined : { 
          status: isFailed ? 'failed' : 'complete',
          omData: mergedData,
        },
        state: isLoading ? 'input-available' : 'output-available',
      });
      
      processedCycleIds.add(cycleId);
    } else if (part.type === 'data-om-observation-end' || part.type === 'data-om-observation-failed') {
      // Skip end/failed markers - they're merged into the start position
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
  const { prompt: instructions } = useAgentPromptExperiment();
  const { settings: tracingSettings } = useTracingSettings();
  const [isLegacyRunning, setIsLegacyRunning] = useState(false);
  const [legacyMessages, setLegacyMessages] = useState<ThreadMessageLike[]>(() => {
    return memory ? initializeMessageState(initialLegacyMessages || []) : [];
  });

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
    initializeMessages: () => initialMessages || [],
  });

  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const { setIsObservingFromStream, signalObservationsUpdated } = useObservationalMemoryContext();

  // Helper to signal observation started (from streaming)
  const handleObservationStart = () => {
    setIsObservingFromStream(true);
  };

  // Helper to refresh OM sidebar when observation completes
  const refreshObservationalMemory = () => {
    setIsObservingFromStream(false);
    signalObservationsUpdated();
    // Invalidate both the OM data and status queries to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
    queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
  };

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

  const requestContextInstance = new RequestContext();
  Object.entries(requestContext ?? {}).forEach(([key, value]) => {
    requestContextInstance.set(key, value);
  });

  const modelSettingsArgs = {
    frequencyPenalty,
    presencePenalty,
    maxRetries,
    temperature,
    topK,
    topP,
    seed,
    maxOutputTokens: maxTokens, // AI SDK v5 uses maxOutputTokens
    instructions,
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

              // Signal observation started (for sidebar status)
              if ((chunk as any).type === 'data-om-observation-start') {
                handleObservationStart();
              }

              // Refresh OM sidebar when observation completes (if OM chunks are passed through network mode)
              if ((chunk as any).type === 'data-om-observation-end' || (chunk as any).type === 'data-om-observation-failed') {
                refreshObservationalMemory();
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
                  handleObservationStart();
                }

                // Refresh OM sidebar when observation completes
                if (chunk.type === 'data-om-observation-end' || chunk.type === 'data-om-observation-failed') {
                  refreshObservationalMemory();
                }
              },
              signal: controller.signal,
            });

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
            runId: agentId,
            frequencyPenalty,
            presencePenalty,
            maxRetries,
            maxSteps,
            maxTokens,
            temperature,
            topK,
            topP,
            seed,
            instructions,
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
            runId: agentId,
            frequencyPenalty,
            presencePenalty,
            maxRetries,
            maxSteps,
            maxTokens,
            temperature,
            topK,
            topP,
            seed,
            instructions,
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
    } finally {
      // Clean up the abort controller reference
      abortControllerRef.current = null;
    }
  };

  const onCancel = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLegacyRunning(false);
      cancelRun?.();
    }
  };

  const { adapters, isReady } = useAdapters(agentId);

  // Convert data-om-* parts to dynamic-tool format BEFORE toAssistantUIMessage
  const vnextmessages = messages.map(msg => {
    const converted = convertOmPartsInMastraMessage(msg);
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
