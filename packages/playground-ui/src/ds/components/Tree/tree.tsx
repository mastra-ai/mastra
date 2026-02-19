import { TreeRoot } from './tree-root';
import { TreeFolder } from './tree-folder';
import { TreeFolderTrigger } from './tree-folder-trigger';
import { TreeFolderContent } from './tree-folder-content';
import { TreeFile } from './tree-file';
import { TreeIcon } from './tree-icon';
import { TreeLabel } from './tree-label';

export const Tree = Object.assign(TreeRoot, {
  Folder: TreeFolder,
  FolderTrigger: TreeFolderTrigger,
  FolderContent: TreeFolderContent,
  File: TreeFile,
  Icon: TreeIcon,
  Label: TreeLabel,
});
