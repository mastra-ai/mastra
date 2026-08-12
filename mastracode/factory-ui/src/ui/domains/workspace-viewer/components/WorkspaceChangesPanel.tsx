import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowLeft, FileDiff, Folder, FolderOpen, Maximize2, Minimize2, NotepadText, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { WorkspaceChange, WorkspaceChangeStatus } from '../../../../api/types';
import { useWorkspaceChanges, useWorkspaceDiff } from '../../../../hooks/use-fs';
import { WorkspacePreviewDrawer } from './WorkspacePreviewDrawer';

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

interface ParsedDiffLine {
  line: string;
  oldNumber?: number;
  newNumber?: number;
}

function parseDiff(patch: string): ParsedDiffLine[] {
  let oldNumber: number | undefined;
  let newNumber: number | undefined;
  let inHunk = false;
  const parsedLines: ParsedDiffLine[] = [];

  for (const line of patch.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      inHunk = true;
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      parsedLines.push({ line });
      continue;
    }
    if (
      !inHunk &&
      (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ '))
    ) {
      continue;
    }
    if (line.startsWith('+')) {
      parsedLines.push({ line, newNumber });
      if (newNumber !== undefined) newNumber += 1;
      continue;
    }
    if (line.startsWith('-')) {
      parsedLines.push({ line, oldNumber });
      if (oldNumber !== undefined) oldNumber += 1;
      continue;
    }
    if (line.startsWith('\\')) {
      parsedLines.push({ line });
      continue;
    }

    parsedLines.push({ line, oldNumber, newNumber });
    if (oldNumber !== undefined) oldNumber += 1;
    if (newNumber !== undefined) newNumber += 1;
  }

  return parsedLines;
}

function DiffLine({ line, oldNumber, newNumber }: ParsedDiffLine) {
  const isHunk = line.startsWith('@@');
  const isAdded = line.startsWith('+');
  const isRemoved = line.startsWith('-');
  const className = isAdded
    ? 'bg-notice-success/10 text-icon6'
    : isRemoved
      ? 'bg-notice-destructive/10 text-icon6'
      : isHunk
        ? 'bg-surface3 text-accent1'
        : 'text-icon6';

  return (
    <div className={`${className} flex w-full min-w-0`}>
      <span className="border-border1 text-icon2 inline-block w-11 shrink-0 border-r px-2 text-right select-none">
        {oldNumber}
      </span>
      <span className="border-border1 text-icon2 inline-block w-11 shrink-0 border-r px-2 text-right select-none">
        {newNumber}
      </span>
      <span className="min-w-0 flex-1 px-3 break-words whitespace-pre-wrap">{line || ' '}</span>
    </div>
  );
}

function ChangesEmptyState({ available }: { available: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <FileDiff className="text-icon3" size={24} />
      <Txt variant="ui-sm" className="text-icon5">
        {available ? 'No pending changes' : 'Changes will appear after the session workspace is created.'}
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

function ChangeTreeItem({
  node,
  openFolders,
  onFolderOpenChange,
}: {
  node: ChangeTreeNode;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
}) {
  const colorClass = node.change ? STATUS_CLASSES[node.change.status] : FOLDER_CLASS;

  if (!node.change) {
    const isOpen = openFolders[node.path] ?? true;
    return (
      <Tree.Folder open={isOpen} onOpenChange={(open: boolean) => onFolderOpenChange(node.path, open)}>
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
    <Tree.File id={node.change.path}>
      <Tree.Icon>
        <FileDiff className={colorClass} />
      </Tree.Icon>
      <Tree.Label className={`font-mono ${colorClass}`}>
        {node.change.previousPath ? `${splitPath(node.change.previousPath).name} → ${node.name}` : node.name}
      </Tree.Label>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span className={`text-ui-xs shrink-0 font-medium ${STATUS_CLASSES[node.change.status]}`}>
          {STATUS_LABELS[node.change.status]}
        </span>
        <ChangeCounts {...node.change} />
      </span>
    </Tree.File>
  );
}

function DiffViewer({
  selectedPath,
  change,
  isLoading,
  isRefreshing,
  isFullscreen,
  error,
  patch,
  truncated,
  onBack,
  onRefresh,
  onFullscreenChange,
}: {
  selectedPath: string;
  change?: WorkspaceChange;
  isLoading: boolean;
  isRefreshing: boolean;
  isFullscreen: boolean;
  error?: Error;
  patch?: string;
  truncated?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
}) {
  const { name, directory } = splitPath(selectedPath);

  return (
    <section className="bg-surface1 flex h-full min-w-0 flex-1 flex-col" aria-label="Workspace change diff">
      <div className="border-border1 flex items-center gap-2 border-b px-2 py-2 pr-12 lg:pr-2">
        <Button
          size="icon-sm"
          variant="ghost"
          className="lg:hidden"
          onClick={onBack}
          aria-label="Back to changed files"
        >
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
            <span className={`text-ui-xs shrink-0 font-medium ${STATUS_CLASSES[change.status]}`}>
              {STATUS_LABELS[change.status]}
            </span>
            <ChangeCounts {...change} />
          </span>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip={isFullscreen ? 'Exit full screen' : 'Review changes full screen'}
          onClick={() => onFullscreenChange(!isFullscreen)}
          aria-label={isFullscreen ? 'Exit full-screen changes viewer' : 'Open full-screen changes viewer'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </Button>
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
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto font-mono text-xs leading-5">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : error ? (
          <div className="p-4">
            <Txt variant="ui-sm" className="text-error">
              {error.message}
            </Txt>
          </div>
        ) : patch ? (
          <>
            {parseDiff(patch).map((parsedLine, index) => (
              <DiffLine key={index} {...parsedLine} />
            ))}
            {truncated ? (
              <Txt variant="ui-xs" className="text-icon3 block p-3">
                Diff truncated at 512 KB.
              </Txt>
            ) : null}
          </>
        ) : (
          <ChangesEmptyState available />
        )}
      </div>
    </section>
  );
}

export function WorkspaceChangesPanel({
  workspacePath,
  onShowFiles,
  visible,
}: {
  workspacePath: string;
  onShowFiles: () => void;
  visible: boolean;
}) {
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible });
  const selectedChange = changes.data?.changes.find(change => change.path === selectedPath);
  const diff = useWorkspaceDiff(workspacePath, selectedPath, selectedChange?.previousPath, { enabled: visible });
  const selectedDiff = diff.data?.path === selectedPath ? diff.data : undefined;
  const changeTree = buildChangeTree(changes.data?.changes ?? []);

  const selectPath = (path: string) => {
    setSelectedPath(path);
  };
  const showList = () => {
    setSelectedPath(undefined);
    setIsFullscreen(false);
  };

  const content = (
    <div className="bg-surface1 flex h-full w-full min-w-0" data-testid="workspace-changes-panel">
      {selectedPath ? (
        <DiffViewer
          key={selectedPath}
          selectedPath={selectedPath}
          change={selectedChange}
          isLoading={diff.isLoading || (diff.isFetching && !selectedDiff)}
          isRefreshing={diff.isFetching}
          isFullscreen={isFullscreen}
          error={diff.error instanceof Error ? diff.error : undefined}
          patch={selectedDiff?.patch}
          truncated={selectedDiff?.truncated}
          onBack={showList}
          onRefresh={() => diff.refetch()}
          onFullscreenChange={setIsFullscreen}
        />
      ) : null}
      {selectedPath ? <div className="bg-border1 hidden w-px shrink-0 lg:block" /> : null}
      <aside
        className={
          selectedPath
            ? 'bg-surface1 hidden h-full w-80 min-w-0 shrink-0 flex-col lg:flex'
            : 'bg-surface1 flex h-full min-w-0 flex-1 flex-col'
        }
        aria-label="Workspace changes"
      >
        <div
          className={`border-border1 flex items-center justify-between gap-2 border-b px-3 py-2 ${selectedPath ? 'pr-12' : 'lg:pr-12'}`}
        >
          <Tabs<'files' | 'changes'>
            defaultTab="changes"
            value="changes"
            onValueChange={value => {
              if (value === 'files') onShowFiles();
            }}
          >
            <TabList variant="pill-ghost">
              <Tab value="files">
                <NotepadText size={14} />
                Files
              </Tab>
              <Tab value="changes">
                <FileDiff size={14} />
                Changes{changes.data ? ` (${changes.data.changes.length})` : ''}
              </Tab>
            </TabList>
          </Tabs>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => changes.refetch()}
            disabled={changes.isFetching}
            aria-label={changes.isFetching ? 'Refreshing changes' : 'Refresh changes'}
          >
            {changes.isFetching ? <Spinner size="sm" /> : <RefreshCw size={14} />}
          </Button>
        </div>
        {changes.data?.changes.length ? (
          <div className="border-border1 flex items-center justify-between gap-3 border-b px-3 py-2">
            <Txt variant="ui-xs" className="text-icon3">
              {changes.data.changes.length} {changes.data.changes.length === 1 ? 'file' : 'files'} changed
            </Txt>
            <ChangeCounts additions={changes.data.additions} deletions={changes.data.deletions} />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {changes.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : changes.error instanceof Error ? (
            <div className="p-4">
              <Txt variant="ui-sm" className="text-error">
                {changes.error.message}
              </Txt>
            </div>
          ) : changeTree.length ? (
            <Tree selectedId={selectedPath} onSelect={selectPath} className="p-2">
              {changeTree.map(node => (
                <ChangeTreeItem
                  key={node.path}
                  node={node}
                  openFolders={openFolders}
                  onFolderOpenChange={(path, open) => setOpenFolders(previous => ({ ...previous, [path]: open }))}
                />
              ))}
            </Tree>
          ) : (
            <ChangesEmptyState available={changes.data?.available ?? false} />
          )}
        </div>
      </aside>
    </div>
  );

  if (!selectedPath) return content;

  return (
    <WorkspacePreviewDrawer
      title={selectedPath}
      description="Review pending changes in the session workspace."
      open
      expanded={isFullscreen}
      onClose={showList}
    >
      {content}
    </WorkspacePreviewDrawer>
  );
}
