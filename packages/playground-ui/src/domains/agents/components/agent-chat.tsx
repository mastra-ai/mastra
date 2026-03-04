import { Thread } from '@/lib/ai-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { MastraUIMessage } from '@mastra/react';
import { useEffect, useMemo } from 'react';
import { toAISdkV4Messages, toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

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
  const requestContext = useMergedRequestContext();

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

  // Stable empty array per thread: stays the same reference across re-renders
  // (preventing useChat from wiping streamed messages), but changes when threadId
  // changes (allowing useChat to reset when switching threads).
  const emptyMessages = useMemo(() => [] as never[], [threadId]);

  const messages = data?.messages ?? emptyMessages;
  const v5Messages = useMemo(() => toAISdkV5Messages(messages) as MastraUIMessage[], [messages]);
  const v4Messages = useMemo(() => toAISdkV4Messages(messages), [messages]);

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
      <Thread agentName={agentName ?? ''} hasMemory={memory} agentId={agentId} hasModelList={Boolean(modelList)} />
    </MastraRuntimeProvider>
  );
};
