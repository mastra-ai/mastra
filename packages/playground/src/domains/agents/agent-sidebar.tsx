import type { StorageThreadType } from '@mastra/core/memory';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDeleteThread } from '@mastra/react/hooks';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  onHidePanel,
}: {
  agentId: string;
  threadId: string;
  threads: StorageThreadType[];
  onHidePanel?: () => void;
}) {
  const { mutateAsync } = useDeleteThread(useEntityRequestContext('agent', agentId)[0]);
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    try {
      await mutateAsync({ threadId: deleteId!, agentId });
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
      onHidePanel={onHidePanel}
    />
  );
}
