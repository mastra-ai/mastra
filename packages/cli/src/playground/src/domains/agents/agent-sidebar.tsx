import { v4 as uuid } from '@lukeed/uuid';
import { useNavigate } from 'react-router';
import { ChatThreads } from '@mastra/playground-ui';

import { useDeleteThread } from '@/hooks/use-memory';
import { StorageThreadType } from '@mastra/core/memory';

export function AgentSidebar({
  agentId,
  threadId,
  threads,
  isLoading,
}: {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
}) {
  const { deleteThread } = useDeleteThread();
  const navigate = useNavigate();

  const handleDelete = async (deleteId: string) => {
    await deleteThread({ threadId: deleteId!, resourceid: agentId, agentId });
    if (deleteId === threadId) {
      navigate(`/agents/${agentId}/chat/${uuid()}`);
    }
  };

  return (
    <ChatThreads
      computeNewThreadLink={() => `/agents/${agentId}/chat/${uuid()}`}
      computeThreadLink={threadId => `/agents/${agentId}/chat/${threadId}`}
      threads={threads || []}
      isLoading={isLoading}
      threadId={threadId}
      onDelete={handleDelete}
    />
  );
}
