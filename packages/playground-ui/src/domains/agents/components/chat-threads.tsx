import { ThreadDeleteButton, ThreadItem, ThreadLink, ThreadList, Threads } from '@/components/threads';
import { Icon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { Plus, GitBranch } from 'lucide-react';
import { StorageThreadType } from '@mastra/core/memory';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Txt } from '@/ds/components/Txt/Txt';

interface BranchMetadata {
  parentThreadId: string;
  branchPointMessageId?: string;
  branchCreatedAt: string;
}

function getBranchMetadata(thread: StorageThreadType): BranchMetadata | null {
  const branch = thread.metadata?.branch;
  if (!branch || typeof branch !== 'object') return null;
  const branchObj = branch as Record<string, unknown>;
  if (!branchObj.parentThreadId || typeof branchObj.parentThreadId !== 'string') return null;
  return {
    parentThreadId: branchObj.parentThreadId,
    branchPointMessageId: branchObj.branchPointMessageId as string | undefined,
    branchCreatedAt: branchObj.branchCreatedAt as string,
  };
}

interface ThreadNode {
  thread: StorageThreadType;
  children: ThreadNode[];
  depth: number;
}

function buildThreadTree(threads: StorageThreadType[]): ThreadNode[] {
  const threadMap = new Map<string, StorageThreadType>();
  const childrenMap = new Map<string, StorageThreadType[]>();
  const rootThreads: StorageThreadType[] = [];

  // First pass: build maps
  for (const thread of threads) {
    threadMap.set(thread.id, thread);
    const branchMeta = getBranchMetadata(thread);
    if (branchMeta) {
      const parentChildren = childrenMap.get(branchMeta.parentThreadId) || [];
      parentChildren.push(thread);
      childrenMap.set(branchMeta.parentThreadId, parentChildren);
    } else {
      rootThreads.push(thread);
    }
  }

  // Second pass: build tree recursively
  function buildNode(thread: StorageThreadType, depth: number): ThreadNode {
    const children = (childrenMap.get(thread.id) || [])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(child => buildNode(child, depth + 1));
    return { thread, children, depth };
  }

  // Sort root threads by date (newest first)
  rootThreads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return rootThreads.map(thread => buildNode(thread, 0));
}

function flattenTree(nodes: ThreadNode[]): ThreadNode[] {
  const result: ThreadNode[] = [];
  function traverse(node: ThreadNode) {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }
  for (const node of nodes) {
    traverse(node);
  }
  return result;
}

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

  // Build tree structure from flat thread list
  const flattenedThreads = useMemo(() => {
    const tree = buildThreadTree(threads);
    return flattenTree(tree);
  }, [threads]);

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

          {flattenedThreads.map(({ thread, depth }) => {
            const isActive = thread.id === threadId;
            const isBranch = depth > 0;

            const threadLink =
              resourceType === 'agent'
                ? paths.agentThreadLink(resourceId, thread.id)
                : paths.networkThreadLink(resourceId, thread.id);

            // Calculate padding based on depth (16px per level)
            const paddingLeft = depth * 16;

            return (
              <ThreadItem isActive={isActive} key={thread.id}>
                <ThreadLink as={Link} to={threadLink}>
                  <span className="flex items-center gap-2" style={{ paddingLeft }}>
                    {isBranch && <GitBranch className="h-3 w-3 text-icon3 shrink-0" />}
                    <ThreadTitle title={thread.title} id={thread.id} isBranch={isBranch} />
                  </span>
                  <span style={{ paddingLeft }}>{formatDay(thread.createdAt)}</span>
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

function ThreadTitle({ title, id, isBranch }: { title?: string; id?: string; isBranch?: boolean }) {
  const prefix = isBranch ? 'Branch' : 'Thread';

  if (!title) {
    return null;
  }

  if (isDefaultThreadName(title)) {
    return (
      <span className="text-muted-foreground">
        {prefix} {id ? id.substring(id.length - 5) : null}
      </span>
    );
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
