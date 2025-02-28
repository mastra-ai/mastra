import React, { useCallback, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';

import { MastraClient } from '@mastra/client-js';

import { ChatContainer, ChatForm, ChatMessages } from './chat-items';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';
import { PromptSuggestions } from './prompt-suggestions';
import { ChatProps, Message } from './types';

export function Chat({ agentId, initialMessages = [], agentName, threadId, memory, buildUrl }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { mutate } = useSWRConfig();
  const { containerRef, handleScroll, handleTouchStart } = useAutoScroll([messages]);

  //TODO: find better way to handle initial messages
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      if (!input.trim() || isLoading) return;

      const userMessage = input;
      setInput('');
      setIsLoading(true);

      const newUserMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: userMessage,
      };

      const newAssistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: '',
      };

      setMessages(prev => [...prev, newUserMessage, newAssistantMessage]);

      const newThreadId = threadId ? threadId : crypto.randomUUID();

      try {
        const client = new MastraClient({
          baseUrl: buildUrl || '',
        });

        const response = await client.getAgent(agentId).stream({
          messages: [userMessage],
          threadId: newThreadId,
          resourceId: agentId,
        });

        if (!response.body) return;

        if (response.status !== 200) {
          const error = await response.json();
          setMessages(prev => [
            ...prev.slice(0, -1),
            {
              ...prev[prev.length - 1],
              content: error.error,
              isError: true,
            },
          ]);
          return;
        }

        await mutate(`${buildUrl}/api/memory/threads?resourceid=${agentId}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessage = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value);
          buffer += chunk;

          if (buffer?.toLocaleLowerCase()?.includes('an error occurred')) {
            setMessages(prev => [
              ...prev.slice(0, -1),
              {
                ...prev[prev.length - 1],
                content: 'An error occurred while processing your request.',
                isError: true,
              },
            ]);
            return;
          }

          const matches = buffer.matchAll(/0:"([^"]*)"/g);
          for (const match of matches) {
            const content = match[1];
            assistantMessage += content;
            setMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], content: assistantMessage }]);
          }
          buffer = '';
        }
      } catch (error) {
        console.error('Error:', error);
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: 'An error occurred while processing your request.',
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, buildUrl, agentId, threadId, mutate],
  );

  const lastMessage = messages.at(-1);
  const isEmpty = messages.length === 0;
  const isTyping = isLoading && lastMessage?.role === 'assistant' && !lastMessage?.content.trim();

  const append = useCallback(
    (message: { role: 'user'; content: string }) => {
      setInput(message.content);
      handleSubmit();
    },
    [handleSubmit],
  );

  const suggestions = ['What capabilities do you have?', 'How can you help me?', 'Tell me about yourself'];

  return (
    <ChatContainer className="relative flex h-full w-full flex-col overflow-y-clip pb-9">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        className="h-full overflow-y-clip bg-transparent pb-[calc(98px+2rem)]"
      >
        <ChatMessages messages={messages}>
          <MessageList messages={messages} isTyping={isTyping} />
        </ChatMessages>
      </div>

      <div className="absolute bottom-8 left-1/2 flex w-full max-w-3xl -translate-x-1/2 flex-col gap-2 bg-[#0f0f0f] pb-3">
        {isEmpty ? (
          <div className="mx-auto max-w-2xl">
            <PromptSuggestions
              memoryIsPresent={memory}
              label={`Chat with ${agentName}`}
              append={append}
              suggestions={suggestions}
            />
          </div>
        ) : null}
        <div>
          <ChatForm isPending={isLoading || isTyping} handleSubmit={handleSubmit}>
            {({ files, setFiles }) => (
              <MessageInput
                value={input}
                onChange={handleInputChange}
                files={files}
                setFiles={setFiles}
                isGenerating={isLoading}
                placeholder={`Enter your message...`}
              />
            )}
          </ChatForm>
        </div>
        {!memory && (
          <div className="text-mastra-el-5 flex items-center gap-1 text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-purple-400"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className="text-xs text-gray-300/60">
              Agent will not remember previous messages. To enable memory for agent see{' '}
              <a
                href="https://mastra.ai/docs/agents/01-agent-memory"
                target="_blank"
                rel="noopener"
                className="text-gray-300/60 underline hover:text-gray-100"
              >
                docs.
              </a>
            </span>
          </div>
        )}
      </div>
    </ChatContainer>
  );
}
