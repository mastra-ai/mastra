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
}: {
  agentId: string;
  threadId: string;
  routeThreadId?: string;
  agentVersionId?: string;
  threads: StorageThreadType[];
}) {
  const { mutateAsync } = useDeleteThread();
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId, agentId });
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
      onDelete={handleDelete}
    />
  );
}
