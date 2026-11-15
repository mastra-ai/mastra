import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Eye, EyeOff, FolderSymlink, RefreshCw } from 'lucide-react';
import { cn } from '@mastra/playground-ui/utils/cn';
import { hashKey, useIsFetching, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryKeys } from '../../../../api/keys';
import { WakeSandbox } from './WakeSandbox';
import type { WorkspaceTreeEntry } from '../../../../api/types';
import { useWorkspaceChanges, useWorkspaceTree } from '../../../../hooks/use-fs';
import { treeRowContainmentClass } from '../layout';
import { CHANGE_STATUSES } from './changes/change-statuses';
import { ChangeStatusLetter } from './changes/ChangeStatusLetter';
import { changeMarks, NO_CHANGE_MARKS } from './files/change-marks';
import type { ChangeMarks } from './files/change-marks';
import { getFileIcon, getFolderIcon } from './files/file-icons';
import { FileFinderResults } from './files/FileFinderResults';
import { foldersAbove } from './files/folders-above';
import { useFileFinder } from './files/useFileFinder';

function TreeMessage({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <Txt
      as="span"
      variant="caption"
      tone={tone === 'muted' ? 'muted' : undefined}
      className={tone === 'error' ? 'text-destructive-foreground' : undefined}
    >
      {children}
    </Txt>
  );
}

/** Tree ids for symlinked folders, which jump to their target instead of expanding. */
const FOLDER_LINK_ID = 'folder-link:';

/** `→ target` after a symlink's name. */
function LinkTarget({ target }: { target?: string }) {
  if (!target) return null;
  return (
    <Txt as="span" variant="caption" tone="muted" className="ml-1.5 truncate">
      → {target}
    </Txt>
  );
}

/** Dotfiles and dot-folders, hidden unless the viewer asks for them. */
function isHidden(entry: WorkspaceTreeEntry): boolean {
  return entry.name.startsWith('.');
}

interface TreeLevelProps {
  workspacePath: string;
  showHidden: boolean;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
  marks: ChangeMarks;
}

/** The contents of one open folder: fetched only once it is open. */
function FolderChildren({ path, ...props }: TreeLevelProps & { path: string }) {
  const listing = useWorkspaceTree(props.workspacePath, path);
  if (listing.isLoading) {
    return (
      <li className="px-2 py-1">
        <Spinner size="sm" />
      </li>
    );
  }
  if (listing.error) {
    return (
      <li className="px-2 py-1">
        <TreeMessage tone="error">{listing.error.message}</TreeMessage>
      </li>
    );
  }
  const entries = (listing.data?.entries ?? []).filter(entry => props.showHidden || !isHidden(entry));
  if (entries.length === 0) {
    return (
      <li className="px-2 py-1">
        <TreeMessage>Empty</TreeMessage>
      </li>
    );
  }
  return entries.map(entry => <WorkspaceTreeItem key={entry.path} entry={entry} {...props} />);
}

function WorkspaceTreeItem({ entry, ...props }: TreeLevelProps & { entry: WorkspaceTreeEntry }) {
  if (entry.type === 'directory' && entry.linkedPath !== undefined) {
    return (
      <Tree.File id={`${FOLDER_LINK_ID}${entry.linkedPath}`} className={treeRowContainmentClass}>
        <Tree.Icon>
          <FolderSymlink className="text-badge-amber-indicator" />
        </Tree.Icon>
        <Tree.Label>
          {entry.name}
          <LinkTarget target={entry.symlinkTarget} />
        </Tree.Label>
      </Tree.File>
    );
  }
  if (entry.type === 'directory') {
    const isOpen = props.openFolders[entry.path] ?? false;
    return (
      <Tree.Folder
        className={treeRowContainmentClass}
        open={isOpen}
        onOpenChange={(open: boolean) => props.onFolderOpenChange(entry.path, open)}
      >
        <Tree.FolderTrigger>
          <Tree.Icon>{getFolderIcon(isOpen)}</Tree.Icon>
          <Tree.Label>{entry.name}</Tree.Label>
          {props.marks.folders.has(entry.path) ? (
            <span
              role="img"
              aria-label="Holds branch changes"
              title="Holds branch changes"
              className={cn(
                'mr-1.5 ml-auto size-1.5 shrink-0 rounded-full bg-current',
                CHANGE_STATUSES.modified.className,
              )}
            />
          ) : null}
        </Tree.FolderTrigger>
        <Tree.FolderContent>{isOpen ? <FolderChildren path={entry.path} {...props} /> : null}</Tree.FolderContent>
      </Tree.Folder>
    );
  }

  const status = props.marks.files.get(entry.path);
  return (
    <Tree.File id={entry.path} className={treeRowContainmentClass}>
      <Tree.Icon>{getFileIcon(entry.name)}</Tree.Icon>
      <Tree.Label>
        {entry.name}
        <LinkTarget target={entry.symlinkTarget} />
      </Tree.Label>
      {status ? <ChangeStatusLetter status={status} /> : null}
    </Tree.File>
  );
}

interface WorkspaceFileBrowserProps {
  workspacePath: string;
  visible?: boolean;
  selectedFilePath?: string;
  onFileSelect: (filePath: string) => void;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
  showHidden: boolean;
  onShowHiddenChange: (showHidden: boolean) => void;
  /** Lifted to the panel so coming back from a file finds the same results. */
  query: string;
  onQueryChange: (query: string) => void;
}

export function WorkspaceFileBrowser({
  workspacePath,
  visible = true,
  selectedFilePath,
  onFileSelect,
  openFolders,
  onFolderOpenChange,
  showHidden,
  onShowHiddenChange,
  query,
  onQueryChange,
}: WorkspaceFileBrowserProps) {
  const queryClient = useQueryClient();
  const marks = useWorkspaceChanges(workspacePath, { enabled: visible, select: changeMarks }).data ?? NO_CHANGE_MARKS;
  const root = useWorkspaceTree(workspacePath, '', { enabled: visible });
  const indexHash = hashKey(queryKeys.workspaceFileIndex(workspacePath));
  const entries = (root.data?.entries ?? []).filter(entry => showHidden || !isHidden(entry));
  const openFound = (path: string) => {
    if (!showHidden && path.split('/').some(segment => segment.startsWith('.'))) onShowHiddenChange(true);
    foldersAbove(path).forEach(folder => onFolderOpenChange(folder, true));
    onFileSelect(path);
  };
  const finder = useFileFinder({ workspacePath, visible, query, onQueryChange, boost: marks.files, onOpen: openFound });
  // The index refetches with the tree, but only shows while finding.
  const isRefreshing =
    useIsFetching({
      queryKey: queryKeys.workspaceTreeScope(workspacePath),
      predicate: query => finder.finding || query.queryHash !== indexHash,
    }) > 0;
  const refresh = () => {
    void queryClient.refetchQueries({ queryKey: queryKeys.workspaceTreeScope(workspacePath), type: 'active' });
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath), exact: true });
  };
  // A symlinked folder opens its target and every folder above it.
  const select = (id: string) => {
    if (!id.startsWith(FOLDER_LINK_ID)) return onFileSelect(id);
    const target = id.slice(FOLDER_LINK_ID.length);
    [...foldersAbove(target), target].forEach(folder => onFolderOpenChange(folder, true));
  };
  const { showingResults } = finder;

  let content: ReactNode;
  if (root.isLoading) {
    content = <Spinner size="sm" />;
  } else if (root.error) {
    content = <TreeMessage tone="error">{root.error.message}</TreeMessage>;
  } else if (root.data && !root.data.available) {
    content = <WakeSandbox workspacePath={workspacePath} />;
  } else if (entries.length === 0) {
    content = <TreeMessage>No files</TreeMessage>;
  }

  let body: ReactNode;
  if (finder.finding) {
    body = <FileFinderResults workspacePath={workspacePath} finder={finder} changes={marks.files} />;
  } else if (content) {
    body = <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">{content}</div>;
  } else {
    body = (
      <ScrollArea className="min-h-0 flex-1">
        <Tree className="p-1.5" selectedId={selectedFilePath} onSelect={select}>
          {entries.map(entry => (
            <WorkspaceTreeItem
              key={entry.path}
              entry={entry}
              workspacePath={workspacePath}
              showHidden={showHidden}
              openFolders={openFolders}
              onFolderOpenChange={onFolderOpenChange}
              marks={marks}
            />
          ))}
        </Tree>
      </ScrollArea>
    );
  }

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col" aria-label="Workspace files">
      <div className="border-border flex min-h-10 items-center gap-0.5 border-b px-1.5 py-1">
        <SearchInput
          size="sm"
          label="Go to file"
          placeholder="Go to file"
          className="mr-1 min-w-0 flex-1"
          value={query}
          onValueChange={onQueryChange}
          onFocus={finder.prefetch}
          onKeyDown={finder.onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showingResults}
          aria-controls={showingResults ? finder.listboxId : undefined}
          aria-activedescendant={showingResults ? finder.optionId(finder.active) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onShowHiddenChange(!showHidden)}
                aria-pressed={showHidden}
                aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
              >
                {showHidden ? <Eye /> : <EyeOff />}
              </Button>
            }
          />
          <TooltipContent>{showHidden ? 'Hide hidden files' : 'Show hidden files'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label={isRefreshing ? 'Refreshing workspace files' : 'Refresh workspace files'}
              >
                {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
              </Button>
            }
          />
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>
      {body}
    </aside>
  );
}
