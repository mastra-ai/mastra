import { Tree, flattenTreeRows } from '@mastra/playground-ui/components/Tree';
import type { ChangeTreeNode } from './change-tree';
import { ChangeTreeItem } from './ChangeTreeItem';

export interface ChangeTreeFolderState {
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
}

interface ChangeFileTreeProps extends ChangeTreeFolderState {
  nodes: ChangeTreeNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  className?: string;
}

export function ChangeFileTree({
  nodes,
  openFolders,
  onFolderOpenChange,
  selectedPath,
  onSelect,
  className,
}: ChangeFileTreeProps) {
  return (
    <Tree
      aria-label="Changed files"
      className={className}
      rows={flattenTreeRows(nodes, {
        getId: node => node.path,
        getChildren: node => (node.change ? undefined : node.children),
        isOpen: path => openFolders[path] ?? true,
      })}
      getRowLabel={row => row.node.name}
      selectedId={selectedPath}
      onActivate={row => (row.expanded === undefined ? onSelect(row.id) : onFolderOpenChange(row.id, !row.expanded))}
      onExpandedChange={(row, expanded) => onFolderOpenChange(row.id, expanded)}
      renderRow={row => <ChangeTreeItem row={row} />}
    />
  );
}
