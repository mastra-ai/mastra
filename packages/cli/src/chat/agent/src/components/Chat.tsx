import { useState, useCallback } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { Message, ChatProps } from '../types';

import { ChatContainer, ChatForm, ChatMessages } from './ui/chat';
import { MessageInput } from './ui/message-input';
import { MessageList } from './ui/message-list';
import { PromptSuggestions } from './ui/prompt-suggestions';

export function Chat({ agentId, initialMessages = [] }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      const response = await fetch('/agent/' + agentId + '/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMessage] }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

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
    } finally {
      setIsLoading(false);
    }
  };

  const lastMessage = messages.at(-1);
  const isEmpty = messages.length === 0;
  const isTyping = lastMessage?.role === 'user' || (lastMessage?.role === 'assistant' && !lastMessage?.content.trim());

  const append = useCallback(
    (message: { role: 'user'; content: string }) => {
      setInput(message.content);
      handleSubmit();
    },
    [handleSubmit],
  );

  const suggestions = ['What capabilities do you have?', 'How can you help me?', 'Tell me about yourself'];

  return (
    <ChatContainer className="h-[calc(100vh-50px)] p-4  lg:px-[10rem] max-w-[1000px] mx-auto">
      <div className="flex flex-col h-full py-4">
        <div className="mb-4 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18.0002" cy="18.0002" r="15.2365" stroke="currentColor" strokeWidth="1.25409" />
            <ellipse
              cx="18.0008"
              cy="18"
              rx="15.2365"
              ry="10.2193"
              transform="rotate(45 18.0008 18)"
              stroke="currentColor"
              strokeWidth="1.25409"
            />
            <path d="M11.7793 18.0547H24.3007" stroke="currentColor" strokeWidth="1.25409" />
            <path d="M14.8574 21.2354L21.2192 14.8736" stroke="currentColor" strokeWidth="1.25409" />
            <path d="M21.2207 21.2354L14.8589 14.8736" stroke="currentColor" strokeWidth="1.25409" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.57571 11.2943C4.93105 13.0681 3.39081 15.4508 3.39081 17.9997C3.39081 20.5486 4.93105 22.9313 7.57571 24.7051C10.2163 26.4762 13.9001 27.592 18.0003 27.592C22.1004 27.592 25.7842 26.4762 28.4248 24.7051C31.0695 22.9313 32.6097 20.5486 32.6097 17.9997C32.6097 15.4508 31.0695 13.0681 28.4248 11.2943C25.7842 9.5232 22.1004 8.40741 18.0003 8.40741C13.9001 8.40741 10.2163 9.5232 7.57571 11.2943ZM6.87715 10.2528C9.75106 8.32521 13.6855 7.15332 18.0003 7.15332C22.315 7.15332 26.2495 8.32521 29.1234 10.2528C31.9932 12.1776 33.8638 14.9046 33.8638 17.9997C33.8638 21.0948 31.9932 23.8218 29.1234 25.7466C26.2495 27.6742 22.315 28.8461 18.0003 28.8461C13.6855 28.8461 9.75106 27.6742 6.87715 25.7466C4.00728 23.8218 2.13672 21.0948 2.13672 17.9997C2.13672 14.9046 4.00728 12.1776 6.87715 10.2528Z"
              fill="currentColor"
            />
          </svg>
        </div>
        {isEmpty ? (
          <div className="mx-auto max-w-2xl">
            <PromptSuggestions label={`Chat with ${agentId}`} append={append} suggestions={suggestions} />
          </div>
        ) : (
          <ScrollArea className=" h-[calc(100vh-15rem)] px-4">
            <ChatMessages messages={messages}>
              <MessageList messages={messages} isTyping={isTyping} />
            </ChatMessages>
          </ScrollArea>
        )}
      </div>

      <ChatForm className="mt-auto " isPending={isLoading || isTyping} handleSubmit={handleSubmit}>
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
    </ChatContainer>
  );
}
