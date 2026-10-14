import { useAgentMessages } from '@mastra/react/hooks/agents';
import { useEffect, useRef } from 'react';
import { ChatProvider } from './chat/chat-provider';
import { useAgentSettings } from './context/agent-context';
import { Thread } from './thread';
import type { ChatProps } from './types';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

export interface AgentChatProps extends Omit<ChatProps, 'initialMessages'> {
  memory?: boolean;
  messageId?: string;
  suggestedPrompts?: string[];
  isNewThread?: boolean;
  hideModelSwitcher?: boolean;
  runOptionsSlot?: React.ReactNode;
  /** Host-provided channels card shown on the landing screen. */
  channelsSlot?: React.ReactNode;
  /** Host-provided browser-session thumbnail rendered above the composer. */
  browserThumbnailSlot?: React.ReactNode;
  /** Host-provided voice-call panel rendered above the composer. */
  voicePanelSlot?: React.ReactNode;
  /** Host-provided voice-call button rendered in the composer action row. */
  voiceButtonSlot?: React.ReactNode;
}

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
  suggestedPrompts,
  isNewThread,
  hideModelSwitcher,
  runOptionsSlot,
  channelsSlot,
  browserThumbnailSlot,
  voicePanelSlot,
  voiceButtonSlot,
}: AgentChatProps) => {
  const { settings } = useAgentSettings();
  const requestContext = useEntityRequestContext('agent', agentId)[0];

  const {
    data,
    isLoading: isMessagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAgentMessages({
    agentId: agentId,
    threadId: isNewThread ? undefined : threadId,
    memory: memory ?? false,
    requestContext: requestContext,
  });

  // Handle scrolling to message after navigation
  useEffect(() => {
    if (messageId && data && !isMessagesLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('bg-muted');
          setTimeout(() => {
            messageElement.classList.remove('bg-muted');
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

  const loadOlderMessages = () => {
    if (!isFetchingNextPage) void fetchNextPage();
  };

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
        agentId={agentId}
        threadId={threadId}
        suggestedPrompts={suggestedPrompts}
        hasModelList={Boolean(modelList)}
        hideModelSwitcher={hideModelSwitcher}
        refreshThreadList={refreshThreadList}
        runOptionsSlot={runOptionsSlot}
        isHistoryLoading={isMessagesLoading}
        onLoadPrevious={hasNextPage ? loadOlderMessages : undefined}
        isLoadingPrevious={isFetchingNextPage}
        channelsSlot={channelsSlot}
        browserThumbnailSlot={browserThumbnailSlot}
        voicePanelSlot={voicePanelSlot}
        voiceButtonSlot={voiceButtonSlot}
      />
    </ChatProvider>
  );
};
