'use client';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { useState, ReactNode, useEffect, useRef } from 'react';
import { RuntimeContext } from '@mastra/core/di';
import { ChatProps, Message } from '@/types';
import { CoreUserMessage } from '@mastra/core/llm';
import { fileToBase64 } from '@/lib/file/toBase64';
import { useMastraClient } from '@/contexts/mastra-client-context';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { MastraClient } from '@mastra/client-js';
import { useAdapters } from '@/components/assistant-ui/hooks/use-adapters';
import { MastraModelOutput } from '@mastra/core/stream';

import { handleNetworkMessageFromMemory } from './agent-network-message';
import {
  createRootToolAssistantMessage,
  handleAgentChunk,
  handleStreamChunk,
  handleWorkflowChunk,
} from './stream-chunk-message';

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  return message;
};

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

export function MastraRuntimeProvider({
  children,
  agentId,
  initialMessages,
  memory,
  threadId,
  refreshThreadList,
  settings,
  runtimeContext,
  modelVersion,
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);
  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    frequencyPenalty,
    presencePenalty,
    maxRetries,
    maxSteps,
    maxTokens,
    temperature,
    topK,
    topP,
    instructions,
    chatWithGenerate,
    chatWithGenerateVNext,
    chatWithNetwork,
    providerOptions,
  } = settings?.modelSettings ?? {};
  const toolCallIdToName = useRef<Record<string, string>>({});

  const runtimeContextInstance = new RuntimeContext();
  Object.entries(runtimeContext ?? {}).forEach(([key, value]) => {
    runtimeContextInstance.set(key, value);
  });

  useEffect(() => {
    const hasNewInitialMessages = initialMessages && initialMessages?.length > messages?.length;
    if (
      messages.length === 0 ||
      currentThreadId !== threadId ||
      (hasNewInitialMessages && currentThreadId === threadId)
    ) {
      if (initialMessages && threadId && memory) {
        const convertedMessages: ThreadMessageLike[] = initialMessages
          ?.map((message: Message) => {
            let content;
            try {
              content = JSON.parse(message.content);
              if (content.isNetwork) {
                return handleNetworkMessageFromMemory(content);
              }
            } catch (e) {}

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
              .map(part => {
                if (part.type === 'reasoning') {
                  return {
                    type: 'reasoning',
                    text:
                      part.reasoning ||
                      part?.details
                        ?.filter(detail => detail.type === 'text')
                        ?.map(detail => detail.text)
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
              })
              .filter(Boolean);

            return {
              ...message,
              content: [...formattedParts, ...attachmentsAsContentParts],
            } as ThreadMessageLike;
          })
          .filter(Boolean);
        setMessages(convertedMessages);
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory]);

  const baseClient = useMastraClient();

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const attachments = await convertToAIAttachments(message.attachments);

    const input = message.content[0].text;
    setMessages(currentConversation => [
      ...currentConversation,
      { role: 'user', content: input, attachments: message.attachments },
    ]);
    setIsRunning(true);

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
      function handleGenerateResponse(generatedResponse: Awaited<ReturnType<MastraModelOutput['getFullOutput']>>) {
        if (generatedResponse.response && 'messages' in generatedResponse.response) {
          const latestMessage = generatedResponse.response.messages.reduce(
            (acc: ThreadMessageLike, message: any) => {
              const _content = Array.isArray(acc.content) ? acc.content : [];

              if (typeof message.content === 'string') {
                return {
                  ...acc,
                  content: [
                    ..._content,
                    ...(generatedResponse.reasoning ? [{ type: 'reasoning', text: generatedResponse.reasoning }] : []),
                    {
                      type: 'text',
                      text: message.content,
                    },
                  ],
                } as ThreadMessageLike;
              }

              if (message.role === 'assistant') {
                const toolCallContent = Array.isArray(message.content)
                  ? message.content.find((content: any) => content.type === 'tool-call')
                  : undefined;

                const reasoningContent = Array.isArray(message.content)
                  ? message.content.find((content: any) => content.type === 'reasoning')
                  : undefined;

                if (toolCallContent) {
                  const newContent = message.content.map((c: any) => {
                    if (c.type === 'tool-call' && c.toolCallId === toolCallContent?.toolCallId) {
                      return {
                        ...c,
                        toolCallId: toolCallContent.toolCallId,
                        toolName: toolCallContent.toolName,
                        args: toolCallContent.input,
                      };
                    }
                    return c;
                  });

                  const containsToolCall = newContent.some((c: any) => c.type === 'tool-call');

                  return {
                    ...acc,
                    content: containsToolCall
                      ? [...(reasoningContent ? [reasoningContent] : []), ...newContent]
                      : [..._content, ...(reasoningContent ? [reasoningContent] : []), toolCallContent],
                  } as ThreadMessageLike;
                }

                const textContent = Array.isArray(message.content)
                  ? message.content.find((content: any) => content.type === 'text' && content.text)
                  : undefined;

                if (textContent) {
                  return {
                    ...acc,
                    content: [..._content, ...(reasoningContent ? [reasoningContent] : []), textContent],
                  } as ThreadMessageLike;
                }
              }

              if (message.role === 'tool') {
                const toolResult = Array.isArray(message.content)
                  ? message.content.find((content: any) => content.type === 'tool-result')
                  : undefined;

                if (toolResult) {
                  const newContent = _content.map(c => {
                    if (c.type === 'tool-call' && c.toolCallId === toolResult?.toolCallId) {
                      return { ...c, result: toolResult.output?.value };
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
                          { type: 'tool-result', toolCallId: toolResult.toolCallId, result: toolResult.output?.value },
                        ],
                  } as ThreadMessageLike;
                }

                return {
                  ...acc,
                  content: [..._content, toolResult],
                } as ThreadMessageLike;
              }
              return acc;
            },
            { role: 'assistant', content: [] } as ThreadMessageLike,
          );

          setMessages(currentConversation => [...currentConversation, latestMessage]);

          if (generatedResponse.finishReason) {
            handleFinishReason(generatedResponse.finishReason);
          }
        }
      }

      if (modelVersion === 'v2') {
        if (chatWithNetwork) {
          const response = await agent.network({
            messages: [
              {
                role: 'user',
                content: input,
              },
            ],
            maxSteps,
            modelSettings: {
              frequencyPenalty,
              presencePenalty,
              maxRetries,
              maxOutputTokens: maxTokens,
              temperature,
              topK,
              topP,
            },

            runId: agentId,

            runtimeContext: runtimeContextInstance,

            ...(memory ? { thread: threadId, resourceId: agentId } : {}),
          });

          const _sideEffects = {
            assistantMessageAdded: false,
            assistantToolCallAddedForUpdater: false,
            assistantToolCallAddedForContent: false,
            content: '',
            toolCallIdToName: toolCallIdToName,
          };

          let currentEntityId: string | undefined;

          await response.processDataStream({
            onChunk: async chunk => {
              if (chunk.type.startsWith('agent-execution-event-')) {
                const agentChunk = chunk.payload;
                if (!currentEntityId) return;
                await handleAgentChunk({ agentChunk, setMessages, entityName: currentEntityId });
              } else if (chunk.type === 'tool-execution-start') {
                await handleStreamChunk({
                  chunk: {
                    ...chunk,
                    type: 'tool-call',
                    payload: {
                      ...chunk?.payload,
                      toolCallId: chunk?.payload?.args?.toolCallId,
                      toolName: chunk?.payload?.args?.toolName,
                      args: {
                        ...chunk?.payload?.args?.args,
                        __mastraMetadata: {
                          ...chunk?.payload?.args?.__mastraMetadata,
                          networkMetadata: {
                            selectionReason: chunk?.payload?.args?.selectionReason || '',
                            input: chunk?.payload?.args?.args,
                          },
                        },
                      },
                    },
                  },
                  setMessages,
                  refreshWorkingMemory,
                  _sideEffects,
                });
              } else if (chunk.type === 'tool-execution-end') {
                await handleStreamChunk({
                  chunk: { ...chunk, type: 'tool-result' },
                  setMessages,
                  refreshWorkingMemory,
                  _sideEffects,
                });
              } else if (chunk.type.startsWith('workflow-execution-event-')) {
                const workflowChunk = chunk.payload;
                if (!currentEntityId) return;
                await handleWorkflowChunk({ workflowChunk, setMessages, entityName: currentEntityId });
              } else if (chunk.type === 'workflow-execution-start' || chunk.type === 'agent-execution-start') {
                currentEntityId = chunk.payload?.args?.resourceId;

                const runId = chunk.payload.runId;

                if (!currentEntityId || !runId) return;

                createRootToolAssistantMessage({
                  entityName: currentEntityId,
                  setMessages,
                  runId,
                  _sideEffects,
                  chunk,
                  from: chunk.type === 'agent-execution-start' ? 'AGENT' : 'WORKFLOW',
                  networkMetadata: {
                    selectionReason: chunk?.payload?.args?.selectionReason || '',
                    input: chunk?.payload?.args?.prompt,
                  },
                });

                _sideEffects.toolCallIdToName.current[runId] = currentEntityId;
              } else if (chunk.type === 'network-execution-event-step-finish') {
                setMessages(currentConversation => {
                  return [
                    ...currentConversation,
                    { role: 'assistant', content: [{ type: 'text', text: chunk?.payload?.result || '' }] },
                  ];
                });
              } else {
                await handleStreamChunk({ chunk, setMessages, refreshWorkingMemory, _sideEffects });
              }
            },
          });
        } else {
          if (chatWithGenerateVNext) {
            const response = await agent.generateVNext({
              messages: [
                {
                  role: 'user',
                  content: input,
                },
                ...attachments,
              ],
              runId: agentId,
              modelSettings: {
                frequencyPenalty,
                presencePenalty,
                maxRetries,
                temperature,
                topK,
                topP,
                maxOutputTokens: maxTokens,
              },
              providerOptions: providerOptions as any,
              instructions,
              runtimeContext: runtimeContextInstance,
              ...(memory ? { threadId, resourceId: agentId } : {}),
            });

            handleGenerateResponse(response);
            setIsRunning(false);
            return;
          } else {
            const response = await agent.streamVNext({
              messages: [
                {
                  role: 'user',
                  content: input,
                },
                ...attachments,
              ],
              runId: agentId,
              modelSettings: {
                frequencyPenalty,
                presencePenalty,
                maxRetries,
                maxOutputTokens: maxTokens,
                temperature,
                topK,
                topP,
              },
              instructions,
              runtimeContext: runtimeContextInstance,
              ...(memory ? { threadId, resourceId: agentId } : {}),
              providerOptions: providerOptions as any,
            });

            if (!response.body) {
              throw new Error('No response body');
            }

            const _sideEffects = {
              assistantMessageAdded: false,
              assistantToolCallAddedForUpdater: false,
              assistantToolCallAddedForContent: false,
              content: '',
              toolCallIdToName: toolCallIdToName,
            };

            await response.processDataStream({
              onChunk: async chunk => {
                await handleStreamChunk({ chunk, setMessages, refreshWorkingMemory, _sideEffects });
              },
            });

            setIsRunning(false);
            return;
          }
        }
      } else {
        if (chatWithGenerate) {
          const generateResponse = await agent.generate({
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
            instructions,
            runtimeContext: runtimeContextInstance,
            ...(memory ? { threadId, resourceId: agentId } : {}),
            providerOptions: providerOptions as any,
          });
          if (generateResponse.response && 'messages' in generateResponse.response) {
            const latestMessage = generateResponse.response.messages.reduce(
              (acc, message) => {
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
                  } as ThreadMessageLike;
                }
                if (message.role === 'assistant') {
                  const toolCallContent = Array.isArray(message.content)
                    ? message.content.find(content => content.type === 'tool-call')
                    : undefined;
                  const reasoningContent = Array.isArray(message.content)
                    ? message.content.find(content => content.type === 'reasoning')
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
                    } as ThreadMessageLike;
                  }

                  const textContent = Array.isArray(message.content)
                    ? message.content.find(content => content.type === 'text' && content.text)
                    : undefined;

                  if (textContent) {
                    return {
                      ...acc,
                      content: [..._content, ...(reasoningContent ? [reasoningContent] : []), textContent],
                    } as ThreadMessageLike;
                  }
                }

                if (message.role === 'tool') {
                  const toolResult = Array.isArray(message.content)
                    ? message.content.find(content => content.type === 'tool-result')
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
                    } as ThreadMessageLike;
                  }

                  return {
                    ...acc,
                    content: [..._content, toolResult],
                  } as ThreadMessageLike;
                }
                return acc;
              },
              { role: 'assistant', content: [] } as ThreadMessageLike,
            );
            setMessages(currentConversation => [...currentConversation, latestMessage]);
            handleFinishReason(generateResponse.finishReason);
          }
        } else {
          const response = await agent.stream({
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
            instructions,
            runtimeContext: runtimeContextInstance,
            ...(memory ? { threadId, resourceId: agentId } : {}),
            providerOptions: providerOptions as any,
          });

          if (!response.body) {
            throw new Error('No response body');
          }

          let content = '';
          let assistantMessageAdded = false;
          let assistantToolCallAddedForUpdater = false;
          let assistantToolCallAddedForContent = false;

          function updater() {
            setMessages(currentConversation => {
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
            onTextPart(value) {
              if (assistantToolCallAddedForContent) {
                // start new content value to add as next message item in messages array
                assistantToolCallAddedForContent = false;
                content = value;
              } else {
                content += value;
              }
              updater();
            },
            async onToolCallPart(value) {
              // Update the messages state
              setMessages(currentConversation => {
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
              setMessages(currentConversation => {
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
            onErrorPart(error) {
              throw new Error(error);
            },
            onFinishMessagePart({ finishReason }) {
              handleFinishReason(finishReason);
            },
            onReasoningPart(value) {
              setMessages(currentConversation => {
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
      }

      setIsRunning(false);
      setTimeout(() => {
        refreshThreadList?.();
      }, 500);
    } catch (error: any) {
      console.error('Error occurred in MastraRuntimeProvider', error);
      setIsRunning(false);

      // Handle cancellation gracefully
      if (error.name === 'AbortError') {
        // Don't add an error message for user-initiated cancellation
        return;
      }

      setMessages(currentConversation => [
        ...currentConversation,
        { role: 'assistant', content: [{ type: 'text', text: `${error}` as string }] },
      ]);
    } finally {
      // Clean up the abort controller reference
      abortControllerRef.current = null;
    }
  };

  const onCancel = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  const { adapters, isReady } = useAdapters(agentId);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    onCancel,
    adapters: isReady ? adapters : undefined,
  });

  if (!isReady) return null;

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
