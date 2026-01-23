import { Thread } from '@/lib/ai-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { usePlaygroundStore } from '@/store/playground-store';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { MastraUIMessage } from '@mastra/react';
import { useEffect, useContext } from 'react';
import { toAISdkV4Messages, toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { SchemaRequestContext } from '@/domains/request-context/context/schema-request-context';

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
  const { requestContext: globalRequestContext } = usePlaygroundStore();

  // Get schema values if provider is available (optional - works without it)
  const schemaContext = useContext(SchemaRequestContext);
  const schemaValues = schemaContext?.schemaValues ?? {};

  // Merge global context with schema values (schema values take precedence)
  const requestContext = {
    ...(globalRequestContext ?? {}),
    ...schemaValues,
  };

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

  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
      threadId={threadId}
      initialMessages={data?.messages ? (toAISdkV5Messages(data.messages) as MastraUIMessage[]) : []}
      initialLegacyMessages={data?.messages ? toAISdkV4Messages(data.messages) : []}
      memory={memory}
      refreshThreadList={refreshThreadList}
      settings={settings}
      requestContext={requestContext}
    >
      <Thread agentName={agentName ?? ''} hasMemory={memory} agentId={agentId} hasModelList={Boolean(modelList)} />
    </MastraRuntimeProvider>
  );
};
