import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useContext } from 'react';
import { AgentContext } from './context/agent-context';
import { usePlaygroundStore } from '@/store/playground-store';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  initialMessages,
  memory,
  baseUrl,
  refreshThreadList,
}: ChatProps) => {
  const { modelSettings, chatWithGenerate } = useContext(AgentContext);
  const { runtimeContext } = usePlaygroundStore();
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
      chatWithGenerate={chatWithGenerate}
      runtimeContext={runtimeContext}
    >
      <div className="h-full pb-4 bg-surface1">
        <Thread agentName={agentName ?? ''} />
      </div>
    </MastraRuntimeProvider>
  );
};
