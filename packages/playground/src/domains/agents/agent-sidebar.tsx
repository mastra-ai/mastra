import { ChatThreads, useLinkComponent, useDeleteThread } from '@mastra/playground-ui';

import { StorageThreadType } from '@mastra/core/memory';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  resourceId,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  resourceId: string;
}) {
  const { mutateAsync } = useDeleteThread();
  const { paths, navigate } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, agentId, resourceId });
    if (deleteId === threadId) {
      navigate(paths.agentNewThreadLink(agentId));
    }
  };

  return (
    <ChatThreads
      resourceId={resourceId}
      resourceType={'agent'}
      threads={threads || []}
      isLoading={isLoading}
      threadId={threadId}
      onDelete={handleDelete}
    />
  );
}
