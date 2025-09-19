import { ChatThreads, useLinkComponent } from '@mastra/playground-ui';
import { StorageThreadType } from '@mastra/core/memory';
import { useDeleteThread } from '@/hooks/use-memory';

export function NetworkSidebar({
  networkId,
  threadId,
  threads,
  isLoading,
}: {
  networkId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
}) {
  const { mutateAsync } = useDeleteThread();
  const { navigate, paths } = useLinkComponent();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, networkId });
    if (deleteId === threadId) {
      navigate(paths.networkNewThreadLink(networkId));
    }
  };

  return (
    <ChatThreads
      threads={threads || []}
      isLoading={isLoading}
      threadId={threadId}
      onDelete={handleDelete}
      resourceId={networkId}
      resourceType={'network'}
    />
  );
}
