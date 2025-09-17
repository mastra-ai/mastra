import { v4 as uuid } from '@lukeed/uuid';
import { useNavigate } from 'react-router';
import { ChatThreads } from '@mastra/playground-ui';
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
  const navigate = useNavigate();

  const handleDelete = async (deleteId: string) => {
    await mutateAsync({ threadId: deleteId!, networkId });
    if (deleteId === threadId) {
      navigate(`/networks/v-next/${networkId}/chat/${uuid()}`);
    }
  };

  return (
    <ChatThreads
      computeNewThreadLink={() => `/networks/v-next/${networkId}/chat/${uuid()}`}
      computeThreadLink={threadId => `/networks/v-next/${networkId}/chat/${threadId}`}
      threads={threads || []}
      isLoading={isLoading}
      threadId={threadId}
      onDelete={handleDelete}
    />
  );
}
