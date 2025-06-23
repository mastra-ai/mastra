import { v4 as uuid } from '@lukeed/uuid';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Threads, ThreadList, ThreadItem, ThreadLink, Icon, ThreadDeleteButton, Txt } from '@mastra/playground-ui';
import { AlertDialog } from '@/components/ui/alert-dialog';

import { Skeleton } from '@/components/ui/skeleton';

import { StorageThreadType } from '@mastra/core';
import { useDeleteNetworkThread } from '@/hooks/use-network-memory';

const formatDay = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  };
  return new Date(date).toLocaleString('en-us', options).replace(',', ' at');
};

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

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    await deleteThread({ threadId: deleteId!, resourceid: networkId, networkId });
    setDeleteId(null);
    if (deleteId === threadId) {
      navigate(`/networks/v-next/${networkId}/chat/${uuid()}`);
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

  const reverseThreads = [...(threads || [])].reverse();

  return (
    <div className="overflow-y-auto h-full w-full">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink as={Link} to={`/networks/v-next/${networkId}/chat/${uuid()}`}>
              <span className="text-accent1 flex items-center gap-4">
                <Icon className="bg-surface4 rounded-lg" size="lg">
                  <Plus />
                </Icon>
                New Chat
              </span>
            </ThreadLink>
          </ThreadItem>

          {reverseThreads.length === 0 && (
            <Txt as="p" variant="ui-sm" className="text-icon3 py-3 px-5">
              Your conversations will appear here
              <br /> once you start chatting!
            </Txt>
          )}

          {reverseThreads.map(thread => {
            const isActive = thread.id === threadId;

            return (
              <ThreadItem isActive={isActive} key={thread.id}>
                <ThreadLink as={Link} to={`/networks/v-next/${networkId}/chat/${thread.id}`}>
                  <span className="text-muted-foreground">Chat from</span>
                  <span>{formatDay(thread.createdAt)}</span>
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
    </div>
  );
}
