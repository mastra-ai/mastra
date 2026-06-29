import type { StorageThreadType } from '@mastra/core/memory';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { useDeleteThread } from '@/domains/memory/hooks/use-memory';
import { useLinkComponent } from '@/lib/framework';

export function AgentSidebar({
  agentId,
  threadId,
  routeThreadId,
  agentVersionId,
  threads,
  isLoading,
  memoryType,
  hasMemory,
  isMemoryLoading,
}: {
  agentId: string;
  threadId: string;
  routeThreadId?: string;
  agentVersionId?: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  memoryType?: 'local' | 'gateway';
  hasMemory: boolean;
  isMemoryLoading?: boolean;
}) {
  const { mutateAsync } = useDeleteThread();
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId });
    if (deleteId === threadId) {
      const nextPath =
        agentVersionId && paths.agentVersionNewThreadLink
          ? paths.agentVersionNewThreadLink(agentId, agentVersionId)
          : paths.agentNewThreadLink(agentId);
      navigate(nextPath);
    }
  };

  return (
    <MemorySidebar
      agentId={agentId}
      threadId={threadId}
      routeThreadId={routeThreadId}
      agentVersionId={agentVersionId}
      threads={threads}
      isLoading={isLoading}
      onDelete={handleDelete}
      memoryType={memoryType}
      hasMemory={hasMemory}
      isMemoryLoading={isMemoryLoading}
    />
  );
}
