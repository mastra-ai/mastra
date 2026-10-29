import { Tree } from '@mastra/playground-ui/components/Tree';
import { Folder, FolderOpen } from 'lucide-react';

import { treeRowContainmentClass } from '../../../layout';
import { ChangeCounts } from '../ChangeCounts';
import { ChangeStatusIcon } from '../ChangeStatusIcon';
import type { ChangeTreeNode } from './change-tree';

const FOLDER_CLASS = 'text-muted-foreground!';

export interface ChangeTreeFolderState {
  openFolders: Record<string, boolean>;
  onFolderOpenChange: (path: string, open: boolean) => void;
}

function renamedFrom(node: ChangeTreeNode) {
  const previousPath = node.change?.previousPath;
  if (!previousPath) return undefined;
  const previousName = previousPath.slice(previousPath.lastIndexOf('/') + 1);
  return previousName === node.name ? undefined : previousName;
}

export function ChangeTreeItem({
  node,
  openFolders,
  onFolderOpenChange,
}: ChangeTreeFolderState & { node: ChangeTreeNode }) {
  if (!node.change) {
    const isOpen = openFolders[node.path] ?? true;
    return (
      <Tree.Folder
        className={treeRowContainmentClass}
        open={isOpen}
        onOpenChange={(open: boolean) => onFolderOpenChange(node.path, open)}
      >
        <Tree.FolderTrigger>
          <Tree.Icon>
            {isOpen ? <FolderOpen className={FOLDER_CLASS} /> : <Folder className={FOLDER_CLASS} />}
          </Tree.Icon>
          <Tree.Label className={FOLDER_CLASS}>{node.name}</Tree.Label>
        </Tree.FolderTrigger>
        <Tree.FolderContent>
          {node.children.map(child => (
            <ChangeTreeItem
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

  const previousName = renamedFrom(node);
  return (
    <Tree.File id={node.change.path} className={treeRowContainmentClass}>
      <Tree.Icon>
        <ChangeStatusIcon status={node.change.status} />
      </Tree.Icon>
      <Tree.Label className="text-body-sm font-mono">
        {previousName ? `${previousName} → ${node.name}` : node.name}
      </Tree.Label>
      <span className="ml-auto shrink-0">
        <ChangeCounts {...node.change} />
      </span>
    </Tree.File>
  );
}
