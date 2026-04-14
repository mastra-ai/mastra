import {
  AgentMemory,
  ChatThreads,
  useCloneThread,
  useDeleteThread,
  useLeftSidebarTab,
  useLinkComponent,
} from '@mastra/playground-ui';
import type { ChatThreadsProps } from '@mastra/playground-ui';
import { useState } from 'react';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
}: {
  agentId: string;
  threadId: string;
  threads?: ChatThreadsProps['threads'];
  isLoading: boolean;
}) {
  const { mutateAsync } = useDeleteThread();
  const { mutateAsync: cloneThread } = useCloneThread();
  const { paths, navigate } = useLinkComponent();
  const [isCloningThreadId, setIsCloningThreadId] = useState<string | null>(null);
  const { activeTab } = useLeftSidebarTab();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId });
    if (deleteId === threadId) {
      navigate(paths.agentNewThreadLink(agentId));
    }
  };

  const handleClone = async (sourceThreadId: string) => {
    setIsCloningThreadId(sourceThreadId);

    try {
      const result = await cloneThread({ threadId: sourceThreadId, agentId });
      if (result?.thread?.id) {
        navigate(paths.agentThreadLink(agentId, result.thread.id));
      }
    } finally {
      setIsCloningThreadId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface2">
      {activeTab === 'conversations' && (
        <ChatThreads
          resourceId={agentId}
          resourceType={'agent'}
          threads={threads || []}
          isLoading={isLoading}
          threadId={threadId}
          onDelete={handleDelete}
          onClone={handleClone}
          isCloningThreadId={isCloningThreadId}
        />
      )}

      {activeTab === 'memory' && (
        <div className="flex-1 overflow-y-auto">
          <AgentMemory agentId={agentId} threadId={threadId} />
        </div>
      )}
    </div>
  );
}
