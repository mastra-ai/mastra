import type { StorageThreadType } from '@mastra/core/memory';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { useDeleteThread } from '@/domains/memory/hooks/use-memory';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

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
      onDelete={handleDelete}
      onHidePanel={onHidePanel}
    />
  );
}
