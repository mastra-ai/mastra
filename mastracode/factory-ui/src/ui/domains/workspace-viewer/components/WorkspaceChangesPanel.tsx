import { Button } from '@mastra/playground-ui/components/Button';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeft, ChevronDown, ChevronRight, FileDiff, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';

import type {
  WorkspaceChange,
  WorkspaceChanges,
  WorkspaceChangesRepository,
  WorkspaceChangeStatus,
} from '../../../../api/types';
import { useWorkspaceDiff } from '../../../../hooks/use-fs';
import { GitLabIcon } from '../../../ui/icons';
import { treeRowContainmentClass } from '../layout';

const CodeDiff = lazy(() =>
  import('@mastra/playground-ui/components/CodeDiff').then(({ CodeDiff }) => ({ default: CodeDiff })),
);

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
  modified: 'text-info-indicator!',
  added: 'text-success-indicator!',
  deleted: 'text-destructive-foreground!',
  renamed: 'text-info-indicator!',
  copied: 'text-success-indicator!',
  untracked: 'text-success-indicator!',
  conflicted: 'text-destructive-foreground!',
};
const FOLDER_CLASS = 'text-muted-foreground!';

function ChangeCounts({ additions, deletions, binary }: Pick<WorkspaceChange, 'additions' | 'deletions' | 'binary'>) {
  if (binary) {
    return (
      <Txt as="span" variant="meta" tone="muted" className="shrink-0">
        Binary
      </Txt>
    );
  }
  if (additions === undefined || deletions === undefined) return null;

  return (
    <Txt
      as="span"
      variant="meta"
      font="mono"
      className="flex shrink-0 items-center gap-1 tabular-nums"
      aria-label={`${additions} ${additions === 1 ? 'addition' : 'additions'} and ${deletions} ${
        deletions === 1 ? 'deletion' : 'deletions'
      }`}
    >
      <span className="text-success-indicator">+{additions}</span>
      <span className="text-destructive-foreground">−{deletions}</span>
    </Txt>
  );
}

function ChangesEmptyState({ available }: { available: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
      <Txt tone="muted" variant="caption">
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

function addChange(nodes: ChangeTreeNode[], change: WorkspaceChange, prefix: string) {
  const segments = change.path.slice(prefix.length).split('/').filter(Boolean);
  let siblings = nodes;
  let currentPath = prefix;

  segments.forEach((segment, index) => {
    currentPath = currentPath && !currentPath.endsWith('/') ? `${currentPath}/${segment}` : `${currentPath}${segment}`;
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

/**
 * Build the folder tree of a change list. `prefix` is the repository
 * directory the paths carry in a multi-repository session: it is stripped
 * for display only, every node keeps the prefixed path the routes expect.
 */
function buildChangeTree(changes: WorkspaceChange[], prefix = ''): ChangeTreeNode[] {
  const nodes: ChangeTreeNode[] = [];
  changes.forEach(change => addChange(nodes, change, prefix));
  return sortChangeTree(nodes);
}

export type RepositoryProvider = 'github' | 'gitlab';

/** Source control provider per repository slug, from the factory's linked repositories. */
export type RepositoryProviders = Record<string, RepositoryProvider | undefined>;

interface RepositoryGroupHeaderProps {
  /** What the row names: the repository slug on Changes, the checkout directory on Files. */
  label: string;
  /** Shown before the label when known; the Changes tab passes it, the Files tab does not. */
  provider?: RepositoryProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

/** The collapsible row a repository's files sit under when the session holds several repositories. */
export function RepositoryGroupHeader({ label, provider, open, onOpenChange, children }: RepositoryGroupHeaderProps) {
  return (
    <button
      type="button"
      className="flex min-h-8 w-full items-center gap-1.5 px-2 text-left"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} files in ${label}`}
      data-testid="workspace-repository-group"
      onClick={() => onOpenChange(!open)}
    >
      {open ? (
        <ChevronDown className="text-muted-foreground shrink-0" size={14} />
      ) : (
        <ChevronRight className="text-muted-foreground shrink-0" size={14} />
      )}
      {provider ? (
        <span aria-hidden="true" className="flex shrink-0 items-center" data-testid={`repository-provider-${provider}`}>
          {provider === 'gitlab' ? (
            <GitLabIcon className="text-foreground size-3.5 shrink-0" />
          ) : (
            <GithubIcon className="text-foreground size-3.5 shrink-0" />
          )}
        </span>
      ) : null}
      <Txt as="span" tone="ink" variant="column" font="mono" className="min-w-0 flex-1 truncate">
        {label}
      </Txt>
      {children}
    </button>
  );
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
      <Tree.Label className={cn(colorClass, 'text-body-sm font-mono')}>
        {node.change.previousPath ? `${splitPath(node.change.previousPath).name} → ${node.name}` : node.name}
      </Tree.Label>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <Txt as="span" variant="meta" className={cn('shrink-0', STATUS_CLASSES[node.change.status])}>
          {STATUS_LABELS[node.change.status]}
        </Txt>
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
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to changed files">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <Txt tone="ink" variant="column" font="mono" className="truncate">
            {name}
          </Txt>
          <Txt tone="muted" variant="meta" font="mono" className="truncate">
            {directory || 'Repository root'}
          </Txt>
        </div>
        {change ? (
          <span className="flex shrink-0 items-center gap-2">
            <Txt as="span" variant="meta" className={cn('shrink-0', STATUS_CLASSES[change.status])}>
              {STATUS_LABELS[change.status]}
            </Txt>
            <ChangeCounts {...change} />
          </span>
        ) : null}
        <Button
          size="icon-sm"
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
          <Txt variant="caption" className="text-destructive-foreground">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && patch ? (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <Suspense fallback={<Spinner size="sm" />}>
            <CodeDiff patch={patch} />
          </Suspense>
          {truncated ? (
            <Txt tone="muted" variant="meta" className="block p-3">
              Diff truncated at 512 KB.
            </Txt>
          ) : null}
        </div>
      ) : null}
      {!isLoading && !error && !patch ? <ChangesEmptyState available /> : null}
    </section>
  );
}

interface WorkspaceChangesPanelProps {
  workspacePath: string;
  visible: boolean;
  changes?: WorkspaceChanges;
  /** Provider per repository slug for the group icons; absent while the factory loads (no icon), a slug without one gets the GitHub icon. */
  repositoryProviders?: RepositoryProviders;
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
  repositoryProviders,
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
  const repositories = changes?.repositories && changes.repositories.length > 1 ? changes.repositories : undefined;
  const changeTree = repositories ? [] : buildChangeTree(changes?.changes ?? []);
  const onFolderOpenChange = (path: string, open: boolean) =>
    setOpenFolders(previous => ({ ...previous, [path]: open }));
  const treeSelectedId = view.type === 'list' ? view.selectedPath : undefined;
  const selectForDiff = (path: string) => setView({ type: 'diff', path });

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
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft />
        </Button>
        <FileDiff className="text-muted-foreground" size={14} />
        <Txt tone="ink" as="h2" variant="column">
          Changes
        </Txt>
        {!isLoading && !error ? (
          <Txt tone="muted" variant="meta" className="ml-auto">
            {changes?.changes.length ?? 0} {changes?.changes.length === 1 ? 'file' : 'files'}
          </Txt>
        ) : null}
        {!error && changes?.changes.length ? (
          <ChangeCounts additions={changes.additions} deletions={changes.deletions} />
        ) : null}
        <Button
          className={isLoading || error ? 'ml-auto' : undefined}
          size="icon-sm"
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
          <Txt variant="caption" className="text-destructive-foreground">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && !repositories && changeTree.length === 0 ? (
        <ChangesEmptyState available={changes?.available ?? false} />
      ) : null}
      {!isLoading && !error && !repositories && changeTree.length > 0 ? (
        <ScrollArea className="min-h-0 flex-1">
          <Tree selectedId={treeSelectedId} onSelect={selectForDiff} className="p-2">
            {changeTree.map(node => (
              <ChangeTreeItem
                key={node.path}
                node={node}
                openFolders={openFolders}
                onFolderOpenChange={onFolderOpenChange}
              />
            ))}
          </Tree>
        </ScrollArea>
      ) : null}
      {!isLoading && !error && repositories ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col p-2">
            {repositories.map(repository => (
              <RepositoryChangesGroup
                key={repository.prefix}
                repository={repository}
                provider={
                  repositoryProviders ? (repositoryProviders[repository.slug.toLowerCase()] ?? 'github') : undefined
                }
                open={openFolders[repository.prefix] ?? true}
                onOpenChange={open => onFolderOpenChange(repository.prefix, open)}
                openFolders={openFolders}
                onFolderOpenChange={onFolderOpenChange}
                selectedId={treeSelectedId}
                onSelect={selectForDiff}
              />
            ))}
          </div>
        </ScrollArea>
      ) : null}
    </aside>
  );
}

interface RepositoryChangesGroupProps {
  repository: WorkspaceChangesRepository;
  provider?: RepositoryProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
  selectedId?: string;
  onSelect: (path: string) => void;
}

function RepositoryChangesGroup({
  repository,
  provider,
  open,
  onOpenChange,
  openFolders,
  onFolderOpenChange,
  selectedId,
  onSelect,
}: RepositoryChangesGroupProps) {
  const tree = buildChangeTree(repository.changes, repository.prefix);

  return (
    <section aria-label={`Changes in ${repository.slug}`}>
      <RepositoryGroupHeader label={repository.slug} provider={provider} open={open} onOpenChange={onOpenChange}>
        <Txt as="span" tone="muted" variant="meta" className="shrink-0">
          {!repository.available
            ? 'Unavailable'
            : `${repository.changes.length} ${repository.changes.length === 1 ? 'file' : 'files'}`}
        </Txt>
        {repository.changes.length ? (
          <ChangeCounts additions={repository.additions} deletions={repository.deletions} />
        ) : null}
      </RepositoryGroupHeader>
      {open && tree.length > 0 ? (
        <Tree selectedId={selectedId} onSelect={onSelect} className="pl-2">
          {tree.map(node => (
            <ChangeTreeItem
              key={node.path}
              node={node}
              openFolders={openFolders}
              onFolderOpenChange={onFolderOpenChange}
            />
          ))}
        </Tree>
      ) : null}
    </section>
  );
}
