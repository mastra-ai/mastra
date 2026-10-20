import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image,
  NotepadText,
  RefreshCw,
} from 'lucide-react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryKeys } from '../../../../api/keys';
import type { WorkspaceTreeEntry } from '../../../../api/types';
import { useWorkspaceTree } from '../../../../hooks/use-fs';
import { treeRowContainmentClass } from '../layout';

function getFileIcon(path: string): ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="text-badge-blue-indicator" />;
    case 'json':
      return <FileJson className="text-badge-amber-indicator" />;
    case 'md':
    case 'mdx':
      return <FileText className="text-muted-foreground" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="text-muted-foreground" />;
    default:
      return <File className="text-muted-foreground" />;
  }
}

function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? (
    <FolderOpen className="text-badge-amber-indicator" />
  ) : (
    <Folder className="text-badge-amber-indicator" />
  );
}

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

/** Dotfiles and dot-folders, hidden unless the viewer asks for them. */
function isHidden(entry: WorkspaceTreeEntry): boolean {
  return entry.name.startsWith('.');
}

interface TreeLevelProps {
  workspacePath: string;
  showHidden: boolean;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
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
        </Tree.FolderTrigger>
        <Tree.FolderContent>{isOpen ? <FolderChildren path={entry.path} {...props} /> : null}</Tree.FolderContent>
      </Tree.Folder>
    );
  }

  return (
    <Tree.File id={entry.path} className={treeRowContainmentClass}>
      <Tree.Icon>{getFileIcon(entry.name)}</Tree.Icon>
      <Tree.Label>{entry.name}</Tree.Label>
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
  onBack: () => void;
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
  onBack,
}: WorkspaceFileBrowserProps) {
  const queryClient = useQueryClient();
  const root = useWorkspaceTree(workspacePath, '', { enabled: visible });
  const isRefreshing = useIsFetching({ queryKey: queryKeys.workspaceTreeScope(workspacePath) }) > 0;
  const refresh = () =>
    void queryClient.refetchQueries({ queryKey: queryKeys.workspaceTreeScope(workspacePath), type: 'active' });
  const entries = (root.data?.entries ?? []).filter(entry => showHidden || !isHidden(entry));

  let content: ReactNode;
  if (root.isLoading) {
    content = <Spinner size="sm" />;
  } else if (root.error) {
    content = <TreeMessage tone="error">{root.error.message}</TreeMessage>;
  } else if (root.data && !root.data.available) {
    content = <TreeMessage>The sandbox isn&apos;t running. Send a message to start it.</TreeMessage>;
  } else if (entries.length === 0) {
    content = <TreeMessage>No files</TreeMessage>;
  }

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col" aria-label="Workspace files">
      <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft />
        </Button>
        <NotepadText className="text-muted-foreground" size={14} />
        <Txt tone="ink" as="h2" variant="column">
          Files
        </Txt>
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
                {showHidden ? <Eye /> : <EyeOff />}
              </Button>
            }
          />
          <TooltipContent>{showHidden ? 'Hide hidden files' : 'Show hidden files'}</TooltipContent>
        </Tooltip>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={refresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing workspace files' : 'Refresh workspace files'}
        >
          {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
        </Button>
      </div>
      {content ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">{content}</div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <Tree className="p-1.5" selectedId={selectedFilePath} onSelect={onFileSelect}>
            {entries.map(entry => (
              <WorkspaceTreeItem
                key={entry.path}
                entry={entry}
                workspacePath={workspacePath}
                showHidden={showHidden}
                openFolders={openFolders}
                onFolderOpenChange={onFolderOpenChange}
              />
            ))}
          </Tree>
        </ScrollArea>
      )}
    </aside>
  );
}
