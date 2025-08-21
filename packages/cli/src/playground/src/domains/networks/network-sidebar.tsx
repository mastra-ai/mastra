import { v4 as uuid } from '@lukeed/uuid';
import { useNavigate } from 'react-router';
import { ChatThreads } from '@mastra/playground-ui';
import { StorageThreadType } from '@mastra/core/memory';
import { useDeleteNetworkThread } from '@/hooks/use-network-memory';

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
  const { deleteThread } = useDeleteNetworkThread();
  const navigate = useNavigate();

  const handleDelete = async (deleteId: string) => {
    await deleteThread({ threadId: deleteId!, resourceid: networkId, networkId });
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
