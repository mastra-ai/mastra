import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useContext } from 'react';
import { AgentContext } from './context/agent-context';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  initialMessages,
  memory,
  baseUrl,
  refreshThreadList,
}: ChatProps) => {
  const { modelSettings } = useContext(AgentContext);
  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      threadId={threadId}
      initialMessages={initialMessages}
      memory={memory}
      baseUrl={baseUrl}
      refreshThreadList={refreshThreadList}
      modelSettings={modelSettings}
    >
      <Thread memory={memory} />
    </MastraRuntimeProvider>
  );
};
