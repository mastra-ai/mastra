import { TreeFile } from './tree-file';
import { TreeFolder } from './tree-folder';
import { TreeFolderContent } from './tree-folder-content';
import { TreeFolderTrigger } from './tree-folder-trigger';
import { TreeIcon } from './tree-icon';
import { TreeInput } from './tree-input';
import { TreeLabel } from './tree-label';
import { TreeRoot } from './tree-root';

export const Tree = Object.assign(TreeRoot, {
  Folder: TreeFolder,
  FolderTrigger: TreeFolderTrigger,
  FolderContent: TreeFolderContent,
  File: TreeFile,
  Icon: TreeIcon,
  Label: TreeLabel,
  Input: TreeInput,
});
