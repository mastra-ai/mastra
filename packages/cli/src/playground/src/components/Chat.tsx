import { useEffect, useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';

import type { Message, ChatProps } from '../types';

import { ChatContainer, ChatForm, ChatMessages } from './ui/chat';
import { MessageInput } from './ui/message-input';
import { MessageList } from './ui/message-list';
import { PromptSuggestions } from './ui/prompt-suggestions';
import { ScrollArea } from './ui/scroll-area';

export function Chat({ agentId, initialMessages = [], agentName, threadId, memory }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = async (event?: { preventDefault?: () => void }) => {
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

    try {
      const response = await fetch('/api/agents/' + agentId + '/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [userMessage],
          runId: agentId,
          ...(memory ? { threadId, resourceid: agentId } : {}),
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      if (response.status !== 200) {
        const error = await response.json();
        throw new Error(error.message);
      }

      mutate(`/api/memory/threads?resourceid=${agentId}&agentId=${agentId}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessage = '';
      let errorMessage = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          buffer += chunk;

          const matches = buffer.matchAll(/0:"((?:\\.|[^"])*?)"/g);
          const errorMatches = buffer.matchAll(/3:"((?:\\.|[^"])*?)"/g);

          if (errorMatches) {
            for (const match of errorMatches) {
              const content = match[1];
              errorMessage += content;
              setMessages(prev => [
                ...prev.slice(0, -1),
                { ...prev[prev.length - 1], content: errorMessage, isError: true },
              ]);
            }
          }

          for (const match of matches) {
            const content = match[1].replace(/\\"/g, '"');
            assistantMessage += content;
            setMessages(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], content: assistantMessage }]);
          }
          buffer = '';
        }
      } catch (error: any) {
        throw new Error(error.message);
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          ...prev[prev.length - 1],
          content: error?.message || `An error occurred while processing your request.`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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
    <ChatContainer className="h-full px-4 pb-3 pt-4 max-w-[1000px] mx-auto">
      <div className="flex flex-col h-full">
        {isEmpty ? (
          <div className="mx-auto max-w-2xl">
            <PromptSuggestions label={`Chat with ${agentName}`} append={append} suggestions={suggestions} />
          </div>
        ) : (
          <ScrollArea className=" h-[calc(100vh-15rem)] px-4">
            <ChatMessages messages={messages}>
              <MessageList messages={messages} isTyping={isTyping} />
            </ChatMessages>
          </ScrollArea>
        )}
      </div>

      <div className="flex flex-col mt-auto gap-2">
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
        {!memory && (
          <div className="flex items-center gap-1 text-sm text-mastra-el-5">
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
                className="text-gray-300/60 hover:text-gray-100 underline"
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
