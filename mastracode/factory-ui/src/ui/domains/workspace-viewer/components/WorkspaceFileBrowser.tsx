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
import { RepositoryGroupHeader } from './WorkspaceChangesPanel';

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

interface WorkspaceTreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children: WorkspaceTreeNode[];
}

interface WorkspaceFileEntry {
  path: string;
}

interface WorkspaceFileRepository {
  slug: string;
  prefix: string;
}

function ensureDirectory(nodes: WorkspaceTreeNode[], path: string, name: string): WorkspaceTreeNode {
  const existing = nodes.find(node => node.path === path);
  if (existing) return existing;

  const directory = { path, name, type: 'directory', children: [] } satisfies WorkspaceTreeNode;
  nodes.push(directory);
  return directory;
}

function addFile(nodes: WorkspaceTreeNode[], file: WorkspaceFileEntry, prefix: string) {
  const segments = file.path.slice(prefix.length).split('/').filter(Boolean);
  let siblings = nodes;
  let currentPath = prefix;

  segments.forEach((segment, index) => {
    currentPath = currentPath && !currentPath.endsWith('/') ? `${currentPath}/${segment}` : `${currentPath}${segment}`;
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

function countFiles(nodes: WorkspaceTreeNode[]): number {
  return nodes.reduce((total, node) => total + (node.type === 'file' ? 1 : countFiles(node.children)), 0);
}

/**
 * Build the folder tree of a file list. `prefix` is the repository directory
 * the paths carry in a multi-repository session: it is stripped for display
 * only, every node keeps the prefixed path the file route expects.
 */
function buildTree(files: WorkspaceFileEntry[], prefix = ''): WorkspaceTreeNode[] {
  const nodes: WorkspaceTreeNode[] = [];
  files.forEach(file => addFile(nodes, file, prefix));
  return sortTree(nodes);
}

interface FileGroup {
  repository?: WorkspaceFileRepository;
  nodes: WorkspaceTreeNode[];
}

/**
 * One group per repository, in payload order, then a trailing ungrouped tree
 * for the entries no repository prefix claims (root `.artifacts`, paths
 * persisted before the session had a layout).
 */
function groupFiles(files: WorkspaceFileEntry[], repositories: WorkspaceFileRepository[]): FileGroup[] {
  const byPrefix = [...repositories].sort((a, b) => b.prefix.length - a.prefix.length);
  const buckets = new Map<string | undefined, WorkspaceFileEntry[]>();
  for (const file of files) {
    const owner = byPrefix.find(repository => file.path.startsWith(repository.prefix));
    const bucket = buckets.get(owner?.prefix) ?? [];
    bucket.push(file);
    buckets.set(owner?.prefix, bucket);
  }
  const groups: FileGroup[] = repositories.map(repository => ({
    repository,
    nodes: buildTree(buckets.get(repository.prefix) ?? [], repository.prefix),
  }));
  const ungrouped = buckets.get(undefined);
  if (ungrouped?.length) groups.push({ nodes: buildTree(ungrouped) });
  return groups;
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
  /** The environment repositories the paths are prefixed by; grouping applies with two or more. */
  repositories?: WorkspaceFileRepository[];
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
  repositories,
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
  const groups = repositories && repositories.length > 1 ? groupFiles(persistedFiles, repositories) : undefined;
  const nodes = groups ? [] : buildTree(persistedFiles);

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
        {!isLoading && !error ? (
          <Txt tone="muted" variant="meta" className="ml-auto">
            {persistedFiles.length} {persistedFiles.length === 1 ? 'file' : 'files'}
          </Txt>
        ) : null}
        <Button
          className={isLoading || error ? 'ml-auto' : undefined}
          size="icon-sm"
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
          <Txt variant="caption" className="text-destructive-foreground">
            {error.message}
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && !groups && nodes.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
          <Txt tone="muted" variant="caption">
            No files
          </Txt>
        </div>
      ) : null}
      {!isLoading && !error && groups ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col p-1.5">
            {groups.map(group =>
              group.repository ? (
                <section key={group.repository.prefix} aria-label={`Files in ${group.repository.slug}`}>
                  <RepositoryGroupHeader
                    slug={group.repository.slug}
                    open={openFolders[group.repository.prefix] ?? true}
                    onOpenChange={open => onFolderOpenChange(group.repository!.prefix, open)}
                  >
                    <Txt as="span" tone="muted" variant="meta" className="shrink-0">
                      {countFiles(group.nodes)} {countFiles(group.nodes) === 1 ? 'file' : 'files'}
                    </Txt>
                  </RepositoryGroupHeader>
                  {(openFolders[group.repository.prefix] ?? true) && group.nodes.length > 0 ? (
                    <Tree className="pl-2" selectedId={selectedFilePath} onSelect={onFileSelect}>
                      {group.nodes.map(node => (
                        <WorkspaceTreeItem
                          key={node.path}
                          node={node}
                          openFolders={openFolders}
                          onFolderOpenChange={onFolderOpenChange}
                        />
                      ))}
                    </Tree>
                  ) : null}
                </section>
              ) : (
                <Tree key="ungrouped" selectedId={selectedFilePath} onSelect={onFileSelect}>
                  {group.nodes.map(node => (
                    <WorkspaceTreeItem
                      key={node.path}
                      node={node}
                      openFolders={openFolders}
                      onFolderOpenChange={onFolderOpenChange}
                    />
                  ))}
                </Tree>
              ),
            )}
          </div>
        </ScrollArea>
      ) : null}
      {!isLoading && !error && !groups && nodes.length > 0 ? (
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
