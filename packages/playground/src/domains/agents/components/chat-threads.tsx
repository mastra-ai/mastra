import type { StorageThreadType } from '@mastra/core/memory';
import {
  AlertDialog,
  IconButton,
  Skeleton,
  ThreadDeleteButton,
  ThreadItem,
  ThreadLink,
  ThreadList,
  Threads,
  Txt,
  Icon,
} from '@mastra/playground-ui';
import { Copy, Plus } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useLinkComponent } from '@/lib/framework';

export interface ChatThreadsProps {
  threads: StorageThreadType[];
  isLoading: boolean;
  threadId: string;
  onDelete: (threadId: string) => void;
  onClone?: (threadId: string) => void;
  isCloningThreadId?: string | null;
  resourceId: string;
  resourceType: 'agent' | 'network';
}

export const ChatThreads = ({
  threads,
  isLoading,
  threadId,
  onDelete,
  onClone,
  isCloningThreadId,
  resourceId,
  resourceType,
}: ChatThreadsProps) => {
  const { Link, paths } = useLinkComponent();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { canDelete } = usePermissions();

  // Check if user can delete threads (memory:delete permission)
  const canDeleteThread = canDelete('memory');

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
            <Txt as="p" variant="ui-sm" className="text-neutral3 py-3 px-5">
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
                  <ThreadTitle title={thread.title || null} id={thread.id} />
                  <span>{formatDay(thread.createdAt)}</span>
                </ThreadLink>

                <div className="flex items-center gap-1">
                  {onClone && (
                    <IconButton
                      tooltip="Clone conversation memory"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface4"
                      onClick={() => onClone(thread.id)}
                      disabled={isCloningThreadId === thread.id}
                      aria-label="clone thread"
                    >
                      <Copy className="h-4 w-4 text-neutral3 transition-colors" />
                    </IconButton>
                  )}
                  {canDeleteThread && (
                    <ThreadDeleteButton
                      tooltip="Delete conversation"
                      className="h-7 w-7 p-0"
                      onClick={() => setDeleteId(thread.id)}
                    />
                  )}
                </div>
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

function ThreadTitle({ title, id }: { title: string | null; id?: string }) {
  if (!title) {
    return null;
  }

  if (isDefaultThreadName(title)) {
    return <span className="text-neutral3">Thread {id ? id.substring(id.length - 5) : null}</span>;
  }

  return <span className="truncate max-w-56 text-neutral3">{title}</span>;
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
