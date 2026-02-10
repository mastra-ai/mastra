import { ChatThreads, useLinkComponent, useDeleteThread, ResourceIdSelector } from '@mastra/playground-ui';

import { StorageThreadType } from '@mastra/core/memory';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  resourceId,
  onResourceIdChange,
  availableResourceIds,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  resourceId: string;
  onResourceIdChange: (resourceId: string) => void;
  availableResourceIds: string[];
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
    <div className="flex flex-col h-full">
      {/* ResourceId Selector at top */}
      <div className="p-3 border-b border-border1">
        <ResourceIdSelector
          value={resourceId}
          onChange={onResourceIdChange}
          agentId={agentId}
          availableResourceIds={availableResourceIds}
        />
      </div>

      {/* Chat threads below */}
      <ChatThreads
        resourceId={resourceId}
        resourceType={'agent'}
        threads={threads || []}
        isLoading={isLoading}
        threadId={threadId}
        onDelete={handleDelete}
        agentId={agentId}
      />
    </div>
  );
}
