import { formatDistanceToNow } from 'date-fns';
import { InboxIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertDialog } from '../../../ds/components/AlertDialog';
import { DataList, DataListSkeleton } from '../../../ds/components/DataList';
import { DropdownMenu } from '../../../ds/components/DropdownMenu';
import { EmptyState } from '../../../ds/components/EmptyState';
import type { LinkComponent } from '../../../ds/types/link-component';
import type { MemoryThread } from '../types';

const COLUMNS = 'minmax(12rem,2fr) minmax(8rem,1fr) minmax(8rem,1fr) 2.5rem';
const COLUMNS_NO_ACTIONS = 'minmax(12rem,2fr) minmax(8rem,1fr) minmax(8rem,1fr)';

export interface ThreadsTableViewProps {
  threads: MemoryThread[];
  isLoading: boolean;
  isError?: boolean;
  onThreadClick?: (thread: MemoryThread) => void;
  onDeleteThread?: (threadId: string) => Promise<void>;
  getThreadHref?: (thread: MemoryThread) => string;
  LinkComponent?: LinkComponent;
  emptySlot?: ReactNode;
}

function shortId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function ThreadDeleteConfirm({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete thread</AlertDialog.Title>
          <AlertDialog.Description>
            This will permanently delete this thread and all its messages. This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onConfirm}>Delete</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}

export function ThreadsTableView({
  threads,
  isLoading,
  isError,
  onThreadClick,
  onDeleteThread,
  getThreadHref,
  LinkComponent,
  emptySlot,
}: ThreadsTableViewProps) {
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const cols = onDeleteThread ? COLUMNS : COLUMNS_NO_ACTIONS;

  if (isLoading) {
    return <DataListSkeleton columns={cols} />;
  }

  if (isError) {
    return (
      <EmptyState
        iconSlot={<InboxIcon className="size-4" />}
        titleSlot="Failed to load threads"
        descriptionSlot="An error occurred while loading memory threads."
      />
    );
  }

  if (threads.length === 0) {
    return (
      emptySlot ?? (
        <EmptyState
          iconSlot={<InboxIcon className="size-4" />}
          titleSlot="No threads"
          descriptionSlot="Threads will appear here once your agents start conversations using memory."
        />
      )
    );
  }

  return (
    <>
      <DataList columns={cols} variant="striped">
        <DataList.Top>
          <DataList.TopCells>
            <DataList.TopCell>Title</DataList.TopCell>
            <DataList.TopCell>Resource</DataList.TopCell>
            <DataList.TopCell>Updated</DataList.TopCell>
            {onDeleteThread && <DataList.TopCell>{''}</DataList.TopCell>}
          </DataList.TopCells>
        </DataList.Top>
        {threads.map(thread => {
          const label = thread.title || shortId(thread.id);
          const href = getThreadHref?.(thread);

          const cells = (
            <>
              <DataList.NameCell title={thread.title || thread.id}>{label}</DataList.NameCell>
              <DataList.MonoCell>{thread.resourceId ? shortId(thread.resourceId) : '—'}</DataList.MonoCell>
              <DataList.TextCell>
                {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
              </DataList.TextCell>
              {onDeleteThread && (
                <DataList.Cell>
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for thread ${label}`}
                        className="inline-flex cursor-pointer rounded p-1 text-icon3 transition-colors hover:text-icon1"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item
                        className="text-red-400 focus:text-red-400"
                        onSelect={() => setDeleteThreadId(thread.id)}
                      >
                        <Trash2Icon className="size-3.5 mr-2" />
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </DataList.Cell>
              )}
            </>
          );

          if (href && LinkComponent) {
            return (
              <DataList.RowLink key={thread.id} to={href} LinkComponent={LinkComponent}>
                {cells}
              </DataList.RowLink>
            );
          }

          return (
            <DataList.RowButton key={thread.id} onClick={() => onThreadClick?.(thread)}>
              {cells}
            </DataList.RowButton>
          );
        })}
      </DataList>
      <ThreadDeleteConfirm
        open={deleteThreadId !== null}
        onOpenChange={open => {
          if (!open) setDeleteThreadId(null);
        }}
        onConfirm={async () => {
          if (deleteThreadId && onDeleteThread) {
            await onDeleteThread(deleteThreadId);
          }
          setDeleteThreadId(null);
        }}
      />
    </>
  );
}
