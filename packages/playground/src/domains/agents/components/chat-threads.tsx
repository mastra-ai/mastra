import type { StorageThreadType } from '@mastra/core/memory';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
  ThreadListSeparator,
} from '@mastra/playground-ui/components/ThreadList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { panelIconButtonClass } from '@mastra/playground-ui/resize/panel-icon-button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { ChevronRight, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useThreadsPanel } from '../context/use-threads-panel';
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
  // The mobile drawer has its own close control, so no hide button there.
  const isMobile = useIsMobile();
  const canHidePanel = Boolean(threadsPanel) && !isMobile;

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
      <ThreadList embedded={embedded}>
        {/* pt-[3px] lines the hide button up with the collapsed panel's expand button (top-2 vs border+p-1) */}
        <div className="flex items-center gap-1 pt-[3px]">
          <ThreadListNewItem render={<Link href={newThreadLink} />}>
            <Icon>
              <Plus />
            </Icon>
            New Thread
          </ThreadListNewItem>
          {canHidePanel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Hide threads panel"
                  className={cn(panelIconButtonClass, 'shrink-0')}
                  onClick={() => threadsPanel?.collapse()}
                >
                  <Icon>
                    <PanelEdgeIcon side="left" />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span className="inline-flex items-center gap-1.5">
                  Hide threads panel
                  <Kbd size="xs">{'{'}</Kbd>
                </span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <ThreadListSeparator />

        {!isLoading && (
          <div className="pt-1">
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
          </div>
        )}
      </ThreadList>

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
          <ChevronRight aria-hidden className="size-3" />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
