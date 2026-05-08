import type { StorageThreadType } from '@mastra/core/memory';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { useDeleteThread } from '@/domains/memory/hooks/use-memory';
import { useLinkComponent } from '@/lib/framework';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  showWorkflowInvocationThreads,
  onShowWorkflowInvocationThreadsChange,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  showWorkflowInvocationThreads: boolean;
  onShowWorkflowInvocationThreadsChange: (value: boolean) => void;
}) {
  const { mutateAsync } = useDeleteThread();
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId });
    if (deleteId === threadId) {
      navigate(paths.agentNewThreadLink(agentId));
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
      showWorkflowInvocationThreads={showWorkflowInvocationThreads}
      onShowWorkflowInvocationThreadsChange={onShowWorkflowInvocationThreadsChange}
    />
  );
}
