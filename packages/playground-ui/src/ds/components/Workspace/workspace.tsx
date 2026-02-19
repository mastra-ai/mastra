import { WorkspaceRoot } from './workspace-root';
import { WorkspaceTree } from './workspace-tree';
import { WorkspaceFile } from './workspace-file';

export const Workspace = Object.assign(WorkspaceRoot, {
  Tree: WorkspaceTree,
  File: WorkspaceFile,
});
