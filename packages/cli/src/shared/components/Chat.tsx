import { useState, useCallback } from 'react';

import { Message, ChatProps } from '../types';

import { ChatContainer, ChatForm, ChatMessages } from './ui/chat';
import { MessageInput } from './ui/message-input';
import { MessageList } from './ui/message-list';
import { PromptSuggestions } from './ui/prompt-suggestions';
import { ScrollArea } from './ui/scroll-area';

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
      const response = await fetch('/api/agents/' + agentId + '/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMessage] }),
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
    <ChatContainer className="h-full p-4 lg:px-[10rem] max-w-[1000px] mx-auto">
      <div className="flex flex-col h-full py-4">
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
