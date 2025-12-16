import { Thread, BranchInfo } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { usePlaygroundStore } from '@/store/playground-store';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { MastraUIMessage } from '@mastra/react';
import { useEffect, useMemo, useCallback } from 'react';
import { toAISdkV4Messages, toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { useThread, useBranchThread } from '@/domains/memory/hooks/use-memory';
import { useLinkComponent } from '@/lib/framework';

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
  const { navigate, paths } = useLinkComponent();
  const { data, isLoading: isMessagesLoading } = useAgentMessages({
    agentId: agentId,
    threadId: isNewThread ? undefined : threadId!, // Prevent fetching when thread is new
    memory: memory ?? false,
  });

  // Fetch thread metadata for branch info
  const { data: threadData } = useThread({
    threadId: isNewThread ? undefined : threadId,
    agentId,
    enabled: Boolean(memory) && !isNewThread,
  });

  // Branch thread mutation
  const branchThread = useBranchThread();

  // Extract branch info from thread metadata
  const branchInfo = useMemo<BranchInfo | undefined>(() => {
    if (!threadData?.metadata) return undefined;
    const metadata = threadData.metadata as Record<string, unknown>;
    if (!metadata.branchedFrom) return undefined;
    return {
      branchedFrom: metadata.branchedFrom as string,
      branchMessageCount: (metadata.branchMessageCount as number) || 0,
      sourceThreadTitle: metadata.sourceThreadTitle as string | undefined,
      branchLastMessageId: metadata.branchLastMessageId as string | undefined,
    };
  }, [threadData?.metadata]);

  // Navigate to a thread using the framework's navigation
  const navigateToThread = useCallback(
    (targetThreadId: string) => {
      const path = paths.agentThreadLink(agentId, targetThreadId);
      navigate(path);
    },
    [agentId, navigate, paths],
  );

  // Handle branch action
  // In playground, resourceId is always agentId
  const handleBranch = useCallback(
    async (branchMessageId: string) => {
      if (!threadId) return;

      try {
        const result = await branchThread.mutateAsync({
          threadId,
          messageId: branchMessageId,
          agentId,
          resourceId: agentId,
        });

        // Navigate to the new thread
        if (result.thread) {
          navigateToThread(result.thread.id);
        }
      } catch {
        // Error is handled by the hook's onError
      }
    },
    [threadId, agentId, branchThread, navigateToThread],
  );

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
      <Thread
        agentName={agentName ?? ''}
        hasMemory={memory}
        agentId={agentId}
        hasModelList={Boolean(modelList)}
        onBranch={memory && threadId ? handleBranch : undefined}
        branchInfo={branchInfo}
        onNavigateToThread={navigateToThread}
      />
    </MastraRuntimeProvider>
  );
};
