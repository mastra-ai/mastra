import React from 'react';
import ReactMarkdown from 'react-markdown';

import Icon from '@/components/icon';

import { cn } from '@/lib/utils';

import { Components } from 'react-markdown/lib/ast-to-react';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export interface ChatListProps {
  messages: Array<Message>;
}

const components: Components = {
  p: ({ children }) => <p className="mb-1">{children}</p>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-6 mb-4">{children}</ol>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-6 mb-4">{children}</ul>,
  li: ({ children }) => <li className="mb-2">{children}</li>,
};

export function ChatList({ messages }: ChatListProps) {
  return (
    <div className="relative mx-auto space-y-4 leading-7 max-w-2xl px-4">
      {messages.map(message => {
        const isUser = message.role === 'user';
        const hasMessage = message?.text?.length > 0;
        return (
          <div key={message.id}>
            <div
              className={cn('flex w-full gap-2', hasMessage ? 'items-start' : 'items-center', {
                'max-w-[60%] ml-auto': isUser,
              })}
            >
              {!isUser ? (
                <div className="bg-mastra-bg-2 flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border shadow-sm mt-1">
                  <Icon name="agent" />
                </div>
              ) : null}

              <div
                className={cn('flex-1 text-sm', {
                  'flex justify-end': isUser,
                })}
              >
                {hasMessage ? (
                  <ReactMarkdown
                    className={cn('whitespace-pre-wrap', {
                      'bg-mastra-bg-4 inline-block pt-3 pb-2 px-3 rounded-lg': isUser,
                    })}
                    components={components}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  <div className="w-3 h-3 mt-1 animate-pulse  bg-white rounded-full"></div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
