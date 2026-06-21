// File browser components
export { FileBrowser, FileViewer, type FileBrowserProps, type FileViewerProps } from './file-browser';
export {
  WorkspaceFilePreview,
  WorkspaceFilePreviewContent,
  type WorkspaceFilePreviewContentProps,
  type WorkspaceFilePreviewProps,
  type WorkspaceFilePreviewVariant,
} from './workspace-file-preview';
export {
  formatWorkspaceFileSize,
  getWorkspaceFilePreviewKind,
  type WorkspaceFilePreviewKind,
} from './workspace-file-preview-utils';

export { NoWorkspacesInfo } from './no-workspaces-info';
export { WorkspaceNotConfigured } from './workspace-not-configured';
export { WorkspaceNotSupported } from './workspace-not-supported';

// Search components
export {
  SearchWorkspacePanel,
  SearchSkillsPanel,
  type SearchWorkspacePanelProps,
  type SearchSkillsPanelProps,
} from './search-panel';

// Skills components
export { SkillsTable, SkillsNotConfigured, type SkillsTableProps } from './skills-table';

export { SkillDetail, type SkillDetailProps } from './skill-detail';

export { ReferenceViewerDialog, type ReferenceViewerDialogProps } from './reference-viewer-dialog';

// Skills.sh components
export { AddSkillDialog, type AddSkillDialogProps, type WritableMount } from './add-skill-dialog';

export {
  SkillRemoveButton,
  SkillUpdateButton,
  type SkillRemoveButtonProps,
  type SkillUpdateButtonProps,
} from './skill-actions';
