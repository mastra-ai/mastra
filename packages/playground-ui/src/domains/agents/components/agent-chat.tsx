import { Thread } from '@/lib/ai-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { usePlaygroundStore } from '@/store/playground-store';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { MastraUIMessage } from '@mastra/react';
import { useEffect } from 'react';
import { toAISdkV4Messages, toAISdkV5Messages } from '@mastra/ai-sdk/ui';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  memory,
  refreshThreadList,
  modelVersion,
  modelList,
  messageId,
  isNewThread,
}: Omit<ChatProps, 'initialMessages' | 'initialLegacyMessages'> & { messageId?: string; isNewThread?: boolean }) => {
  const { settings } = useAgentSettings();
  const { requestContext } = usePlaygroundStore();
  const { data, isLoading: isMessagesLoading } = useAgentMessages({
    agentId: agentId,
    threadId: isNewThread ? undefined : threadId!, // Prevent fetching when thread is new
    memory: memory ?? false,
  });

  // Handle scrolling to message after navigation
  useEffect(() => {
    if (messageId && data && !isMessagesLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('bg-surface4');
          setTimeout(() => {
            messageElement.classList.remove('bg-surface4');
          }, 2000);
        }
      }, 100);
    }
  }, [messageId, data, isMessagesLoading]);

  if (isMessagesLoading) {
    return null;
  }

  const v5Messages = data?.messages ? (toAISdkV5Messages(data.messages) as MastraUIMessage[]) : [];
  const v4Messages = data?.messages ? toAISdkV4Messages(data.messages) : [];

  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
      threadId={threadId}
      initialMessages={v5Messages}
      initialLegacyMessages={v4Messages}
      memory={memory}
      refreshThreadList={refreshThreadList}
      settings={settings}
      requestContext={requestContext}
    >
      <Thread 
        agentName={agentName ?? ''} 
        hasMemory={memory} 
        agentId={agentId} 
        hasModelList={Boolean(modelList)}
      />
    </MastraRuntimeProvider>
  );
};
