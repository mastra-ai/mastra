import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';

import { Message, ChatProps } from '../types';

const components: Components = {
  p: ({ children }) => <p className="mb-1 whitespace-pre-wrap">{children}</p>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-6 mb-4">{children}</ol>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-6 mb-4">{children}</ul>,
  li: ({ children }) => <li className="mb-2">{children}</li>,
};

export function Chat({ agentId, initialMessages = [] }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
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

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="relative mx-auto space-y-4 leading-7 max-w-2xl px-4 py-8">
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl px-4">
              <div className="flex items-center gap-2 rounded-lg border p-3 bg-gray-50 mt-2">
                <svg className="w-3 h-3" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.15288 4.98124 7.54738 6.49373 7.98351C5.2997 8.12901 4.27557 8.55134 3.50407 9.31167C2.52216 10.2794 2.02502 11.72 2.02502 13.5999C2.02502 13.8623 2.23769 14.0749 2.50002 14.0749C2.76236 14.0749 2.97502 13.8623 2.97502 13.5999C2.97502 11.8799 3.42786 10.7206 4.17091 9.9883C4.91536 9.25463 6.02674 8.87499 7.49995 8.87499C8.97317 8.87499 10.0846 9.25463 10.8291 9.98831C11.5721 10.7206 12.025 11.8799 12.025 13.5999C12.025 13.8623 12.2376 14.0749 12.5 14.0749C12.7623 14.075 12.975 13.8623 12.975 13.6C12.975 11.72 12.4778 10.2794 11.4959 9.31167C10.7244 8.55135 9.70025 8.12903 8.50625 7.98352C10.0187 7.5474 11.125 6.15289 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM4.825 4.5C4.825 3.02264 6.02264 1.825 7.5 1.825C8.97736 1.825 10.175 3.02264 10.175 4.5C10.175 5.97736 8.97736 7.175 7.5 7.175C6.02264 7.175 4.825 5.97736 4.825 4.5Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <h1 className="font-medium text-sm font-mono">Start conversation with Agent</h1>
              </div>
            </div>
          )}
          {messages.map(message => {
            const isUser = message.role === 'user';
            const hasMessage = message?.content?.length > 0;
            return (
              <div key={message.id}>
                <div
                  className={`flex w-full gap-2 ${hasMessage ? 'items-start' : 'items-center'} ${
                    isUser ? 'max-w-[60%] ml-auto' : ''
                  }`}
                >
                  {!isUser && (
                    <div className="bg-gray-50 flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border shadow-sm mt-1">
                      <svg className="w-3 h-3" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.15288 4.98124 7.54738 6.49373 7.98351C5.2997 8.12901 4.27557 8.55134 3.50407 9.31167C2.52216 10.2794 2.02502 11.72 2.02502 13.5999C2.02502 13.8623 2.23769 14.0749 2.50002 14.0749C2.76236 14.0749 2.97502 13.8623 2.97502 13.5999C2.97502 11.8799 3.42786 10.7206 4.17091 9.9883C4.91536 9.25463 6.02674 8.87499 7.49995 8.87499C8.97317 8.87499 10.0846 9.25463 10.8291 9.98831C11.5721 10.7206 12.025 11.8799 12.025 13.5999C12.025 13.8623 12.2376 14.0749 12.5 14.0749C12.7623 14.075 12.975 13.8623 12.975 13.6C12.975 11.72 12.4778 10.2794 11.4959 9.31167C10.7244 8.55135 9.70025 8.12903 8.50625 7.98352C10.0187 7.5474 11.125 6.15289 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM4.825 4.5C4.825 3.02264 6.02264 1.825 7.5 1.825C8.97736 1.825 10.175 3.02264 10.175 4.5C10.175 5.97736 8.97736 7.175 7.5 7.175C6.02264 7.175 4.825 5.97736 4.825 4.5Z"
                          fill="currentColor"
                          fillRule="evenodd"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </div>
                  )}
                  <div className={`flex-1 text-sm ${isUser ? 'flex justify-end' : ''}`}>
                    {hasMessage ? (
                      <ReactMarkdown
                        className={`whitespace-pre-wrap ${
                          isUser ? 'bg-blue-50 inline-block pt-3 pb-2 px-3 rounded-lg' : ''
                        }`}
                        components={components}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <div className="w-3 h-3 mt-1 animate-pulse bg-gray-400 rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="sticky bottom-0 left-0 bg-white z-10 right-0 p-4 border-t">
        <div className="mx-auto max-w-2xl flex gap-2">
          <input
            className="flex-1 rounded-md border border-gray-200 p-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-500 text-white hover:bg-blue-600 h-10 py-2 px-4"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
