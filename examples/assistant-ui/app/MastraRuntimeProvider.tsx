'use client';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { useState, ReactNode } from 'react';

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  if (typeof message.content === 'string') {
    return {
      role: message.role,
      content: [{ type: 'text', text: message.content }],
    };
  }
  return message;
};

export function MastraRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  console.log('MastraRuntimeProvider');
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);

    setIsRunning(true);
    console.log('isRunning', isRunning);

    const response = await fetch(`${process.env.NEXT_PUBLIC_MASTRA_API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ ...message }] }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let currentToolCall: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Check for tool calls
        const toolCalls = chunk.match(/9:{"toolCallId":"[^"]+","toolName":"([^"]+)"/);
        if (toolCalls && toolCalls[1]) {
          currentToolCall = toolCalls[1];
          // Show temporary tool status message
          const statusMessage = {
            role: 'assistant',
            content: [{ type: 'text', text: `${accumulatedText}\n\n🔍 Using ${currentToolCall}...` }],
          } as ThreadMessageLike;

          setMessages(currentConversation => {
            if (
              currentConversation.length > 0 &&
              currentConversation[currentConversation.length - 1].role === 'assistant'
            ) {
              return [...currentConversation.slice(0, -1), statusMessage];
            }
            return [...currentConversation, statusMessage];
          });
        }

        // Extract only the text chunks (prefixed with "0:")
        const textChunks = chunk.match(/0:"([^"]*)"/g) || [];
        const extractedText = textChunks
          .map(chunk => chunk.slice(3, -1)) // Remove 0:" and " from each chunk
          .join('')
          .replace(/\\n/g, '\n'); // Convert literal \n to actual newlines

        if (extractedText) {
          accumulatedText += extractedText;

          const assistantMessage = {
            role: 'assistant',
            content: [{ type: 'text', text: accumulatedText }],
          } as ThreadMessageLike;

          setMessages(currentConversation => {
            if (
              currentConversation.length > 0 &&
              currentConversation[currentConversation.length - 1].role === 'assistant'
            ) {
              return [...currentConversation.slice(0, -1), assistantMessage];
            }
            return [...currentConversation, assistantMessage];
          });
          currentToolCall = null; // Reset tool call after we get text response
        }
      }
    } finally {
      reader.releaseLock();
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
