'use client';

import { useState } from 'react';

import Icon from '@/components/icon';
import { ScrollArea } from '@/components/ui/scroll-area';

import { AgentChatForm } from './agent-chat-form';
import { ChatList, Message } from './chat-list';

export function EmptyScreen({ agentName }: { agentName: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex items-center gap-2 rounded-lg border p-3 bg-mastra-bg-2 mt-2">
        <Icon name="agent" className="w-3 h-3" />
        <h1 className="font-medium text-sm font-mono ">Start conversation with {agentName}</h1>
      </div>
    </div>
  );
}

export const AgentChat = ({ agentName }: { agentName: string }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<Message>>([]);
  const [threadId, setThreadId] = useState('');
  return (
    <div className="flex flex-col h-[calc(100vh-50px)]">
      <ScrollArea className="flex-grow overflow-y-auto">
        {messages.length > 0 ? (
          <div className="pt-8 pb-2">
            <ChatList messages={messages} />
          </div>
        ) : (
          <EmptyScreen agentName={agentName} />
        )}
      </ScrollArea>
      <div className="sticky bottom-0 left-0 bg-mastra-bg-2 z-10 right-0 p-4 border-t">
        <div className="mx-auto max-w-2xl">
          <AgentChatForm
            input={input}
            setInput={setInput}
            setMessages={setMessages}
            threadId={threadId}
            setThreadId={setThreadId}
          />
        </div>
      </div>
    </div>
  );
};
