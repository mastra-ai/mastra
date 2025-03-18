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
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);

  useEffect(() => {
    if (messages.length === 0 || currentThreadId !== threadId) {
      if (initialMessages && threadId && memory) {
        setMessages(initialMessages);
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory, messages]);

  const mastra = new MastraClient({
    baseUrl: baseUrl || '',
  });

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);
    setIsRunning(true);

    try {
      const agent = mastra.getAgent(agentId);
      const response = await agent.stream({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
        runId: agentId,
        ...(memory ? { threadId, resourceId: agentId } : {}),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let assistantMessage = '';
      let assistantMessageAdded = false;
      let errorMessage = '';

      if (!reader) {
        throw new Error('No reader found');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          buffer += chunk;
          const matches = buffer.matchAll(/0:"((?:\\.|(?!").)*?)"/g);
          const errorMatches = buffer.matchAll(/3:"((?:\\.|(?!").)*?)"/g);

          if (errorMatches) {
            for (const match of errorMatches) {
              const content = match[1];
              errorMessage += content;
              setMessages(currentConversation => [
                ...currentConversation.slice(0, -1),
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: errorMessage }],
                  isError: true,
                },
              ]);
            }
          }

          for (const match of matches) {
            const content = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
            assistantMessage += content;
            setMessages(currentConversation => {
              const message: ThreadMessageLike = {
                role: 'assistant',
                content: [{ type: 'text', text: assistantMessage }],
              };

              if (!assistantMessageAdded) {
                assistantMessageAdded = true;
                return [...currentConversation, message];
              }
              return [...currentConversation.slice(0, -1), message];
            });
          }
          buffer = '';
        }
      } finally {
        reader.releaseLock();
        setIsRunning(false);
        refreshThreadList?.();
      }
    } catch (error) {
      console.error('Error occurred in MastraRuntimeProvider', error);
      setIsRunning(false);
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
