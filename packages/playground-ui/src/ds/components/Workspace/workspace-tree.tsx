import * as React from 'react';
import { File, FileCode, FileJson, FileText, Folder, FolderOpen, FolderPlus, Image, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tree } from '@/ds/components/Tree';
import { IconButton } from '@/ds/components/IconButton';
import { Spinner } from '@/ds/components/Spinner';
import { TooltipProvider } from '@/ds/components/Tooltip';
import {
  useWorkspaceFiles,
  useWriteWorkspaceFile,
  useCreateWorkspaceDirectory,
} from '@/domains/workspace/hooks/use-workspace';
import type { FileEntry } from '@/domains/workspace/types';
import { useWorkspaceContext } from './workspace-context';

export interface WorkspaceTreeProps {
  className?: string;
  defaultOpen?: boolean;
  allowCreate?: boolean;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
}

interface TreeNode {
  entry: FileEntry;
  path: string;
  children: TreeNode[];
}

function getFileIcon(entry: FileEntry, isOpen = false) {
  if (entry.type === 'directory') {
    return isOpen ? <FolderOpen className="text-amber-400" /> : <Folder className="text-amber-400" />;
  }

  const ext = entry.name.split('.').pop()?.toLowerCase();
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

function buildTree(entries: FileEntry[], basePath: string): TreeNode[] {
  const dirMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Sort entries: directories first, then alphabetically
  const sorted = [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const fullPath = `${basePath}/${entry.name}`.replace(/\/+/g, '/');
    const node: TreeNode = { entry, path: fullPath, children: [] };

    if (entry.type === 'directory') {
      dirMap.set(fullPath, node);
    }

    // Find parent directory
    const parentPath = fullPath.split('/').slice(0, -1).join('/') || '/';
    const parent = dirMap.get(parentPath);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface CreatingState {
  type: 'file' | 'folder';
  parentPath: string;
}

function FolderNode({
  node,
  defaultOpen,
  allowCreate,
  creating,
  onStartCreate,
  onSubmitCreate,
  onCancelCreate,
}: {
  node: TreeNode;
  defaultOpen?: boolean;
  allowCreate?: boolean;
  creating: CreatingState | null;
  onStartCreate: (type: 'file' | 'folder', parentPath: string) => void;
  onSubmitCreate: (name: string) => void;
  onCancelCreate: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen ?? false);

  return (
    <Tree.Folder open={isOpen} onOpenChange={setIsOpen}>
      <Tree.FolderTrigger
        actions={
          allowCreate && (
            <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <IconButton
                tooltip="New file"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsOpen(true);
                  onStartCreate('file', node.path);
                }}
              >
                <Plus />
              </IconButton>
              <IconButton
                tooltip="New folder"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsOpen(true);
                  onStartCreate('folder', node.path);
                }}
              >
                <FolderPlus />
              </IconButton>
            </span>
          )
        }
      >
        <Tree.Icon>{getFileIcon(node.entry, isOpen)}</Tree.Icon>
        <Tree.Label>{node.entry.name}</Tree.Label>
      </Tree.FolderTrigger>
      <Tree.FolderContent>
        {creating?.parentPath === node.path && (
          <Tree.Input
            type={creating.type}
            placeholder={creating.type === 'folder' ? 'Folder name...' : 'File name...'}
            onSubmit={onSubmitCreate}
            onCancel={onCancelCreate}
            autoFocus
          />
        )}
        {node.children.map(child =>
          child.entry.type === 'directory' ? (
            <FolderNode
              key={child.path}
              node={child}
              defaultOpen={defaultOpen}
              allowCreate={allowCreate}
              creating={creating}
              onStartCreate={onStartCreate}
              onSubmitCreate={onSubmitCreate}
              onCancelCreate={onCancelCreate}
            />
          ) : (
            <FileNode key={child.path} node={child} />
          ),
        )}
      </Tree.FolderContent>
    </Tree.Folder>
  );
}

function FileNode({ node }: { node: TreeNode }) {
  return (
    <Tree.File id={node.path}>
      <Tree.Icon>{getFileIcon(node.entry)}</Tree.Icon>
      <Tree.Label>{node.entry.name}</Tree.Label>
    </Tree.File>
  );
}

export const WorkspaceTree = React.forwardRef<HTMLDivElement, WorkspaceTreeProps>(
  ({ className, defaultOpen, allowCreate, onCreateFile, onCreateFolder }, ref) => {
    const { workspaceId, selectedPath, setSelectedPath } = useWorkspaceContext();
    const { data, isLoading } = useWorkspaceFiles('/', { workspaceId, recursive: true });
    const writeFile = useWriteWorkspaceFile();
    const createDir = useCreateWorkspaceDirectory();

    const [creating, setCreating] = React.useState<CreatingState | null>(null);

    const tree = React.useMemo(() => {
      if (!data?.entries) return [];
      return buildTree(data.entries, '/');
    }, [data?.entries]);

    const handleStartCreate = React.useCallback((type: 'file' | 'folder', parentPath: string) => {
      setCreating({ type, parentPath });
    }, []);

    const handleSubmitCreate = React.useCallback(
      (name: string) => {
        if (!creating || !workspaceId) return;
        const fullPath = `${creating.parentPath}/${name}`.replace(/\/+/g, '/');

        if (creating.type === 'file') {
          writeFile.mutate({ workspaceId, path: fullPath, content: '' });
          setSelectedPath(fullPath);
          onCreateFile?.(fullPath);
        } else {
          createDir.mutate({ workspaceId, path: fullPath, recursive: true });
          onCreateFolder?.(fullPath);
        }
        setCreating(null);
      },
      [creating, workspaceId, writeFile, createDir, onCreateFile, onCreateFolder],
    );

    const handleCancelCreate = React.useCallback(() => {
      setCreating(null);
    }, []);

    if (isLoading) {
      return (
        <div ref={ref} className={cn('flex items-center justify-center py-8', className)}>
          <Spinner size="sm" />
        </div>
      );
    }

    if (!tree.length) {
      return (
        <div ref={ref} className={cn('py-4 text-center text-xs text-neutral3', className)}>
          No files
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('overflow-auto', className)}>
        <TooltipProvider>
          <Tree selectedId={selectedPath ?? undefined} onSelect={setSelectedPath}>
            {allowCreate && (
              <div className="flex justify-end px-1 pb-1">
                <IconButton tooltip="New file" size="sm" variant="ghost" onClick={() => handleStartCreate('file', '/')}>
                  <Plus />
                </IconButton>
                <IconButton
                  tooltip="New folder"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartCreate('folder', '/')}
                >
                  <FolderPlus />
                </IconButton>
              </div>
            )}
            {creating?.parentPath === '/' && (
              <Tree.Input
                type={creating.type}
                placeholder={creating.type === 'folder' ? 'Folder name...' : 'File name...'}
                onSubmit={handleSubmitCreate}
                onCancel={handleCancelCreate}
                autoFocus
              />
            )}
            {tree.map(node =>
              node.entry.type === 'directory' ? (
                <FolderNode
                  key={node.path}
                  node={node}
                  defaultOpen={defaultOpen}
                  allowCreate={allowCreate}
                  creating={creating}
                  onStartCreate={handleStartCreate}
                  onSubmitCreate={handleSubmitCreate}
                  onCancelCreate={handleCancelCreate}
                />
              ) : (
                <FileNode key={node.path} node={node} />
              ),
            )}
          </Tree>
        </TooltipProvider>
      </div>
    );
  },
);
WorkspaceTree.displayName = 'Workspace.Tree';
