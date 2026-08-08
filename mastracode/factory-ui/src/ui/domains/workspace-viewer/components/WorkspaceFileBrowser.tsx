import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  File,
  FileCode,
  FileDiff,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image,
  NotepadText,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

function getFileIcon(path: string): ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="text-blue-400" />;
    case 'json':
      return <FileJson className="text-yellow-400" />;
    case 'md':
    case 'mdx':
      return <FileText className="text-neutral4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="text-purple-400" />;
    default:
      return <File className="text-neutral4" />;
  }
}

function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? <FolderOpen className="text-amber-400" /> : <Folder className="text-amber-400" />;
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
  return [...nodes.map(node => ({ ...node, children: sortTree(node.children) }))].sort((a, b) => {
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
      <Tree.Folder open={isOpen} onOpenChange={(open: boolean) => onFolderOpenChange(node.path, open)}>
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
    <Tree.File id={node.path}>
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
  onShowChanges: () => void;
}

export function WorkspaceFileBrowser({
  files,
  selectedFilePath,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onFileSelect,
  onShowChanges,
}: WorkspaceFileBrowserProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const persistedFiles = files ?? [];
  const filePaths = new Set(persistedFiles.map(file => file.path));
  const nodes = buildTree(persistedFiles);

  const setFolderOpen = (path: string, open: boolean) => {
    setOpenFolders(previous => ({ ...previous, [path]: open }));
  };

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col" aria-label="Workspace files">
      <div className="border-border1 flex items-center border-b px-3 py-2">
        <Tabs<'files' | 'changes'>
          defaultTab="files"
          value="files"
          onValueChange={value => {
            if (value === 'changes') onShowChanges();
          }}
        >
          <TabList variant="pill-ghost">
            <Tab value="files">
              <NotepadText size={14} />
              Files
            </Tab>
            <Tab value="changes">
              <FileDiff size={14} />
              Changes
            </Tab>
          </TabList>
        </Tabs>
        <Button
          className="ml-auto"
          size="icon-xs"
          variant="ghost"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing workspace files' : 'Refresh workspace files'}
        >
          {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Tree
          selectedId={selectedFilePath}
          onSelect={id => {
            if (filePaths.has(id)) onFileSelect(id);
          }}
        >
          {isLoading ? <Txt className="text-icon3 px-2 py-3">Loading files…</Txt> : null}
          {error ? <Txt className="text-icon4 px-2 py-3">Unable to load files.</Txt> : null}
          {!isLoading && !error && nodes.length === 0 ? (
            <Txt className="text-icon3 px-2 py-3" variant="ui-sm">
              No files captured for this run yet.
            </Txt>
          ) : null}
          {!isLoading && !error
            ? nodes.map(node => (
                <WorkspaceTreeItem
                  key={node.path}
                  node={node}
                  openFolders={openFolders}
                  onFolderOpenChange={setFolderOpen}
                />
              ))
            : null}
        </Tree>
      </div>
    </aside>
  );
}
