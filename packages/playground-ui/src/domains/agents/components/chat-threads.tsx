import { ThreadDeleteButton, ThreadItem, ThreadLink, ThreadList, Threads } from '@/components/threads';
import { Icon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { Plus } from 'lucide-react';
import { StorageThreadType } from '@mastra/core/memory';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt/Txt';

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

  if (isLoading) {
    return <ChatThreadSkeleton />;
  }

  const newThreadLink =
    resourceType === 'agent' ? paths.agentNewThreadLink(resourceId) : paths.networkNewThreadLink(resourceId);

  return (
    <div className="overflow-y-auto h-full w-full">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink as={Link} to={newThreadLink}>
              <span className="text-accent1 flex items-center gap-4">
                <Icon className="bg-surface4 rounded-lg" size="lg">
                  <Plus />
                </Icon>
                New Chat
              </span>
            </ThreadLink>
          </ThreadItem>

          {threads.length === 0 && (
            <Txt as="p" variant="ui-sm" className="text-icon3 py-3 px-5">
              Your conversations will appear here once you start chatting!
            </Txt>
          )}

          {threads.map(thread => {
            const isActive = thread.id === threadId;

            const threadLink =
              resourceType === 'agent'
                ? paths.agentThreadLink(resourceId, thread.id)
                : paths.networkThreadLink(resourceId, thread.id);

            return (
              <ThreadItem isActive={isActive} key={thread.id}>
                <ThreadLink as={Link} to={threadLink}>
                  <ThreadTitle title={thread.title} id={thread.id} />
                  <span>{formatDay(thread.createdAt)}</span>
                </ThreadLink>

                <ThreadDeleteButton onClick={() => setDeleteId(thread.id)} />
              </ThreadItem>
            );
          })}
        </ThreadList>
      </Threads>

      <DeleteThreadDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onDelete={() => {
          if (deleteId) {
            onDelete(deleteId);
          }
        }}
      />
    </div>
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

function ThreadTitle({ title, id }: { title?: string; id?: string }) {
  if (!title) {
    return null;
  }

  if (isDefaultThreadName(title)) {
    return <span className="text-muted-foreground">Thread {id ? id.substring(id.length - 5) : null}</span>;
  }

  return <span className="truncate max-w-[14rem] text-muted-foreground">{title}</span>;
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
