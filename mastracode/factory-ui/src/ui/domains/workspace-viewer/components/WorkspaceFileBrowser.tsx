import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  ArrowLeft,
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
import type { ReactNode } from 'react';
import { treeRowContainmentClass } from '../layout';

function getFileIcon(path: string): ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="text-notice-info/70" />;
    case 'json':
      return <FileJson className="text-notice-warning/70" />;
    case 'md':
    case 'mdx':
      return <FileText className="text-neutral4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="text-neutral4" />;
    default:
      return <File className="text-neutral4" />;
  }
}

function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? <FolderOpen className="text-notice-warning/70" /> : <Folder className="text-notice-warning/70" />;
}

interface WorkspaceTreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children: WorkspaceTreeNode[];
}

interface WorkspaceFileEntry {
  path: string;
}

function ensureDirectory(nodes: WorkspaceTreeNode[], path: string, name: string): WorkspaceTreeNode {
  const existing = nodes.find(node => node.path === path);
  if (existing) return existing;

  const directory = { path, name, type: 'directory', children: [] } satisfies WorkspaceTreeNode;
  nodes.push(directory);
  return directory;
}

function addFile(nodes: WorkspaceTreeNode[], file: WorkspaceFileEntry) {
  const segments = file.path.split('/').filter(Boolean);
  let siblings = nodes;
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    if (index === segments.length - 1) {
      siblings.push({ path: file.path, name: segment, type: 'file', children: [] });
      return;
    }
    siblings = ensureDirectory(siblings, currentPath, segment).children;
  });
}

function sortTree(nodes: WorkspaceTreeNode[]): WorkspaceTreeNode[] {
  return nodes
    .map(node => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function buildTree(files: WorkspaceFileEntry[]): WorkspaceTreeNode[] {
  const nodes: WorkspaceTreeNode[] = [];
  files.forEach(file => addFile(nodes, file));
  return sortTree(nodes);
}

function WorkspaceTreeItem({
  node,
  openFolders,
  onFolderOpenChange,
}: {
  node: WorkspaceTreeNode;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
}) {
  if (node.type === 'directory') {
    const isOpen = openFolders[node.path] ?? false;
    return (
      <Tree.Folder
        className={treeRowContainmentClass}
        open={isOpen}
        onOpenChange={(open: boolean) => onFolderOpenChange(node.path, open)}
      >
        <Tree.FolderTrigger>
          <Tree.Icon>{getFolderIcon(isOpen)}</Tree.Icon>
          <Tree.Label>{node.name}</Tree.Label>
        </Tree.FolderTrigger>
        <Tree.FolderContent>
          {node.children.map(child => (
            <WorkspaceTreeItem
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
    <Tree.File id={node.path} className={treeRowContainmentClass}>
      <Tree.Icon>{getFileIcon(node.name)}</Tree.Icon>
      <Tree.Label>{node.name}</Tree.Label>
    </Tree.File>
  );
}

interface WorkspaceFileBrowserProps {
  files?: WorkspaceFileEntry[];
  selectedFilePath?: string;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  onRefresh: () => void;
  onFileSelect: (filePath: string) => void;
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
  onBack: () => void;
}

export function WorkspaceFileBrowser({
  files,
  selectedFilePath,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onFileSelect,
  openFolders,
  onFolderOpenChange,
  onBack,
}: WorkspaceFileBrowserProps) {
  const persistedFiles = files ?? [];
  const nodes = buildTree(persistedFiles);

  return (
    <aside className="flex min-h-0 w-full min-w-0 grow flex-col" aria-label="Workspace files">
      <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
        <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft />
        </Button>
        <NotepadText className="text-icon3" size={14} />
        <Txt as="h2" variant="ui-sm" className="text-icon6">
          Files
        </Txt>
        {!isLoading && !error ? (
          <Txt variant="ui-xs" className="text-icon3 ml-auto">
            {persistedFiles.length} {persistedFiles.length === 1 ? 'file' : 'files'}
          </Txt>
        ) : null}
        <Button
          className={isLoading || error ? 'ml-auto' : undefined}
          size="icon-xs"
          variant="ghost"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing workspace files' : 'Refresh workspace files'}
        >
          {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
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
      {!isLoading && !error && nodes.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
          <Txt className="text-icon3" variant="ui-sm">
            No files
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && nodes.length > 0 ? (
        <ScrollArea className="min-h-0 flex-1">
          <Tree className="p-1.5" selectedId={selectedFilePath} onSelect={onFileSelect}>
            {nodes.map(node => (
              <WorkspaceTreeItem
                key={node.path}
                node={node}
                openFolders={openFolders}
                onFolderOpenChange={onFolderOpenChange}
              />
            ))}
          </Tree>
        </ScrollArea>
      ) : null}
    </aside>
  );
}
