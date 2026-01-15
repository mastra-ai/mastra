// File browser components (workspace-specific, no conflicts)
export {
  FileBrowser,
  FileViewer,
  WorkspaceNotConfigured,
  type FileBrowserProps,
  type FileViewerProps,
} from './file-browser';

// Search components
export { SearchWorkspacePanel, type SearchWorkspacePanelProps } from './search-panel';

// Re-export skills components with Workspace prefix to avoid conflicts with skills domain
export {
  SkillsTable as WorkspaceSkillsTable,
  SkillsNotConfigured as WorkspaceSkillsNotConfigured,
  type SkillsTableProps as WorkspaceSkillsTableProps,
} from './skills-table';

export {
  SkillDetail as WorkspaceSkillDetail,
  type SkillDetailProps as WorkspaceSkillDetailProps,
} from './skill-detail';

export {
  SearchSkillsPanel as WorkspaceSearchSkillsPanel,
  type SearchSkillsPanelProps as WorkspaceSearchSkillsPanelProps,
} from './search-panel';

export {
  ReferenceViewerDialog as WorkspaceReferenceViewerDialog,
  type ReferenceViewerDialogProps as WorkspaceReferenceViewerDialogProps,
} from './reference-viewer-dialog';
