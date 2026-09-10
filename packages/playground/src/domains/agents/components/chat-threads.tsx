import type { StorageThreadType } from '@mastra/core/memory';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
} from '@mastra/playground-ui/components/ThreadList';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { panelIconButtonClass } from '@mastra/playground-ui/resize/panel-icon-button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useLinkComponent } from '@/lib/framework';

export interface ChatThreadsProps {
  threads: StorageThreadType[];
  threadId: string;
  onDelete: (threadId: string) => void;
  resourceId: string;
  resourceType: 'agent' | 'network';
  embedded?: boolean;
  /** When provided, renders a "Hide threads panel" control next to "New Chat". */
  onHidePanel?: () => void;
}

export const ChatThreads = ({
  threads,
  threadId,
  onDelete,
  resourceId,
  resourceType,
  embedded = false,
  onHidePanel,
}: ChatThreadsProps) => {
  const { Link, paths } = useLinkComponent();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { canDelete } = usePermissions();

  const canDeleteThread = canDelete('memory');
  const newThreadLink =
    resourceType === 'agent' ? paths.agentNewThreadLink(resourceId) : paths.networkNewThreadLink(resourceId);

  return (
    <>
      <ThreadList embedded={embedded}>
        <div className="flex items-center gap-1">
          <ThreadListNewItem as={Link} to={newThreadLink}>
            <Icon>
              <Plus />
            </Icon>
            New Chat
          </ThreadListNewItem>
          {onHidePanel && (
            <button
              type="button"
              aria-label="Hide threads panel"
              title="Hide threads panel"
              className={cn(panelIconButtonClass, 'shrink-0')}
              onClick={onHidePanel}
            >
              <Icon>
                <PanelEdgeIcon side="left" />
              </Icon>
            </button>
          )}
        </div>

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
