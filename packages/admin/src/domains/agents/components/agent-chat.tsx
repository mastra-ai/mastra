'use client';

import { useState } from 'react';

import Icon from '@/components/icon';

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
  return (
    <div>
      {messages.length ? (
        <div className="pt-8">
          <ChatList messages={messages} />
        </div>
      ) : (
        <EmptyScreen agentName={agentName} />
      )}
      <div className="absolute w-full sm:max-w-2xl bottom-0 left-1/4">
        <AgentChatForm input={input} setInput={setInput} setMessages={setMessages} />
      </div>
    </div>
  );
};
