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
  computeNewThreadLink: () => string;
  computeThreadLink: (threadId: string) => string;
  threads: StorageThreadType[];
  isLoading: boolean;
  threadId: string;
  onDelete: (threadId: string) => void;
}

export const ChatThreads = ({
  computeNewThreadLink,
  computeThreadLink,
  threads,
  isLoading,
  threadId,
  onDelete,
}: ChatThreadsProps) => {
  const { Link } = useLinkComponent();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return <ChatThreadSkeleton />;
  }

  const reverseThreads = [...threads].reverse();

  return (
    <div className="overflow-y-auto h-full w-full">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink as={Link} to={computeNewThreadLink()}>
              <span className="text-accent1 flex items-center gap-4">
                <Icon className="bg-surface4 rounded-lg" size="lg">
                  <Plus />
                </Icon>
                New Chat
              </span>
            </ThreadLink>
          </ThreadItem>

          {reverseThreads.length === 0 && (
            <Txt as="p" variant="ui-sm" className="text-icon3 py-3 px-5 max-w-[12rem]">
              Your conversations will appear here once you start chatting!
            </Txt>
          )}

          {reverseThreads.map(thread => {
            const isActive = thread.id === threadId;

            return (
              <ThreadItem isActive={isActive} key={thread.id}>
                <ThreadLink as={Link} to={computeThreadLink(thread.id)}>
                  <ThreadTitle title={thread.title} />
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

function ThreadTitle({ title }: { title?: string }) {
  if (!title) {
    return null;
  }

  if (isDefaultThreadName(title)) {
    return <span className="text-muted-foreground">Chat from</span>;
  }

  return <span className="truncate max-w-[14rem]">{title}</span>;
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
