import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';

export const AgentChat = ({ agentId, agentName, threadId, initialMessages, memory, baseUrl }: ChatProps) => {
  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      threadId={threadId}
      initialMessages={initialMessages}
      memory={memory}
      baseUrl={baseUrl}
    >
      <Thread />
    </MastraRuntimeProvider>
  );
};
