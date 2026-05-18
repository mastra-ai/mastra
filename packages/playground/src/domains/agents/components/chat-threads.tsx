import type { StorageThreadType } from '@mastra/core/memory';
import { AlertDialog, Icon, Skeleton } from '@mastra/playground-ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
  ThreadListSeparator,
} from '@/components/thread-list';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useLinkComponent } from '@/lib/framework';

export interface ChatThreadsProps {
  threads: StorageThreadType[];
  isLoading: boolean;
  threadId: string;
  onDelete: (threadId: string) => void;
  resourceId: string;
  resourceType: 'agent' | 'network';
}

export const ChatThreads = ({ threads, isLoading, threadId, onDelete, resourceId, resourceType }: ChatThreadsProps) => {
  const { Link, paths } = useLinkComponent();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { canDelete } = usePermissions();

  const canDeleteThread = canDelete('memory');

  if (isLoading) {
    return <ChatThreadSkeleton />;
  }

  const newThreadLink =
    resourceType === 'agent' ? paths.agentNewThreadLink(resourceId) : paths.networkNewThreadLink(resourceId);

  return (
    <>
      <ThreadList>
        <ThreadListNewItem as={Link} to={newThreadLink}>
          <Icon>
            <Plus />
          </Icon>
          New Chat
        </ThreadListNewItem>
        <ThreadListSeparator />

        {threads.length === 0 ? (
          <ThreadListEmpty>Your conversations will appear here once you start chatting!</ThreadListEmpty>
        ) : (
          <ThreadListItems>
            {threads.map(thread => {
              const isActive = thread.id === threadId;

              const threadLink =
                resourceType === 'agent'
                  ? paths.agentThreadLink(resourceId, thread.id)
                  : paths.networkThreadLink(resourceId, thread.id);

              return (
                <ThreadListItem
                  key={thread.id}
                  as={Link}
                  to={threadLink}
                  isActive={isActive}
                  onDelete={canDeleteThread ? () => setDeleteId(thread.id) : undefined}
                  deleteLabel="delete thread"
                >
                  <ThreadTitle title={thread.title} id={thread.id} createdAt={thread.createdAt} />
                </ThreadListItem>
              );
            })}
          </ThreadListItems>
        )}
      </ThreadList>

      <DeleteThreadDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onDelete={() => {
          if (deleteId) {
            onDelete(deleteId);
          }
        }}
      />
    </>
  );
};

interface DeleteThreadDialogProps {
  open: boolean;
  onOpenChange: (n: boolean) => void;
  onDelete: () => void;
}
const DeleteThreadDialog = ({ open, onOpenChange, onDelete }: DeleteThreadDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
          <AlertDialog.Description>
            This action cannot be undone. This will permanently delete your chat and remove it from our servers.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onDelete}>Continue</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
};

const ChatThreadSkeleton = () => (
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

function isDefaultThreadName(name: string): boolean {
  const defaultPattern = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  return defaultPattern.test(name);
}

function ThreadTitle({ title, id, createdAt }: { title?: string; id?: string; createdAt?: Date }) {
  if (!title || isDefaultThreadName(title)) {
    return <span>{createdAt ? formatDay(createdAt) : `Thread ${id ? id.substring(id.length - 5) : ''}`}</span>;
  }

  return <span className="truncate">{title}</span>;
}

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
