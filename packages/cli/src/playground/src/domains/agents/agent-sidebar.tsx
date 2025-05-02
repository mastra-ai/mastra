import { v4 as uuid } from '@lukeed/uuid';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Threads, ThreadList, ThreadItem, ThreadLink, Icon, ThreadDeleteButton } from '@mastra/playground-ui';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';

import { useDeleteThread } from '@/hooks/use-memory';
import { StorageThreadType } from '@mastra/core';

const formatDay = (date: Date) => {
  return new Date(date).toLocaleDateString('en-us', {
    month: 'long',
    day: 'numeric',
  });
};

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

  if (isLoading) {
    return (
      <div className="p-4 w-full h-full space-y-2">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
    );
  }

  if (!threads?.length) {
    return (
      <div className="p-4 w-full space-y-2 h-full">
        <div className="flex justify-between items-center">
          <div className="text-sm text-mastra-el-5">Chat history</div>
          <Button onClick={() => navigate(`/agents/${agentId}/chat/${uuid()}`)}>
            <Plus />
          </Button>
        </div>
        <div className="text-sm text-mastra-el-3">Your conversations will appear here once you start chatting!</div>
      </div>
    );
  }

  const reverseThreads = [...threads].reverse();

  return (
    <>
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink as={Link} to={`/agents/${agentId}/chat/${uuid()}`}>
              <span className="text-accent1 flex items-center gap-4">
                <Icon className="bg-surface4 rounded-lg" size="lg">
                  <Plus />
                </Icon>
                New Chat
              </span>
            </ThreadLink>
          </ThreadItem>

          {reverseThreads.map(thread => {
            const isActive = thread.id === threadId;

            return (
              <ThreadItem isActive={isActive} key={thread.id}>
                <ThreadLink as={Link} to={`/agents/${agentId}/chat/${thread.id}`}>
                  <span className="truncate">{thread.title}</span>
                  <p className="text-ui-xs text-icon3">{formatDay(thread.createdAt)}</p>
                </ThreadLink>

                <ThreadDeleteButton onClick={() => setDeleteId(thread.id)} />
              </ThreadItem>
            );
          })}
        </ThreadList>
      </Threads>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
            <AlertDialog.Description>
              This action cannot be undone. This will permanently delete your chat and remove it from our servers.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDelete}>Continue</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
