import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tree } from '@mastra/playground-ui/components/Tree';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { File, FileCode, FileJson, FileText, Folder, FolderOpen, Image, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { FactoryFsEntry } from '../../../../api/types';

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

interface FactoryFsTreeNode {
  path: string;
  name: string;
  type: FactoryFsEntry['type'];
  size: number;
  children: FactoryFsTreeNode[];
}

function ensureDirectory(nodes: FactoryFsTreeNode[], path: string, name: string): FactoryFsTreeNode {
  const existing = nodes.find(node => node.path === path);
  if (existing) return existing;

  const directory = { path, name, type: 'directory', size: 0, children: [] } satisfies FactoryFsTreeNode;
  nodes.push(directory);
  return directory;
}

function addEntry(nodes: FactoryFsTreeNode[], entry: FactoryFsEntry) {
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

function sortTree(nodes: FactoryFsTreeNode[]): FactoryFsTreeNode[] {
  return nodes
    .map(node => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function buildTree(entries: FactoryFsEntry[]): FactoryFsTreeNode[] {
  const nodes: FactoryFsTreeNode[] = [];
  entries.forEach(entry => addEntry(nodes, entry));
  return sortTree(nodes);
}

/** Every ancestor directory of `dir` (inclusive), as open-by-default keys. */
function defaultOpenFolders(dir: string | undefined): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  if (!dir) return open;
  let current = '';
  for (const segment of dir.split('/').filter(Boolean)) {
    current = current ? `${current}/${segment}` : segment;
    open[current] = true;
  }
  return open;
}

function FactoryFsTreeItem({
  node,
  isOpen,
  onFolderOpenChange,
  renderChildren,
}: {
  node: FactoryFsTreeNode;
  isOpen: (path: string) => boolean;
  onFolderOpenChange: (path: string, open: boolean) => void;
  renderChildren: (nodes: FactoryFsTreeNode[]) => ReactNode;
}) {
  if (node.type === 'directory') {
    const open = isOpen(node.path);
    return (
      <Tree.Folder open={open} onOpenChange={(value: boolean) => onFolderOpenChange(node.path, value)}>
        <Tree.FolderTrigger>
          <Tree.Icon>{open ? <FolderOpen className="text-amber-400" /> : <Folder className="text-amber-400" />}</Tree.Icon>
          <Tree.Label>{node.name}</Tree.Label>
        </Tree.FolderTrigger>
        <Tree.FolderContent>{renderChildren(node.children)}</Tree.FolderContent>
      </Tree.Folder>
    );
  }

  return (
    <Tree.File id={node.path}>
      <Tree.Icon>{getFileIcon(node.name)}</Tree.Icon>
      <Tree.Label>{node.name}</Tree.Label>
      <span className="text-icon3 ml-auto shrink-0 text-xs">{formatBytes(node.size)}</span>
    </Tree.File>
  );
}

interface FactoryFsBrowserProps {
  entries: FactoryFsEntry[];
  /** Org-relative directory to open by default (the current project's directory). */
  defaultOpenDir?: string;
  selectedFilePath?: string;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: Error;
  onRefresh: () => void;
  onFileSelect: (filePath: string) => void;
}

/**
 * Tree browser over the durable factory filesystem's org-wide listing —
 * `shared/` plus every `projects/<project>/` directory. Adapted from the
 * session `WorkspaceFileBrowser`; the current project's directory chain is
 * open by default and the user can navigate the rest of the org tree freely.
 */
export function FactoryFsBrowser({
  entries,
  defaultOpenDir,
  selectedFilePath,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onFileSelect,
}: FactoryFsBrowserProps) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const defaults = defaultOpenFolders(defaultOpenDir);
  const nodes = buildTree(entries);

  const isOpen = (path: string) => overrides[path] ?? defaults[path] ?? false;
  const setFolderOpen = (path: string, open: boolean) => {
    setOverrides(previous => ({ ...previous, [path]: open }));
  };

  const renderNodes = (items: FactoryFsTreeNode[]): ReactNode =>
    items.map(node => (
      <FactoryFsTreeItem
        key={node.path}
        node={node}
        isOpen={isOpen}
        onFolderOpenChange={setFolderOpen}
        renderChildren={renderNodes}
      />
    ));

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col" aria-label="Factory files">
      <div className="border-border1 flex items-center justify-between border-b px-3 py-2">
        <Txt variant="ui-sm" className="text-icon6 font-medium">
          Files
        </Txt>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? 'Refreshing factory files' : 'Refresh factory files'}
        >
          {isRefreshing ? <Spinner size="sm" /> : <RefreshCw />}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? <Txt className="text-icon3 px-2 py-3">Loading files…</Txt> : null}
        {error ? <Txt className="text-icon4 px-2 py-3">Unable to load files.</Txt> : null}
        {!isLoading && !error && nodes.length === 0 ? (
          <Txt className="text-icon3 px-2 py-3" variant="ui-sm">
            No files yet. Files agents save to /factory will appear here.
          </Txt>
        ) : null}
        {!isLoading && !error && nodes.length > 0 ? (
          <Tree selectedId={selectedFilePath} onSelect={onFileSelect}>
            {renderNodes(nodes)}
          </Tree>
        ) : null}
      </div>
    </aside>
  );
}
