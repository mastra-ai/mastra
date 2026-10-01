export { WorkspaceTreeView } from './components/workspace-tree-view';
export type { WorkspaceTreeViewProps } from './components/workspace-tree-view';
export { Workspace } from './components/workspace';
export type { WorkspaceRootProps } from './components/workspace';
export { useWorkspaceContext } from './components/use-workspace-context';
export { useWorkspaceDirectory } from './hooks/use-workspace-directory';
export { useWorkspaceFileContent } from './hooks/use-workspace-file-content';
export { useWorkspaceSearch } from './hooks/use-workspace-search';
export type {
  WorkspaceCreateDirectoryHandler,
  WorkspaceDeleteHandler,
  WorkspaceEntryRef,
} from './components/use-workspace-context';
export type { WorkspaceFilePreview, WorkspacePreviewFactory } from './components/workspace-active-file';
export { WorkspaceMarkdownPreview } from './components/workspace-markdown-preview';
export { splitFrontmatter } from './components/frontmatter';
