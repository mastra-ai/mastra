import type { StorageThreadType } from '@mastra/core/memory';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import {
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
} from '@mastra/playground-ui/components/ThreadList';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useThreadsPanel } from '@mastra/playground-ui/domains/agents/chat';
import { AgentConversationSidebar } from '@mastra/playground-ui/domains/agents/components/agent-conversation-sidebar';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useCollapsedThreadSections } from '../hooks/use-collapsed-thread-sections';
import { usePinnedThreads } from '../hooks/use-pinned-threads';
import { RenameThreadDialog } from './rename-thread-dialog';
import { ThreadActionsMenu } from './thread-actions-menu';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export interface ChatThreadsProps {
  threads: StorageThreadType[];
  threadId: string;
  onDelete: (threadId: string) => void;
  resourceId: string;
  resourceType: 'agent' | 'network';
  embedded?: boolean;
  /** While true, only the header is rendered so it stays in place until the list arrives. */
  isLoading?: boolean;
}

export const ChatThreads = ({
  threads,
  threadId,
  onDelete,
  resourceId,
  resourceType,
  embedded = false,
  isLoading = false,
}: ChatThreadsProps) => {
  const { Link, paths } = useLinkComponent();
  const [dialog, setDialog] = useState<{ type: 'rename' | 'delete'; thread: StorageThreadType } | null>(null);
  const { canDelete, canEdit } = usePermissions();
  const { pinnedIds, pin, unpin } = usePinnedThreads(resourceType, resourceId);
  const pinnedLabelId = useId();
  const recentLabelId = useId();
  const { isCollapsed, toggle } = useCollapsedThreadSections();
  const threadsPanel = useThreadsPanel();

  const threadsById = new Map(threads.map(thread => [thread.id, thread]));
  const pinnedThreads = pinnedIds.flatMap(id => threadsById.get(id) ?? []);
  const pinnedIdSet = new Set(pinnedThreads.map(thread => thread.id));
  const otherThreads = threads.filter(thread => !pinnedIdSet.has(thread.id));

  const canDeleteThread = canDelete('memory');
  const canRenameThread = resourceType === 'agent' && canEdit('memory');
  const closeDialog = () => setDialog(null);
  const threadLink = (id: string) =>
    resourceType === 'agent' ? paths.agentThreadLink(resourceId, id) : paths.networkThreadLink(resourceId, id);
  const newThreadLink =
    resourceType === 'agent' ? paths.agentNewThreadLink(resourceId) : paths.networkNewThreadLink(resourceId);

  const recentList = (
    <ThreadListItems>
      {otherThreads.map(thread => (
        <ThreadListItem
          key={thread.id}
          as={Link}
          to={threadLink(thread.id)}
          isActive={thread.id === threadId}
          actions={
            <ThreadActionsMenu
              onPin={() => pin(thread.id)}
              onRename={canRenameThread ? () => setDialog({ type: 'rename', thread }) : undefined}
              onDelete={canDeleteThread ? () => setDialog({ type: 'delete', thread }) : undefined}
            />
          }
        >
          <ThreadTitle title={thread.title} id={thread.id} createdAt={thread.createdAt} />
        </ThreadListItem>
      ))}
    </ThreadListItems>
  );

  return (
    <>
      <AgentConversationSidebar
        embedded={embedded}
        isLoading={isLoading}
        onCollapse={threadsPanel ? () => threadsPanel.collapse() : undefined}
        newThreadSlot={
          <ThreadListNewItem render={<Link href={newThreadLink} />}>
            <Icon>
              <IconPlusMedium />
            </Icon>
            New Thread
          </ThreadListNewItem>
        }
      >
        {pinnedThreads.length > 0 && (
          <CollapsibleSection
            labelId={pinnedLabelId}
            label="Pinned"
            collapsed={isCollapsed('pinned')}
            onToggle={() => toggle('pinned')}
          >
            <ThreadListItems>
              {pinnedThreads.map(thread => (
                <ThreadListItem
                  key={thread.id}
                  as={Link}
                  to={threadLink(thread.id)}
                  isActive={thread.id === threadId}
                  actions={
                    <ThreadActionsMenu
                      onUnpin={() => unpin(thread.id)}
                      onRename={canRenameThread ? () => setDialog({ type: 'rename', thread }) : undefined}
                      onDelete={canDeleteThread ? () => setDialog({ type: 'delete', thread }) : undefined}
                    />
                  }
                >
                  <ThreadTitle title={thread.title} id={thread.id} createdAt={thread.createdAt} />
                </ThreadListItem>
              ))}
            </ThreadListItems>
          </CollapsibleSection>
        )}

        {threads.length === 0 ? (
          // A first visit has nothing to list: fold the panel away once so the landing gets the width.
          <div
            ref={node => {
              if (node) threadsPanel?.collapseOnce();
            }}
          >
            <ThreadListEmpty>Your conversations will appear here once you start chatting!</ThreadListEmpty>
          </div>
        ) : (
          otherThreads.length > 0 &&
          (pinnedThreads.length > 0 ? (
            <CollapsibleSection
              labelId={recentLabelId}
              label="Recent"
              collapsed={isCollapsed('recent')}
              onToggle={() => toggle('recent')}
            >
              {recentList}
            </CollapsibleSection>
          ) : (
            recentList
          ))
        )}
      </AgentConversationSidebar>

      <DeleteThreadDialog
        open={dialog?.type === 'delete'}
        onOpenChange={closeDialog}
        onDelete={() => {
          if (dialog?.type === 'delete') {
            unpin(dialog.thread.id);
            onDelete(dialog.thread.id);
          }
        }}
      />

      {dialog?.type === 'rename' && (
        <RenameThreadDialog
          agentId={resourceId}
          threadId={dialog.thread.id}
          initialTitle={dialog.thread.title ?? ''}
          onOpenChange={open => !open && closeDialog()}
        />
      )}
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
        ? formatDate(createdAt, 'date-time-seconds')
        : `Thread ${id ? id.substring(id.length - 5) : ''}`;

  return (
    <Txt as="span" variant="body-sm" className="block truncate">
      {titleText}
    </Txt>
  );
}

interface CollapsibleSectionProps {
  labelId: string;
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleSection({ labelId, label, collapsed, onToggle, children }: CollapsibleSectionProps) {
  return (
    <Collapsible
      render={<section aria-labelledby={labelId} className="group/section" />}
      open={!collapsed}
      onOpenChange={onToggle}
    >
      <h2 className="flex px-3 pt-3 pb-1 text-placeholder group-first-of-type/section:pt-0">
        <CollapsibleTrigger id={labelId} className="inline-flex items-center gap-1 rounded-sm text-meta">
          {label}
          <DisclosureChevron direction="right" className="size-3" />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
