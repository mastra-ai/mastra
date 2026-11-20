import { useAgentMessages } from '@mastra/react/hooks/agents';
import { useEffect, useRef } from 'react';
import type { ComponentType, PropsWithChildren, ReactNode } from 'react';
import { ChatProvider } from './chat-provider';
import { Thread } from './thread';
import type { ThreadProps } from './thread';
import type { ChatProps } from './types';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

export type AgentChatProps = Omit<ChatProps, 'initialMessages'> & {
  memory?: boolean;
  messageId?: string;
  suggestedPrompts?: string[];
  isNewThread?: boolean;
  hideModelSwitcher?: boolean;
  runOptionsSlot?: ReactNode;
  RuntimeFeatures?: ComponentType<ChatProps & { children: ReactNode }>;
  ComposerFeatures?: ComponentType<ThreadProps & { children: ReactNode }>;
};

function NoFeatures({ children }: PropsWithChildren) {
  return children;
}

export function AgentChat({
  memory,
  messageId,
  suggestedPrompts,
  isNewThread,
  hideModelSwitcher,
  runOptionsSlot,
  RuntimeFeatures = NoFeatures,
  ComposerFeatures = NoFeatures,
  ...chat
}: AgentChatProps) {
  const { agentId, agentName, threadId, requestContext, modelList, refreshThreadList } = chat;
  const {
    data,
    isLoading: isMessagesLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAgentMessages({
    agentId,
    threadId: isNewThread ? undefined : threadId,
    memory: memory ?? false,
    requestContext,
  });

  useEffect(() => {
    if (!messageId || !data || isMessagesLoading) return;
    const scrollTimer = setTimeout(() => {
      const messageElement = Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]')).find(
        element => element.dataset.messageId === messageId,
      );
      if (!messageElement) return;
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('bg-muted');
      setTimeout(() => messageElement.classList.remove('bg-muted'), 2000);
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [messageId, data, isMessagesLoading]);

  const emptyMessagesRef = useRef<{ threadId: string; messages: never[] }>({ threadId, messages: [] });
  if (emptyMessagesRef.current.threadId !== threadId) {
    emptyMessagesRef.current = { threadId, messages: [] };
  }
  const messages = data?.messages ?? emptyMessagesRef.current.messages;
  const loadOlderMessages = () => {
    if (!isFetchingNextPage) void fetchNextPage();
  };
  const thread: ThreadProps = {
    agentName: agentName ?? '',
    agentId,
    threadId,
    suggestedPrompts,
    hasModelList: Boolean(modelList),
    hideModelSwitcher,
    refreshThreadList,
    runOptionsSlot,
    isHistoryLoading: isMessagesLoading,
    onLoadPrevious: hasNextPage ? loadOlderMessages : undefined,
    isLoadingPrevious: isFetchingNextPage,
  };

  if (error && !data) {
    return (
      <div role="alert">
        <Txt>Could not load conversation.</Txt>
        <Button onClick={() => void refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <RuntimeFeatures {...chat}>
      <ChatProvider {...chat} initialMessages={messages}>
        <ComposerFeatures {...thread}>
          <Thread {...thread} />
        </ComposerFeatures>
      </ChatProvider>
    </RuntimeFeatures>
  );
}
