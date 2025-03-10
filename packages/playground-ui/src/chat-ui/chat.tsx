import React, { useCallback } from 'react';

import { MastraClient } from '@mastra/client-js';

import { BaseChat } from './chat-base';
import { ChatProps } from './types';

export function Chat({ agentId, initialMessages = [], agentName, threadId, memory, buildUrl }: ChatProps) {
  const handleSubmit = useCallback(
    async (params: { messages: { content: string; role: 'user' }[]; threadId: string; resourceId: string }) => {
      const client = new MastraClient({
        baseUrl: buildUrl || '',
      });

      return client.getAgent(agentId).stream(params);
    },
    [buildUrl],
  );

  return (
    <BaseChat
      resourceId={agentId}
      initialMessages={initialMessages}
      resourceName={agentName}
      threadId={threadId}
      memory={memory}
      buildUrl={buildUrl}
      onSubmit={handleSubmit}
    />
  );
}
