import type { StorageThreadType } from '@mastra/core/memory';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { MemorySidebar } from '@/domains/agents/components/memory-sidebar/memory-sidebar';
import { useDeleteThread, useUpdateThread } from '@/domains/memory/hooks/use-memory';

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
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { mutateAsync } = useDeleteThread(requestContext);
  const { mutateAsync: updateThread } = useUpdateThread(requestContext);
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId });
    if (deleteId === threadId) {
      navigate(paths.agentNewThreadLink(agentId));
    }
  };

  const handleRename = async (renameId: string, title: string) => {
    await updateThread({ threadId: renameId, agentId, title });
  };

  return (
    <MemorySidebar
      agentId={agentId}
      threadId={threadId}
      threads={threads}
      onDelete={handleDelete}
      onRename={handleRename}
      onHidePanel={onHidePanel}
    />
  );
}
