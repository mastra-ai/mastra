// import { Thread } from '@assistant-ui/react';
// TODO: Move to primitive so we can style it
import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';

export const AgentChat = ({ agentId, agentName, threadId, initialMessages, memory, url }: ChatProps) => {
  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      threadId={threadId}
      initialMessages={initialMessages}
      memory={memory}
      url={url}
    >
      <Thread />
    </MastraRuntimeProvider>
  );
};
