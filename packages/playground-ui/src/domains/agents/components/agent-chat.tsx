import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { usePlaygroundStore } from '@/store/playground-store';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { MastraUIMessage } from '@mastra/react';
import { useEffect } from 'react';
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  memory,
  refreshThreadList,
  modelVersion,
  modelList,
  messageId,
}: Omit<ChatProps, 'initialMessages' | 'initialLegacyMessages'> & { messageId?: string }) => {
  const { settings } = useAgentSettings();
  const { requestContext } = usePlaygroundStore();
  const { data: messages, isLoading: isMessagesLoading } = useAgentMessages({
    agentId: agentId,
    threadId: threadId ?? '',
    memory: memory ?? false,
  });

  // Handle scrolling to message after navigation
  useEffect(() => {
    if (messageId && messages && !isMessagesLoading) {
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
  }, [messageId, messages, isMessagesLoading]);

  if (isMessagesLoading) {
    return null;
  }

  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
      threadId={threadId}
      initialMessages={messages?.messages ? (toAISdkV5Messages(messages.messages) as MastraUIMessage[]) : []}
      memory={memory}
      refreshThreadList={refreshThreadList}
      settings={settings}
      requestContext={requestContext}
    >
      <Thread agentName={agentName ?? ''} hasMemory={memory} agentId={agentId} hasModelList={Boolean(modelList)} />
    </MastraRuntimeProvider>
  );
};
