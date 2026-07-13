import type { StorageThreadType } from '@mastra/core/memory';
import { toast } from '@mastra/playground-ui/utils/toast';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { useDeleteThread } from '@/domains/memory/hooks/use-memory';
import { useLinkComponent } from '@/lib/framework';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
}: {
  agentId: string;
  threadId: string;
  threads: StorageThreadType[];
}) {
  const { mutateAsync } = useDeleteThread();
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    try {
      await mutateAsync({ threadId: deleteId, agentId });
      toast.success('Chat deleted successfully');
      if (deleteId === threadId) {
        navigate(paths.agentNewThreadLink(agentId));
      }
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  return <MemorySidebar agentId={agentId} threadId={threadId} threads={threads} onDelete={handleDelete} />;
}
