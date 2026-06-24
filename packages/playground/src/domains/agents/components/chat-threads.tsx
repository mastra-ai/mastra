import type { StorageThreadType } from '@mastra/core/memory';
import { Icon } from '@mastra/playground-ui';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
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
  embedded?: boolean;
}

export const ChatThreads = ({
  threads,
  isLoading,
  threadId,
  onDelete,
  resourceId,
  resourceType,
  embedded = false,
}: ChatThreadsProps) => {
  const { Link, paths } = useLinkComponent();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { canDelete } = usePermissions();

  const canDeleteThread = canDelete('memory');
  const newThreadLink =
    resourceType === 'agent' ? paths.agentNewThreadLink(resourceId) : paths.networkNewThreadLink(resourceId);

  if (isLoading) {
    return <ChatThreadSkeleton embedded={embedded} Link={Link} newThreadLink={newThreadLink} />;
  }

  return (
    <>
      <ThreadList embedded={embedded}>
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

const ChatThreadSkeleton = ({
  embedded,
  Link,
  newThreadLink,
}: {
  embedded: boolean;
  Link: ReturnType<typeof useLinkComponent>['Link'];
  newThreadLink: string;
}) => (
  <ThreadList embedded={embedded} aria-label="Loading threads">
    <div className="flex h-full w-full flex-col gap-1" data-testid="chat-threads-skeleton" aria-busy="true">
      <ThreadListNewItem as={Link} to={newThreadLink}>
        <Icon>
          <Plus />
        </Icon>
        New Chat
      </ThreadListNewItem>
      <ThreadListSeparator />
      <ThreadListItems>
        <ThreadTitleSkeleton widthClassName="w-32" />
        <ThreadTitleSkeleton widthClassName="w-24" />
        <ThreadTitleSkeleton widthClassName="w-36" />
        <ThreadTitleSkeleton widthClassName="w-28" />
        <ThreadTitleSkeleton widthClassName="w-20" />
      </ThreadListItems>
    </div>
  </ThreadList>
);

function ThreadTitleSkeleton({ widthClassName }: { widthClassName: string }) {
  return (
    <li className="group relative">
      <div className="flex h-9 w-full min-w-0 items-center rounded-xl px-3">
        <Skeleton className={`h-3 ${widthClassName}`} data-testid="chat-thread-title-skeleton" />
      </div>
    </li>
  );
}

function isDefaultThreadName(name: string): boolean {
  const defaultPattern = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  return defaultPattern.test(name);
}

function ThreadTitle({ title, id, createdAt }: { title?: string; id?: string; createdAt?: Date }) {
  const titleText =
    title && !isDefaultThreadName(title)
      ? title
      : createdAt
        ? formatDay(createdAt)
        : `Thread ${id ? id.substring(id.length - 5) : ''}`;

  return <span className="block truncate">{titleText}</span>;
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
