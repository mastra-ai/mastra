import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDeleteThread, useMemory, useThreads } from '@mastra/react/hooks';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';

export function AgentSidebar({ agentId, threadId }: { agentId: string; threadId: string }) {
  const requestContext = useEntityRequestContext('agent', agentId)[0];
  const { mutateAsync } = useDeleteThread(requestContext);
  const { paths, navigate } = useLinkComponent();
  const { data: memory } = useMemory({ agentId, requestContext, queryOptions: { enabled: Boolean(agentId) } });
  const hasMemory = Boolean(memory?.result);
  const { data, isLoading } = useThreads({
    agentId,
    isMemoryEnabled: hasMemory,
    resourceId: agentId,
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
