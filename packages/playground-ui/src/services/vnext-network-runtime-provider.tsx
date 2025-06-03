'use client';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { processDataStream } from '@ai-sdk/ui-utils';
import { useState, ReactNode, useEffect } from 'react';

import { ChatProps } from '@/types';
import { useMastraClient } from '@/contexts/mastra-client-context';
import { useVNextNetworkChat } from '@/services/vnext-network-chat-provider';
import { useMessages } from './vnext-message-provider';

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  return message;
};

type VNextMastraNetworkRuntimeProviderProps = Omit<ChatProps, 'agentId'> & { networkId: string };

export function VNextMastraNetworkRuntimeProvider({
  children,
  networkId,
  memory,
  threadId,
  refreshThreadList,
  modelSettings = {},
}: Readonly<{
  children: ReactNode;
}> &
  VNextMastraNetworkRuntimeProviderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const { messages, setMessages } = useMessages();
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);

  const { handleStep, agents } = useVNextNetworkChat();

  // const { frequencyPenalty, presencePenalty, maxRetries, maxSteps, maxTokens, temperature, topK, topP, instructions } =
  //   modelSettings;

  // useEffect(() => {
  //   if (messages.length === 0 || currentThreadId !== threadId) {
  //     if (initialMessages && threadId && memory) {
  //       setMessages(initialMessages);
  //       setCurrentThreadId(threadId);
  //     }
  //   }
  // }, [initialMessages, threadId, memory, messages]);

  const mastra = useMastraClient();

  const network = mastra.getVNextNetwork(networkId);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);
    setIsRunning(true);

    try {
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

      const response = await network.stream(
        {
          message: input,
        },
        record => {
          // if (record.type === 'tool-call') {
          // }
          //save step start
          //tool-delta-call, replaces the step start content
          //step result - saved as new message (text to display)

          //OR
          //stream output in step result

          // setMessages(currentConversation => {
          //   return [
          //     ...currentConversation,
          //     {
          //       role: 'assistant',
          //       content: [
          //         {
          //           type: 'text',
          //           text: JSON.stringify(record),
          //         },
          //       ],
          //     },
          //   ];
          // });
          if ((record as any).type === 'start') {
            setMessages(currentConversation => {
              return [
                ...currentConversation,
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: 'start',
                    },
                  ],
                },
              ];
            });
          } else {
            handleStep(record);
          }
        },
      );

      // if (!response) {
      //   throw new Error('No response');
      // }

      // console.log('response==', response);

      //@ts-ignore
      // for await (const chunk of response.stream) {
      //   console.log('chunk response==', chunk);
      // }

      // const parts = [];
      // let content = '';
      // let currentTextPart: { type: 'text'; text: string } | null = null;

      // let assistantMessageAdded = false;

      // function updater() {
      //   setMessages(currentConversation => {
      //     const message: ThreadMessageLike = {
      //       role: 'assistant',
      //       content: [{ type: 'text', text: content }],
      //     };

      //     if (!assistantMessageAdded) {
      //       assistantMessageAdded = true;
      //       return [...currentConversation, message];
      //     }
      //     return [...currentConversation.slice(0, -1), message];
      //   });
      // }

      // await processDataStream({
      //   //@ts-ignore
      //   stream: response.stream,
      //   onDataPart(value) {
      //     console.log('Data part received:', value);
      //   },
      //   onTextPart(value) {
      //     console.log('Text part received:', value);
      //     if (currentTextPart == null) {
      //       currentTextPart = {
      //         type: 'text',
      //         text: value,
      //       };
      //       parts.push(currentTextPart);
      //     } else {
      //       currentTextPart.text += value;
      //     }
      //     content += value;
      //     updater();
      //   },
      //   // async onToolCallPart(value) {
      //   //   console.log('Tool call received:', value);

      //   //   // Update the messages state
      //   //   setMessages(currentConversation => {
      //   //     // Get the last message (should be the assistant's message)
      //   //     const lastMessage = currentConversation[currentConversation.length - 1];

      //   //     // Only process if the last message is from the assistant
      //   //     if (lastMessage && lastMessage.role === 'assistant') {
      //   //       // Create a new message with the tool call part
      //   //       const updatedMessage: ThreadMessageLike = {
      //   //         ...lastMessage,
      //   //         content: Array.isArray(lastMessage.content)
      //   //           ? [
      //   //               ...lastMessage.content,
      //   //               {
      //   //                 type: 'tool-call',
      //   //                 toolCallId: value.toolCallId,
      //   //                 toolName: value.toolName,
      //   //                 args: value.args,
      //   //               },
      //   //             ]
      //   //           : [
      //   //               ...(typeof lastMessage.content === 'string' ? [{ type: 'text', text: lastMessage.content }] : []),
      //   //               {
      //   //                 type: 'tool-call',
      //   //                 toolCallId: value.toolCallId,
      //   //                 toolName: value.toolName,
      //   //                 args: value.args,
      //   //               },
      //   //             ],
      //   //       };

      //   //       // Replace the last message with the updated one
      //   //       return [...currentConversation.slice(0, -1), updatedMessage];
      //   //     }

      //   //     // If there's no assistant message yet, create one
      //   //     const newMessage: ThreadMessageLike = {
      //   //       role: 'assistant',
      //   //       content: [
      //   //         { type: 'text', text: content },
      //   //         {
      //   //           type: 'tool-call',
      //   //           toolCallId: value.toolCallId,
      //   //           toolName: value.toolName,
      //   //           args: value.args,
      //   //         },
      //   //       ],
      //   //     };
      //   //     return [...currentConversation, newMessage];
      //   //   });
      //   // },
      //   // async onToolResultPart(value: any) {
      //   //   console.log('Tool call result received:', value);

      //   //   // Update the messages state
      //   //   setMessages(currentConversation => {
      //   //     // Get the last message (should be the assistant's message)
      //   //     const lastMessage = currentConversation[currentConversation.length - 1];

      //   //     // Only process if the last message is from the assistant and has content array
      //   //     if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
      //   //       // Find the tool call content part that this result belongs to
      //   //       const updatedContent = lastMessage.content.map(part => {
      //   //         if (typeof part === 'object' && part.type === 'tool-call' && part.toolCallId === value.toolCallId) {
      //   //           return {
      //   //             ...part,
      //   //             result: value.result,
      //   //           };
      //   //         }
      //   //         return part;
      //   //       });

      //   //       // Create a new message with the updated content
      //   //       const updatedMessage: ThreadMessageLike = {
      //   //         ...lastMessage,
      //   //         content: updatedContent,
      //   //       };

      //   //       // Replace the last message with the updated one
      //   //       return [...currentConversation.slice(0, -1), updatedMessage];
      //   //     }

      //   //     return currentConversation;
      //   //   });
      //   // },
      //   onErrorPart(error) {
      //     throw new Error(error);
      //   },
      // });

      console.log(messages);

      setIsRunning(false);
    } catch (error) {
      console.error('Error occured in MastraRuntimeProvider', error);
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
