import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { usePlaygroundStore } from '@/store/playground-store';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  initialMessages,
  memory,
  refreshThreadList,
  showFileSupport,
}: ChatProps) => {
  const { modelSettings, chatWithGenerate } = useAgentSettings();
  const { runtimeContext } = usePlaygroundStore();
  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      threadId={threadId}
      initialMessages={initialMessages}
      memory={memory}
      refreshThreadList={refreshThreadList}
      modelSettings={modelSettings}
      chatWithGenerate={chatWithGenerate}
      runtimeContext={runtimeContext}
    >
      <Thread agentName={agentName ?? ''} hasMemory={memory} showFileSupport={showFileSupport} />
    </MastraRuntimeProvider>
  );
};
