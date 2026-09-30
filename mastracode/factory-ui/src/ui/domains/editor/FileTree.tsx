import { cn } from '@mastra/playground-ui/utils/cn';
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image,
} from 'lucide-react';
import { createContext, useContext, useMemo } from 'react';
import type { NodeApi, NodeRendererProps } from 'react-arborist';
import { Tree } from 'react-arborist';
import type { ReactNode } from 'react';

import type { EditorTreeEntry } from '../../../api/types';
import type { AgentActivity } from './use-agent-activity';

import './editor-activity.css';

interface FileTreeProps {
  entries: EditorTreeEntry[];
  activePath: string | null;
  onOpen(path: string): void;
  height: number;
  width: number;
  /** Live agent file activity — rows the agent is touching get a ring. */
  activity?: AgentActivity;
}

// Rows render through a module-level component (recreating it per render
// would remount every row), so activity reaches them via context.
const ActivityContext = createContext<AgentActivity | undefined>(undefined);

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

function getFileIcon(path: string): ReactNode {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rs':
    case 'go':
      return <FileCode size={14} className="text-notice-info/70 shrink-0" />;
    case 'json':
      return <FileJson size={14} className="text-notice-warning/70 shrink-0" />;
    case 'md':
    case 'mdx':
      return <FileText size={14} className="text-muted-foreground shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image size={14} className="text-muted-foreground shrink-0" />;
    default:
      return <FileIcon size={14} className="text-muted-foreground shrink-0" />;
  }
}

/**
 * Fold the flat entry list from `/web/workspace/tree` into a nested
 * `TreeNode` structure keyed by path. Entries arrive sorted (directories
 * first, then lexical) so we can build the tree in a single pass.
 */
function foldEntries(entries: EditorTreeEntry[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const byPath = new Map<string, TreeNode>();
  for (const entry of entries) {
    const node: TreeNode = {
      id: entry.path,
      name: entry.name,
      path: entry.path,
      type: entry.type,
      children: entry.type === 'directory' ? [] : undefined,
    };
    byPath.set(entry.path, node);
    const slash = entry.path.lastIndexOf('/');
    if (slash < 0) {
      roots.push(node);
      continue;
    }
    const parentPath = entry.path.slice(0, slash);
    const parent = byPath.get(parentPath);
    if (parent?.children) parent.children.push(node);
    else roots.push(node); // Orphaned (parent skipped by server prune) — surface anyway.
  }
  return roots;
}

function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const data = node.data;
  const isDir = data.type === 'directory';
  const activity = useContext(ActivityContext);
  const agentBusyHere = !isDir && activity?.isActiveFile(data.path);
  const agentBusyInside = isDir && !node.isOpen && activity?.isActiveDir(data.path);
  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'text-body-sm hover:bg-fill-hover flex h-full cursor-pointer items-center gap-1 rounded-md px-1',
        node.isSelected && 'bg-fill text-foreground',
        !node.isSelected && 'text-muted-foreground',
        agentBusyHere && 'editor-activity-ring',
      )}
      onClick={() => (isDir ? node.toggle() : node.tree.props.onActivate?.(node))}
    >
      {isDir ? (
        node.isOpen ? (
          <ChevronDown size={12} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground shrink-0" />
        )
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {isDir ? (
        node.isOpen ? (
          <FolderOpen size={14} className="text-notice-warning/70 shrink-0" />
        ) : (
          <Folder size={14} className="text-notice-warning/70 shrink-0" />
        )
      ) : (
        getFileIcon(data.path)
      )}
      <span className="truncate">{data.name}</span>
      {agentBusyInside && (
        <span
          className="bg-notice-success ml-auto size-1.5 shrink-0 animate-pulse rounded-full"
          aria-label="Agent working inside"
        />
      )}
    </div>
  );
}

export function FileTree({ entries, activePath, onOpen, height, width, activity }: FileTreeProps) {
  const data = useMemo(() => foldEntries(entries), [entries]);
  return (
    <ActivityContext.Provider value={activity}>
      <Tree<TreeNode>
        data={data}
        openByDefault={false}
        height={height}
        width={width}
        rowHeight={24}
        indent={12}
        selection={activePath ?? undefined}
        onActivate={(node: NodeApi<TreeNode>) => {
          if (node.data.type === 'file') onOpen(node.data.path);
        }}
      >
        {Node}
      </Tree>
    </ActivityContext.Provider>
  );
}
