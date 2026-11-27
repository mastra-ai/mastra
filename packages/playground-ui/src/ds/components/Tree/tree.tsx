import { TreeIcon } from './tree-icon';
import { TreeInput } from './tree-input';
import { TreeLabel } from './tree-label';
import { TreeRoot } from './tree-root';

export type { TreeProps, TreeRow } from './tree-root';
export { flattenTreeRows } from './tree-rows';
export type { FlatTreeRow, FlattenTreeOptions } from './tree-rows';

export const Tree = Object.assign(TreeRoot, {
  Icon: TreeIcon,
  Label: TreeLabel,
  Input: TreeInput,
});
