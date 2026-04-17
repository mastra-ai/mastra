import type { StorageThreadType } from '@mastra/core/memory';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { useDeleteThread } from '@/domains/memory/hooks/use-memory';
import { useLinkComponent } from '@/lib/framework';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  newThreadUrl,
  threadUrl,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  newThreadUrl?: string;
  threadUrl?: (threadId: string) => string;
}) {
  const { mutateAsync } = useDeleteThread();
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId });
    if (deleteId === threadId) {
      navigate(newThreadUrl ?? paths.agentNewThreadLink(agentId));
    }
  };

  return (
    <ChatThreads
      resourceId={agentId}
      resourceType={'agent'}
      threads={threads || []}
      isLoading={isLoading}
      threadId={threadId}
      onDelete={handleDelete}
      newThreadUrl={newThreadUrl}
      threadUrl={threadUrl}
    />
  );
}
