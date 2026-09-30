import { WorkspaceFilePath } from './workspace-active-file';
import {
  WorkspaceActiveFile,
  WorkspaceActiveFileContent,
  WorkspaceActiveFileHeader,
  WorkspaceAside,
  WorkspaceAsideHeader,
  WorkspaceRoot,
  WorkspaceTree,
} from './workspace-parts';
import { WorkspaceSearch } from './workspace-search';

export type { WorkspaceRootProps } from './workspace-parts';

export const Workspace = {
  Root: WorkspaceRoot,
  Aside: WorkspaceAside,
  AsideHeader: WorkspaceAsideHeader,
  Search: WorkspaceSearch,
  Tree: WorkspaceTree,
  ActiveFile: WorkspaceActiveFile,
  ActiveFileHeader: WorkspaceActiveFileHeader,
  FilePath: WorkspaceFilePath,
  ActiveFileContent: WorkspaceActiveFileContent,
};
