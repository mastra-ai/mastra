import { useDeleteThread, useMemory, useThreads } from '@mastra/react/hooks/memory';
import { MemorySidebar } from '@/domains/agent-chat/memory-sidebar/memory-sidebar';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/utils/toast';

export function AgentSidebar({
  agentId,
  threadId,
  resourceId = agentId,
}: {
  agentId: string;
  threadId: string;
  /** Memory resource whose threads are listed. Defaults to agentId. */
  resourceId?: string;
}) {
  const requestContext = useEntityRequestContext('agent', agentId)[0];
  const { mutateAsync } = useDeleteThread(requestContext);
  const { paths, navigate } = useLinkComponent();
  const { data: memory } = useMemory({ agentId, requestContext, queryOptions: { enabled: Boolean(agentId) } });
  const hasMemory = Boolean(memory?.result);
  const { data, isLoading } = useThreads({
    agentId,
    isMemoryEnabled: hasMemory,
    resourceId,
    requestContext,
    queryOptions: { enabled: hasMemory },
  });
  const threads = (data ?? []).map(thread => ({
    ...thread,
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  }));

  const handleDelete = async (deleteId: string) => {
    try {
      await mutateAsync({ threadId: deleteId, agentId });
    } catch {
      toast.error('Failed to delete chat');
      return;
    }
    toast.success('Chat deleted successfully');
    if (deleteId === threadId) {
      navigate(paths.agentNewThreadLink(agentId));
    }
  };

  return (
    <MemorySidebar
      agentId={agentId}
      threadId={threadId}
      threads={threads}
      onDelete={handleDelete}
      isThreadsLoading={isLoading}
    />
  );
}
