import { Tree } from '@mastra/playground-ui/components/Tree';
import type { FlatTreeRow } from '@mastra/playground-ui/components/Tree';
import { ChangeCounts } from '../ChangeCounts';
import { ChangeStatusIcon } from '../ChangeStatusIcon';
import type { ChangeTreeNode } from './change-tree';
import { IconFolder1 } from '@mastra/playground-ui/icons/central/IconFolder1';
import { IconFolderOpen } from '@mastra/playground-ui/icons/central/IconFolderOpen';

const FOLDER_CLASS = 'text-muted-foreground!';

function renamedFrom(node: ChangeTreeNode) {
  const previousPath = node.change?.previousPath;
  if (!previousPath) return undefined;
  const previousName = previousPath.slice(previousPath.lastIndexOf('/') + 1);
  return previousName === node.name ? undefined : previousName;
}

export function ChangeTreeItem({ row }: { row: FlatTreeRow<ChangeTreeNode> }) {
  const { node } = row;
  if (!node.change) {
    return (
      <>
        <Tree.Icon>
          {row.expanded ? <IconFolderOpen className={FOLDER_CLASS} /> : <IconFolder1 className={FOLDER_CLASS} />}
        </Tree.Icon>
        <Tree.Label className={FOLDER_CLASS}>{node.name}</Tree.Label>
      </>
    );
  }

  const previousName = renamedFrom(node);
  return (
    <>
      <Tree.Icon>
        <ChangeStatusIcon status={node.change.status} />
      </Tree.Icon>
      <Tree.Label className="text-body-sm font-mono">
        {previousName ? `${previousName} → ${node.name}` : node.name}
      </Tree.Label>
      <span className="ml-auto shrink-0">
        <ChangeCounts {...node.change} />
      </span>
    </>
  );
}
