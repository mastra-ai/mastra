'use client';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { MastraClient } from '@mastra/client-js';
import { useState, ReactNode, useEffect, useMemo, useCallback } from 'react';

import { ChatProps } from '@/types';

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  return message;
};

export function MastraRuntimeProvider({
  children,
  agentId,
  initialMessages,
  agentName,
  memory,
  threadId,
  baseUrl,
  refreshThreadList,
  modelSettings = {},
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);

  const { frequencyPenalty, presencePenalty, maxRetries, maxSteps, maxTokens, temperature, topK, topP, instructions } =
    modelSettings;

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
            if (message?.toolInvocations?.length > 0) {
              return {
                ...message,
                content: message.toolInvocations.map((toolInvocation: any) => ({
                  type: 'tool-call',
                  toolCallId: toolInvocation?.toolCallId,
                  toolName: toolInvocation?.toolName,
                  args: toolInvocation?.args,
                  result: toolInvocation?.result,
                })),
              };
            }
            return message;
          })
          .filter(Boolean);
        setMessages(convertedMessages);
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory]);

  const mastra = new MastraClient({
    baseUrl: baseUrl || '',
  });
  const agent = mastra.getAgent(agentId);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);
    setIsRunning(true);

    try {
      const response = await agent.stream({
        messages: [
          {
            role: 'user',
            content: input,
          },
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
        ...(memory ? { threadId, resourceId: agentId } : {}),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const parts = [];
      let content = '';
      let currentTextPart: { type: 'text'; text: string } | null = null;

      let assistantMessageAdded = false;

      function updater() {
        setMessages(currentConversation => {
          const message: ThreadMessageLike = {
            role: 'assistant',
            content: [{ type: 'text', text: content }],
          };

          if (!assistantMessageAdded) {
            assistantMessageAdded = true;
            return [...currentConversation, message];
          }
          return [...currentConversation.slice(0, -1), message];
        });
      }

      await response.processDataStream({
        onTextPart(value) {
          if (currentTextPart == null) {
            currentTextPart = {
              type: 'text',
              text: value,
            };
            parts.push(currentTextPart);
          } else {
            currentTextPart.text += value;
          }
          content += value;
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
                      ...(typeof lastMessage.content === 'string' ? [{ type: 'text', text: lastMessage.content }] : []),
                      {
                        type: 'tool-call',
                        toolCallId: value.toolCallId,
                        toolName: value.toolName,
                        args: value.args,
                      },
                    ],
              };

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
            return [...currentConversation, newMessage];
          });
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
        },
        onErrorPart(error) {
          throw new Error(error);
        },
      });

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
  });

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
