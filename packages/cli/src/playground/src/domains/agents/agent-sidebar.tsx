import { v4 as uuid } from '@lukeed/uuid';
import { useState } from 'react';
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

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    await deleteThread({ threadId: deleteId!, resourceid: agentId, agentId });
    setDeleteId(null);
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
