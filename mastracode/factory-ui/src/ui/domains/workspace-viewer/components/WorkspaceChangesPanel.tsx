import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeft, FileDiff, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { WorkspaceChange, WorkspaceChanges, WorkspaceChangeStatus } from '../../../../api/types';
import { useWorkspaceDiff } from '../../../../hooks/use-fs';
import { WorkspaceDiffLines } from './WorkspaceDiffLines';
import { treeRowContainmentClass } from '../layout';

const STATUS_LABELS: Record<WorkspaceChangeStatus, string> = {
  modified: 'Modified',
  added: 'Added',
  deleted: 'Deleted',
  renamed: 'Renamed',
  copied: 'Copied',
  untracked: 'Untracked',
  conflicted: 'Conflict',
};

const STATUS_CLASSES: Record<WorkspaceChangeStatus, string> = {
  modified: 'text-notice-info/70!',
  added: 'text-notice-success/70!',
  deleted: 'text-notice-destructive/70!',
  renamed: 'text-notice-info/70!',
  copied: 'text-notice-success/70!',
  untracked: 'text-notice-success/70!',
  conflicted: 'text-notice-destructive/70!',
};
const FOLDER_CLASS = 'text-neutral4!';

function ChangeCounts({ additions, deletions, binary }: Pick<WorkspaceChange, 'additions' | 'deletions' | 'binary'>) {
  if (binary) {
    return <span className="text-ui-xs text-icon3 shrink-0 font-medium">Binary</span>;
  }
  if (additions === undefined || deletions === undefined) return null;

  return (
    <span
      className="text-ui-xs flex shrink-0 items-center gap-1 font-mono tabular-nums"
      aria-label={`${additions} ${additions === 1 ? 'addition' : 'additions'} and ${deletions} ${
        deletions === 1 ? 'deletion' : 'deletions'
      }`}
    >
      <span className="text-notice-success/70">+{additions}</span>
      <span className="text-notice-destructive/70">−{deletions}</span>
    </span>
  );
}

function ChangesEmptyState({ available }: { available: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
      <Txt variant="ui-sm" className="text-icon3">
        {available ? 'No changes' : 'No sandbox running. Changes appear once the session sandbox starts.'}
      </Txt>
    </div>
  );
}

function splitPath(path: string) {
  const separator = path.lastIndexOf('/');
  return separator === -1
    ? { name: path, directory: '' }
    : { name: path.slice(separator + 1), directory: path.slice(0, separator) };
}

interface ChangeTreeNode {
  path: string;
  name: string;
  change?: WorkspaceChange;
  children: ChangeTreeNode[];
}

function ensureChangeDirectory(nodes: ChangeTreeNode[], path: string, name: string): ChangeTreeNode {
  const existing = nodes.find(node => node.path === path);
  if (existing) return existing;

  const directory = { path, name, children: [] } satisfies ChangeTreeNode;
  nodes.push(directory);
  return directory;
}

function addChange(nodes: ChangeTreeNode[], change: WorkspaceChange) {
  const segments = change.path.split('/').filter(Boolean);
  let siblings = nodes;
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    if (index === segments.length - 1) {
      siblings.push({ path: change.path, name: segment, change, children: [] });
      return;
    }

    const directory = ensureChangeDirectory(siblings, currentPath, segment);
    siblings = directory.children;
  });
}

function compactChangeTree(node: ChangeTreeNode): ChangeTreeNode {
  let compacted = { ...node, children: sortChangeTree(node.children) };
  while (!compacted.change && compacted.children.length === 1 && !compacted.children[0]?.change) {
    const child = compacted.children[0]!;
    compacted = {
      path: child.path,
      name: `${compacted.name}/${child.name}`,
      children: child.children,
    };
  }
  return compacted;
}

function sortChangeTree(nodes: ChangeTreeNode[]): ChangeTreeNode[] {
  return nodes.map(compactChangeTree).sort((a, b) => {
    if (Boolean(a.change) !== Boolean(b.change)) return a.change ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function buildChangeTree(changes: WorkspaceChange[]): ChangeTreeNode[] {
  const nodes: ChangeTreeNode[] = [];
  changes.forEach(change => addChange(nodes, change));
  return sortChangeTree(nodes);
}

interface ChangeTreeItemProps {
  node: ChangeTreeNode;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
}

function ChangeTreeItem({ node, openFolders, onFolderOpenChange }: ChangeTreeItemProps) {
  const colorClass = node.change ? STATUS_CLASSES[node.change.status] : FOLDER_CLASS;

  if (!node.change) {
    const isOpen = openFolders[node.path] ?? true;
    return (
      <Tree.Folder
        className={treeRowContainmentClass}
        open={isOpen}
        onOpenChange={(open: boolean) => onFolderOpenChange(node.path, open)}
      >
        <Tree.FolderTrigger>
          <Tree.Icon>{isOpen ? <FolderOpen className={colorClass} /> : <Folder className={colorClass} />}</Tree.Icon>
          <Tree.Label className={colorClass}>{node.name}</Tree.Label>
        </Tree.FolderTrigger>
        <Tree.FolderContent>
          {node.children.map(child => (
            <ChangeTreeItem
              key={child.path}
              node={child}
              openFolders={openFolders}
              onFolderOpenChange={onFolderOpenChange}
            />
          ))}
        </Tree.FolderContent>
      </Tree.Folder>
    );
  }

  return (
    <Tree.File id={node.change.path} className={treeRowContainmentClass}>
      <Tree.Icon>
        <FileDiff className={colorClass} />
      </Tree.Icon>
      <Tree.Label className={cn('font-mono', colorClass)}>
        {node.change.previousPath ? `${splitPath(node.change.previousPath).name} → ${node.name}` : node.name}
      </Tree.Label>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span className={cn('text-ui-xs shrink-0 font-medium', STATUS_CLASSES[node.change.status])}>
          {STATUS_LABELS[node.change.status]}
        </span>
        <ChangeCounts {...node.change} />
      </span>
    </Tree.File>
  );
}

interface DiffViewerProps {
  selectedPath: string;
  change?: WorkspaceChange;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  patch?: string;
  truncated?: boolean;
  onBack: () => void;
  onRefresh: () => void;
}

function DiffViewer({
  selectedPath,
  change,
  isLoading,
  isRefreshing,
  error,
  patch,
  truncated,
  onBack,
  onRefresh,
}: DiffViewerProps) {
  const { name, directory } = splitPath(selectedPath);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Workspace change diff">
      <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
        <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Back to changed files">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <Txt variant="ui-sm" font="mono" className="text-icon6 truncate font-medium">
            {name}
          </Txt>
          <Txt variant="ui-xs" font="mono" className="text-icon3 truncate">
            {directory || 'Repository root'}
          </Txt>
        </div>
        {change ? (
          <span className="flex shrink-0 items-center gap-2">
            <span className={cn('text-ui-xs shrink-0 font-medium', STATUS_CLASSES[change.status])}>
              {STATUS_LABELS[change.status]}
            </span>
            <ChangeCounts {...change} />
          </span>
        ) : null}
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing selected diff' : 'Refresh selected diff'}
        >
          {isRefreshing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
        </Button>
      </div>
      {isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : null}
      {error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
          <Txt variant="ui-sm" className="text-error">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && patch ? (
        <ScrollArea className="min-h-0 flex-1 font-mono text-xs leading-5">
          <WorkspaceDiffLines patch={patch} truncated={truncated} />
        </ScrollArea>
      ) : null}
      {!isLoading && !error && !patch ? <ChangesEmptyState available /> : null}
    </section>
  );
}

interface WorkspaceChangesPanelProps {
  workspacePath: string;
  visible: boolean;
  changes?: WorkspaceChanges;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  onRefresh: () => void;
  onBack: () => void;
}

type WorkspaceChangesView = { type: 'list'; selectedPath?: string } | { type: 'diff'; path: string };

export function WorkspaceChangesPanel({
  workspacePath,
  visible,
  changes,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onBack,
}: WorkspaceChangesPanelProps) {
  const [view, setView] = useState<WorkspaceChangesView>({ type: 'list' });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const requestedPath = view.type === 'diff' ? view.path : undefined;
  const selectedChange = changes?.changes.find(change => change.path === requestedPath);
  const selectedPath = selectedChange?.path;
  const diff = useWorkspaceDiff(workspacePath, selectedPath, selectedChange?.previousPath, { enabled: visible });
  const selectedDiff = diff.data?.path === selectedPath ? diff.data : undefined;
  const changeTree = buildChangeTree(changes?.changes ?? []);

  if (selectedPath) {
    return (
      <div className="flex min-h-0 w-full min-w-0 grow" data-testid="workspace-changes-panel">
        <DiffViewer
          selectedPath={selectedPath}
          change={selectedChange}
          isLoading={diff.isLoading || (diff.isFetching && !selectedDiff)}
          isRefreshing={diff.isFetching}
          error={diff.error ?? undefined}
          patch={selectedDiff?.patch}
          truncated={selectedDiff?.truncated}
          onBack={() => setView({ type: 'list', selectedPath })}
          onRefresh={() => diff.refetch()}
        />
      </div>
    );
  }

  return (
    <aside
      className="flex min-h-0 min-w-0 grow flex-col"
      aria-label="Workspace changes"
      data-testid="workspace-changes-panel"
    >
      <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
        <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft />
        </Button>
        <FileDiff className="text-icon3" size={14} />
        <Txt as="h2" variant="ui-sm" className="text-icon6">
          Changes
        </Txt>
        {!isLoading && !error ? (
          <Txt variant="ui-xs" className="text-icon3 ml-auto">
            {changes?.changes.length ?? 0} {changes?.changes.length === 1 ? 'file' : 'files'}
          </Txt>
        ) : null}
        {!error && changes?.changes.length ? (
          <ChangeCounts additions={changes.additions} deletions={changes.deletions} />
        ) : null}
        <Button
          className={isLoading || error ? 'ml-auto' : undefined}
          size="icon-xs"
          variant="ghost"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing changes' : 'Refresh changes'}
        >
          {isRefreshing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
        </Button>
      </div>
      {isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : null}
      {error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
          <Txt variant="ui-sm" className="text-error">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && changeTree.length === 0 ? (
        <ChangesEmptyState available={changes?.available ?? false} />
      ) : null}
      {!isLoading && !error && changeTree.length > 0 ? (
        <ScrollArea className="min-h-0 flex-1">
          <Tree
            selectedId={view.type === 'list' ? view.selectedPath : undefined}
            onSelect={path => setView({ type: 'diff', path })}
            className="p-2"
          >
            {changeTree.map(node => (
              <ChangeTreeItem
                key={node.path}
                node={node}
                openFolders={openFolders}
                onFolderOpenChange={(path, open) => setOpenFolders(previous => ({ ...previous, [path]: open }))}
              />
            ))}
          </Tree>
        </ScrollArea>
      ) : null}
    </aside>
  );
}
