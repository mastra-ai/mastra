import { Button } from '@mastra/playground-ui/components/Button';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { File, FileCode, FileJson, FileText, Folder, FolderOpen, Image, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { WorkspaceRenderedEntry, WorkspaceRenderedListing } from '../../../../../shared/api/types';
import type { RenderedWorkspacePath } from '../config';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

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
  type: WorkspaceRenderedEntry['type'];
  size: number;
  children: WorkspaceTreeNode[];
}

function ensureDirectory(nodes: WorkspaceTreeNode[], path: string, name: string): WorkspaceTreeNode {
  const existing = nodes.find(node => node.path === path);
  if (existing) return existing;

  const directory = { path, name, type: 'directory', size: 0, children: [] } satisfies WorkspaceTreeNode;
  nodes.push(directory);
  return directory;
}

function addEntry(nodes: WorkspaceTreeNode[], entry: WorkspaceRenderedEntry) {
  const segments = entry.path.split('/').filter(Boolean);
  let siblings = nodes;
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const isLeaf = index === segments.length - 1;

    if (isLeaf) {
      const existing = siblings.find(node => node.path === currentPath);
      const node = {
        path: entry.path,
        name: segment,
        type: entry.type,
        size: entry.size,
        children: existing?.children ?? [],
      };
      const existingIndex = siblings.findIndex(item => item.path === currentPath);
      if (existingIndex === -1) siblings.push(node);
      else siblings[existingIndex] = node;
      return;
    }

    const directory = ensureDirectory(siblings, currentPath, segment);
    siblings = directory.children;
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

function buildTree(entries: WorkspaceRenderedEntry[]): WorkspaceTreeNode[] {
  const nodes: WorkspaceTreeNode[] = [];
  entries.forEach(entry => addEntry(nodes, entry));
  return sortTree(nodes);
}

function emptyStateCopy(path: RenderedWorkspacePath) {
  if (path.root === '.artifacts') return 'No artifacts yet. Session files created will appear here.';
  return `No files in ${path.label}.`;
}

function WorkspaceTreeItem({
  node,
  root,
  openFolders,
  onFolderOpenChange,
}: {
  node: WorkspaceTreeNode;
  root: string;
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
              root={root}
              openFolders={openFolders}
              onFolderOpenChange={onFolderOpenChange}
            />
          ))}
        </Tree.FolderContent>
      </Tree.Folder>
    );
  }

  return (
    <Tree.File id={`${root}/${node.path}`}>
      <Tree.Icon>{getFileIcon(node.name)}</Tree.Icon>
      <Tree.Label>{node.name}</Tree.Label>
      <span className="ml-auto shrink-0 text-xs text-icon3">{formatBytes(node.size)}</span>
    </Tree.File>
  );
}

interface WorkspaceFileBrowserProps {
  renderedPaths: RenderedWorkspacePath[];
  selectedPath: RenderedWorkspacePath;
  selectedFilePath?: string;
  listing?: WorkspaceRenderedListing;
  isLoading: boolean;
  error?: Error;
  onRenderedPathChange: (path: RenderedWorkspacePath) => void;
  onFileSelect: (filePath: string) => void;
  onRefresh: () => void;
}

export function WorkspaceFileBrowser({
  renderedPaths,
  selectedPath,
  selectedFilePath,
  listing,
  isLoading,
  error,
  onRenderedPathChange,
  onFileSelect,
  onRefresh,
}: WorkspaceFileBrowserProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const nodes = buildTree(listing?.entries ?? []);

  const setFolderOpen = (path: string, open: boolean) => {
    setOpenFolders(previous => ({ ...previous, [path]: open }));
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col rounded-xl bg-surface3" aria-label="Workspace files">
      <div className="flex items-center justify-end gap-2 px-3 py-2 lg:pr-12">
        <Button size="sm" variant="ghost" onClick={onRefresh} aria-label="Refresh workspace files">
          <RefreshCw size={14} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Tree
          selectedId={selectedFilePath ? `${selectedPath.root}/${selectedFilePath}` : undefined}
          onSelect={id => {
            const selectedRootPrefix = `${selectedPath.root}/`;
            if (id.startsWith(selectedRootPrefix)) onFileSelect(id.slice(selectedRootPrefix.length));
          }}
        >
          {renderedPaths.map(path => {
            const isSelectedRoot = path.id === selectedPath.id;
            const isOpen = openFolders[path.root] ?? false;
            return (
              <Tree.Folder
                key={path.id}
                open={isOpen}
                onOpenChange={(open: boolean) => {
                  onRenderedPathChange(path);
                  setFolderOpen(path.root, open);
                }}
              >
                <Tree.FolderTrigger>
                  <Tree.Icon>{getFolderIcon(isOpen)}</Tree.Icon>
                  <Tree.Label>{path.label}</Tree.Label>
                </Tree.FolderTrigger>
                {isSelectedRoot ? (
                  <Tree.FolderContent>
                    {isLoading ? <Txt className="px-2 py-3 text-icon3">Loading files…</Txt> : null}
                    {error ? <Txt className="px-2 py-3 text-icon4">Unable to load files.</Txt> : null}
                    {!isLoading && !error && nodes.length === 0 ? (
                      <Txt className="px-2 py-3 text-icon3" variant="ui-sm">
                        {emptyStateCopy(path)}
                      </Txt>
                    ) : null}
                    {!isLoading && !error
                      ? nodes.map(node => (
                          <WorkspaceTreeItem
                            key={node.path}
                            node={node}
                            root={selectedPath.root}
                            openFolders={openFolders}
                            onFolderOpenChange={setFolderOpen}
                          />
                        ))
                      : null}
                  </Tree.FolderContent>
                ) : null}
              </Tree.Folder>
            );
          })}
        </Tree>
      </div>
    </aside>
  );
}
