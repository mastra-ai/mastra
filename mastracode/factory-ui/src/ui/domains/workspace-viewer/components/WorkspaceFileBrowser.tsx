import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { VirtualTree } from '@mastra/playground-ui/components/VirtualTree';
import { hashKey, useIsFetching, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryKeys } from '../../../../api/keys';
import { WakeSandbox } from './WakeSandbox';
import { useWorkspaceChanges, useWorkspaceTree, useWorkspaceTrees } from '../../../../hooks/use-fs';
import { changeMarks, NO_CHANGE_MARKS } from './files/change-marks';
import type { ChangeMarks } from './files/change-marks';
import { BrowserEntryContent } from './files/BrowserEntryContent';
import { buildBrowserRows, isHidden, isOpenAndShown } from './files/browser-rows';
import type { BrowserFolderListing, BrowserRow } from './files/browser-rows';
import { FileFinderResults } from './files/FileFinderResults';
import { foldersAbove } from './files/folders-above';
import { useFileFinder } from './files/useFileFinder';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconEyeOpen } from '@mastra/playground-ui/icons/central/IconEyeOpen';
import { IconEyeSlash } from '@mastra/playground-ui/icons/central/IconEyeSlash';

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

const PENDING_LISTING: BrowserFolderListing = { isLoading: true };

function changeMarksNotice(changes: UseQueryResult<ChangeMarks>, sandboxRunning: boolean): string | undefined {
  if (changes.isError) return 'Change marks unavailable';
  if (!changes.data) return undefined;
  if (changes.data.unreadable.length > 0) return `Change marks unavailable for ${changes.data.unreadable.join(', ')}`;
  if (!changes.data.read && sandboxRunning) return 'Change marks unavailable';
  return undefined;
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
  query: string;
  onQueryChange: (query: string) => void;
}

/**
 * The session's checkouts, read live from its sandbox one folder at a time.
 * Refresh refetches every folder on screen.
 */
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
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible, select: changeMarks });
  const marks = changes.isError ? NO_CHANGE_MARKS : (changes.data ?? NO_CHANGE_MARKS);
  const root = useWorkspaceTree(workspacePath, '', { enabled: visible });
  const marksNotice = changeMarksNotice(changes, root.data?.available === true);
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceTreeScope(workspacePath) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath), exact: true });
  };
  const openPaths = Object.keys(openFolders).filter(path => isOpenAndShown(path, { open: openFolders, showHidden }));
  const results = useWorkspaceTrees(workspacePath, visible ? openPaths : []);
  const listings = new Map(
    openPaths.map((path, index): [string, BrowserFolderListing] => {
      const result = results[index];
      return [
        path,
        result ? { data: result.data, error: result.error ?? undefined, isLoading: result.isLoading } : PENDING_LISTING,
      ];
    }),
  );
  const rows = buildBrowserRows(entries, { open: openFolders, listings, showHidden });
  // A symlinked folder opens its target and every folder above it.
  const activate = (row: BrowserRow) => {
    if (row.kind !== 'entry') return;
    const { entry } = row;
    if (entry.type !== 'directory') return onFileSelect(entry.path);
    if (entry.linkedPath === undefined) return onFolderOpenChange(entry.path, !row.expanded);
    const segments = entry.linkedPath.split('/');
    segments.forEach((_, i) => onFolderOpenChange(segments.slice(0, i + 1).join('/'), true));
  };

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

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col" aria-label="Workspace files">
      <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
        <SearchInput
          size="sm"
          label="Go to file"
          placeholder="Go to file"
          className="min-w-0 flex-1"
          value={query}
          onValueChange={onQueryChange}
          onFocus={finder.prefetch}
          onKeyDown={finder.onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={finder.showingResults}
          aria-controls={finder.showingResults ? finder.listboxId : undefined}
          aria-activedescendant={finder.showingResults ? finder.optionId(finder.active) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="ml-auto"
                size="icon-sm"
                variant="ghost"
                onClick={() => onShowHiddenChange(!showHidden)}
                aria-pressed={showHidden}
                aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
              >
                {showHidden ? <IconEyeOpen /> : <IconEyeSlash />}
              </Button>
            }
          />
          <TooltipContent>{showHidden ? 'Hide hidden files' : 'Show hidden files'}</TooltipContent>
        </Tooltip>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={refresh}
          aria-label="Refresh workspace files"
          loading={isRefreshing}
        >
          <IconArrowRotateClockwise />
        </Button>
      </div>
      {marksNotice ? (
        <Txt as="p" variant="caption" tone="muted" className="px-3 pb-1 wrap-anywhere">
          {marksNotice}
        </Txt>
      ) : null}
      {finder.finding ? (
        <FileFinderResults workspacePath={workspacePath} finder={finder} changes={marks.files} />
      ) : content ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">{content}</div>
      ) : (
        <VirtualTree
          aria-label="Files"
          rows={rows}
          selectedId={selectedFilePath}
          onActivate={activate}
          onExpandedChange={(row, expanded) => {
            if (row.kind === 'entry') onFolderOpenChange(row.entry.path, expanded);
          }}
          renderRow={row => {
            if (row.kind === 'entry')
              return <BrowserEntryContent entry={row.entry} expanded={row.expanded} marks={marks} />;
            if (row.kind === 'loading') return <Spinner size="sm" />;
            if (row.kind === 'error') return <TreeMessage tone="error">{row.message}</TreeMessage>;
            return <TreeMessage>Empty</TreeMessage>;
          }}
        />
      )}
    </aside>
  );
}
