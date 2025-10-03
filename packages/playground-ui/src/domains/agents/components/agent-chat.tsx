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
  initialLegacyMessages,
  memory,
  refreshThreadList,
  modelVersion,
  modelList,
}: ChatProps) => {
  const { settings } = useAgentSettings();
  const { runtimeContext } = usePlaygroundStore();

  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
      threadId={threadId}
      initialMessages={initialMessages}
      initialLegacyMessages={initialLegacyMessages}
      memory={memory}
      refreshThreadList={refreshThreadList}
      settings={settings}
      runtimeContext={runtimeContext}
    >
      <Thread agentName={agentName ?? ''} hasMemory={memory} agentId={agentId} hasModelList={Boolean(modelList)} />
    </MastraRuntimeProvider>
  );
};
