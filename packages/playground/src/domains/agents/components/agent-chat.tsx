import { useEffect, useRef } from 'react';
import { useAgentSettings } from '../context/agent-context';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { ChatProvider } from '@/lib/ai-ui/chat/chat-provider';
import { Thread } from '@/lib/ai-ui/thread';

import type { ChatProps } from '@/types';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  memory,
  refreshThreadList,
  modelVersion,
  agentVersionId,
  supportsMemory,
  modelList,
  messageId,
  isNewThread,
  hideModelSwitcher,
}: Omit<ChatProps, 'initialMessages'> & {
  memory?: boolean;
  messageId?: string;
  isNewThread?: boolean;
  hideModelSwitcher?: boolean;
}) => {
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
  const emptyMessagesRef = useRef<{ threadId: string; messages: never[] }>({ threadId, messages: [] });
  if (emptyMessagesRef.current.threadId !== threadId) {
    emptyMessagesRef.current = { threadId, messages: [] };
  }

  const messages = data?.messages ?? emptyMessagesRef.current.messages;

  return (
    <ChatProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
      agentVersionId={agentVersionId}
      supportsMemory={supportsMemory}
      threadId={threadId}
      initialMessages={messages}
      refreshThreadList={refreshThreadList}
      settings={settings}
      requestContext={requestContext}
    >
      <Thread
        agentName={agentName ?? ''}
        hasMemory={memory}
        agentId={agentId}
        threadId={threadId}
        hasModelList={Boolean(modelList)}
        hideModelSwitcher={hideModelSwitcher}
      />
    </ChatProvider>
  );
};
