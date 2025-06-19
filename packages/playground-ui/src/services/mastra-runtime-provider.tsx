'use client';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
  SimpleImageAttachmentAdapter,
  CompositeAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from '@assistant-ui/react';
import { useState, ReactNode, useEffect } from 'react';
import { RuntimeContext } from '@mastra/core/di';

import { ChatProps } from '@/types';

import { CoreUserMessage } from '@mastra/core';
import { fileToBase64 } from '@/lib/file';
import { useMastraClient } from '@/contexts/mastra-client-context';
import { PDFAttachmentAdapter } from '@/components/assistant-ui/attachment-adapters/pdfs-adapter';
import { MastraUIMessageClient } from './mastra-ui-message-client';
import { isToolUIPart } from 'ai';

// Local implementation of getToolName to avoid pulling in Node.js dependencies
function getToolName(part: any) {
  if (!part.type?.startsWith('tool-')) {
    throw new Error(`Part is not a tool-* UI part ${JSON.stringify(part)}`);
  }
  const [_, ...nameParts] = part.type.split('-');
  return nameParts.join('-');
}

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  return message;
};

const convertToAIAttachments = async (attachments: AppendMessage['attachments']): Promise<Array<CoreUserMessage>> => {
  const promises = attachments
    .filter(attachment => attachment.type === 'image' || attachment.type === 'document')
    .map(async attachment => {
      if (attachment.type === 'document') {
        if (attachment.contentType === 'application/pdf') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'file' as const,
                // @ts-expect-error - TODO: fix this type issue somehow
                data: attachment.content?.[0]?.text || '',
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
            image: await fileToBase64(attachment.file!),
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
  agentName,
  memory,
  threadId,
  refreshThreadList,
  modelSettings = {},
  chatWithGenerate,
  runtimeContext,
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);

  const { frequencyPenalty, presencePenalty, maxRetries, maxSteps, maxTokens, temperature, topK, topP, instructions } =
    modelSettings;

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
          ?.map((message: any) => {
            const toolInvocationsAsContentParts = (message.toolInvocations || []).map((toolInvocation: any) => ({
              type: 'tool-call',
              toolCallId: toolInvocation?.toolCallId,
              toolName: toolInvocation?.toolName,
              args: toolInvocation?.args,
              result: toolInvocation?.result,
            }));

            const attachmentsAsContentParts = (message.experimental_attachments || []).map((image: any) => ({
              type: image.contentType.startsWith(`image/`)
                ? 'image'
                : image.contentType.startsWith(`audio/`)
                  ? 'audio'
                  : 'file',
              mimeType: image.contentType,
              image: image.url,
            }));

            // Handle different content formats from memory
            let contentParts: any[] = [];

            if (message.parts && Array.isArray(message.parts)) {
              // UIMessage format: message has parts array (from our new streaming client)

              // Convert UIMessage parts to ThreadMessageLike content format
              contentParts = message.parts
                .map((part: any) => {
                  if (part.type === 'text') {
                    return { type: 'text', text: (part as any).text };
                  } else if (part.type === 'reasoning') {
                    return { type: 'text', text: `[Reasoning: ${(part as any).text}]` };
                  } else if (isToolUIPart(part)) {
                    // Handle tool parts using AI SDK utilities
                    const toolName = getToolName(part);
                    return {
                      type: 'tool-call',
                      toolCallId: (part as any).toolCallId,
                      toolName: toolName,
                      args: (part as any).input,
                      result: (part as any).output,
                    };
                  } else if (part.type === 'file') {
                    return { type: 'text', text: `[File: ${(part as any).filename || 'Unknown'}]` };
                  } else if (part.type === 'source-url' || part.type === 'source-document') {
                    return { type: 'text', text: `[Source: ${(part as any).title || (part as any).url || 'Unknown'}]` };
                  } else if (part.type === 'step-start') {
                    // Skip step boundaries - they're just markers
                    return null;
                  } else {
                    // For any unhandled part types, convert to text representation
                    return { type: 'text', text: `[${part.type}]` };
                  }
                })
                .filter(Boolean);
            } else if (typeof message.content === 'string') {
              // Legacy format: content is a string
              contentParts.push({ type: 'text', text: message.content });
            } else if (Array.isArray(message.content)) {
              // Array format: content is already an array of parts
              contentParts = [...message.content];
            } else if (message.content && typeof message.content === 'object') {
              // Handle other object formats
              contentParts.push(message.content);
            }

            const finalContent = [...contentParts, ...toolInvocationsAsContentParts, ...attachmentsAsContentParts];

            return {
              ...message,
              content: finalContent,
            };
          })
          .filter(Boolean);
        setMessages(convertedMessages);
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory]);

  const mastra = useMastraClient();

  const agent = mastra.getAgent(agentId);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const attachments = await convertToAIAttachments(message.attachments);

    const input = message.content[0].text;
    setMessages(currentConversation => [
      ...currentConversation,
      { role: 'user', content: input, attachments: message.attachments },
    ]);
    setIsRunning(true);

    try {
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
          maxOutputTokens: maxTokens,
          temperature,
          topK,
          topP,
          instructions,
          runtimeContext: runtimeContextInstance,
          ...(memory ? { threadId, resourceId: agentId } : {}),
        });
        if (generateResponse.response) {
          const latestMessage = generateResponse.response.messages.reduce(
            (acc, message) => {
              const _content = Array.isArray(acc.content) ? acc.content : [];
              if (typeof message.content === 'string') {
                return {
                  ...acc,
                  content: [
                    ..._content,
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
                    content: containsToolCall ? newContent : [..._content, toolCallContent],
                  } as ThreadMessageLike;
                }

                const textContent = Array.isArray(message.content)
                  ? message.content.find(content => content.type === 'text' && content.text)
                  : undefined;

                if (textContent) {
                  return {
                    ...acc,
                    content: [..._content, textContent],
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
                      return { ...c, result: toolResult.output };
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
                          { type: 'tool-result', toolCallId: toolResult.toolCallId, result: toolResult.output },
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
          maxOutputTokens: maxTokens,
          temperature,
          topK,
          topP,
          instructions,
          runtimeContext: runtimeContextInstance,
          ...(memory ? { threadId, resourceId: agentId } : {}),
        });

        if (!response.body) {
          throw new Error('No response body');
        }

        // Track whether we've added the assistant message yet
        let assistantMessageAdded = false;

        // Create the streaming client with callbacks to update React state
        const streamingClient = new MastraUIMessageClient({
          onTextPart: () => {
            // Text updates are handled by onMessageUpdate
          },
          onToolCall: () => {
            // Tool calls are handled by onMessageUpdate
          },
          onToolResult: () => {
            // Tool results are handled by onMessageUpdate
          },
          onReasoning: () => {
            // Reasoning updates are handled by onMessageUpdate
          },
          onMessageUpdate: uiMessage => {
            // Convert UIMessage to ThreadMessageLike and update React state
            const contentParts: any[] = [];

            uiMessage.parts.forEach(part => {
              if (part.type === 'text') {
                contentParts.push({ type: 'text', text: (part as any).text });
              } else if (part.type === 'reasoning') {
                contentParts.push({ type: 'text', text: `[Reasoning: ${(part as any).text}]` });
              } else if (isToolUIPart(part)) {
                // Handle tool parts using AI SDK utilities
                const toolName = getToolName(part);
                contentParts.push({
                  type: 'tool-call',
                  toolCallId: (part as any).toolCallId,
                  toolName: toolName,
                  args: (part as any).input,
                  result: (part as any).output,
                });
              } else if (part.type === 'file') {
                contentParts.push({ type: 'text', text: `[File: ${(part as any).filename || 'Unknown'}]` });
              } else if (part.type === 'source-url' || part.type === 'source-document') {
                contentParts.push({
                  type: 'text',
                  text: `[Source: ${(part as any).title || (part as any).url || 'Unknown'}]`,
                });
              } else if (part.type === 'step-start') {
                // Skip step boundaries - they're just markers
                // Don't add anything to contentParts
              }
              // For any other part types, just ignore them
            });

            const threadMessage: ThreadMessageLike = {
              id: uiMessage.id,
              role: uiMessage.role as 'assistant',
              content: contentParts,
            };

            setMessages(currentConversation => {
              if (!assistantMessageAdded) {
                assistantMessageAdded = true;
                return [...currentConversation, threadMessage];
              }
              // Replace the last message (which should be the assistant message)
              return [...currentConversation.slice(0, -1), threadMessage];
            });
          },
          onError: error => {
            console.error('Stream error:', error);
          },
          onComplete: finalMessage => {
            // Final message update is already handled by onMessageUpdate
            console.log('Stream completed:', finalMessage);
          },
        });

        // Process the stream using the new client
        await streamingClient.processStream(response);
      }

      setIsRunning(false);
      setTimeout(() => {
        refreshThreadList?.();
      }, 500);
    } catch (error) {
      console.error('Error occurred in MastraRuntimeProvider', error);
      setIsRunning(false);
      setMessages(currentConversation => [
        ...currentConversation,
        { role: 'assistant', content: [{ type: 'text', text: `Error: ${error}` as string }] },
      ]);
    }
  };

  const runtime = useExternalStoreRuntime<any>({
    isRunning,
    messages,
    convertMessage,
    onNew,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new PDFAttachmentAdapter(),
      ]),
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
