import type { StorageThreadType } from '@mastra/core/memory';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { useDeleteThread } from '@/domains/memory/hooks/use-memory';
import { useLinkComponent } from '@/lib/framework';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  memoryType,
  hasMemory,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  memoryType?: 'local' | 'gateway';
  hasMemory: boolean;
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
    <MemorySidebar
      agentId={agentId}
      threadId={threadId}
      threads={threads}
      isLoading={isLoading}
      onDelete={handleDelete}
      memoryType={memoryType}
      hasMemory={hasMemory}
    />
  );
}
