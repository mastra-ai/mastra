import type { WorkspaceFileEntry } from '@mastra/client-js';
import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useWorkspaceDirectory } from '../hooks/use-workspace-directory';
import { useWorkspaceContext } from './use-workspace-context';
import { EmptyState } from '@/ds/components/EmptyState';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { ChevronIcon, FileIcon, FolderIcon, Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

const joinPath = (parent: string, name: string) => `${parent.replace(/\/$/, '')}/${name}`;

// Each level indents by one step; kept as a style since depth is unbounded.
const indent = (depth: number) => ({ paddingLeft: `${depth * 12 + 8}px` });

const rowClass =
  'flex items-center gap-1.5 rounded-md py-1 pr-2 text-body-sm text-muted-foreground hover:bg-fill-subtle';

export function WorkspaceTree() {
  const { workspaceId } = useWorkspaceContext();
  const { data, isLoading, isError } = useWorkspaceDirectory(workspaceId, '/');

  if (isLoading) return <TreeSkeleton depth={0} testId="workspace-tree-skeleton" />;
  if (isError) return <EmptyState tone="error" titleSlot="Could not load files" />;
  if (!data?.length) return <EmptyState titleSlot="This workspace is empty" />;

  return (
    <ul role="tree" aria-label="Workspace files" className="flex flex-col py-1">
      {data.map(entry => (
        <TreeNode key={entry.name} entry={entry} path={joinPath('/', entry.name)} depth={0} />
      ))}
    </ul>
  );
}

interface TreeNodeProps {
  entry: WorkspaceFileEntry;
  path: string;
  depth: number;
}

function TreeNode({ entry, path, depth }: TreeNodeProps) {
  return entry.type === 'directory' ? (
    <FolderNode name={entry.name} path={path} depth={depth} />
  ) : (
    <FileNode name={entry.name} path={path} depth={depth} />
  );
}

const activate = (handler: () => void) => ({
  onClick: (event: MouseEvent) => {
    event.stopPropagation();
    handler();
  },
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    handler();
  },
});

function FolderNode({ name, path, depth }: { name: string; path: string; depth: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      role="treeitem"
      aria-label={name}
      aria-expanded={expanded}
      tabIndex={0}
      className="cursor-pointer outline-none focus-visible:[&>div]:ring-1 focus-visible:[&>div]:ring-border-focus"
      {...activate(() => setExpanded(open => !open))}
    >
      <div className={rowClass} style={indent(depth)}>
        <Icon size="sm">
          <ChevronIcon className={cn('transition-transform', !expanded && '-rotate-90')} />
        </Icon>
        <Icon size="sm">
          <FolderIcon />
        </Icon>
        <span className="truncate">{name}</span>
      </div>
      {expanded ? <FolderChildren path={path} depth={depth + 1} /> : null}
    </li>
  );
}

/** Mounted only once its folder is expanded, so unexpanded folders are never listed. */
function FolderChildren({ path, depth }: { path: string; depth: number }) {
  const { workspaceId } = useWorkspaceContext();
  const { data, isLoading, isError } = useWorkspaceDirectory(workspaceId, path);

  if (isLoading) return <TreeSkeleton depth={depth} />;
  if (isError) {
    return (
      <Txt variant="body-sm" tone="muted" className="py-1" style={indent(depth)}>
        Could not load folder
      </Txt>
    );
  }

  return (
    <ul role="group">
      {data?.map(entry => (
        <TreeNode key={entry.name} entry={entry} path={joinPath(path, entry.name)} depth={depth} />
      ))}
    </ul>
  );
}

function FileNode({ name, path, depth }: { name: string; path: string; depth: number }) {
  const { activeFilePath, setActiveFilePath } = useWorkspaceContext();
  const isActive = activeFilePath === path;

  return (
    <li
      role="treeitem"
      aria-label={name}
      aria-selected={isActive}
      tabIndex={0}
      className="cursor-pointer outline-none focus-visible:[&>div]:ring-1 focus-visible:[&>div]:ring-border-focus"
      {...activate(() => setActiveFilePath(path))}
    >
      <div className={cn(rowClass, isActive && 'bg-fill text-foreground')} style={indent(depth)}>
        <Icon size="sm" className="ml-5">
          <FileIcon />
        </Icon>
        <span className="truncate">{name}</span>
      </div>
    </li>
  );
}

function TreeSkeleton({ depth, testId }: { depth: number; testId?: string }) {
  return (
    <div data-testid={testId} aria-busy="true" className="flex flex-col gap-2 py-2" style={indent(depth)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
