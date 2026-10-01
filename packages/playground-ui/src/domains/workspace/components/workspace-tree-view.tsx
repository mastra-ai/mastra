import type { ReactNode } from 'react';
import type { WorkspaceCreateDirectoryHandler, WorkspaceDeleteHandler } from './use-workspace-context';
import { Workspace } from './workspace';
import type { WorkspacePreviewFactory } from './workspace-active-file';

export interface WorkspaceTreeViewProps {
  workspaceId: string;
  /** Workspace-relative path of the open file (e.g. `src/index.ts`), or `undefined`. Controlled by the parent. */
  activeFilePath?: string;
  /** Called when the user opens a file, or with `undefined` when a delete closes it. */
  onActiveFileChange: (path: string | undefined) => void;
  /** Enables the delete action on tree rows. Omit to hide it. For directories, delete recursively. */
  onDelete?: WorkspaceDeleteHandler;
  /** Enables the "New folder" action. Receives a workspace-relative path. Omit to hide it. */
  onCreateDirectory?: WorkspaceCreateDirectoryHandler;
  /** Folders (and their contents) where delete and new folder are unavailable. Use `.` for the whole workspace. */
  readOnlyPaths?: string[];
  /** Include file search. Defaults to true. */
  searchFiles?: boolean;
  /** Include skill search. Defaults to true. The search action hides when both are false. */
  searchSkills?: boolean;
  /** Total files, shown as `N Files` in the aside title. Omit to show a plain `Files`. */
  fileCount?: number;
  /** Total skills, shown as `N Skills` next to the files. Omit to hide. */
  skillCount?: number;
  /** Extra icon buttons rendered in the aside header, after search and new folder. */
  asideActions?: ReactNode;
  /** Extra labeled actions shown next to "New folder" when the workspace is empty. */
  emptyActions?: ReactNode;
  /** Custom preview for a file; return `undefined` to keep the built-in rendering. */
  renderPreview?: WorkspacePreviewFactory;
}

export function WorkspaceTreeView({ asideActions, renderPreview, ...rootProps }: WorkspaceTreeViewProps) {
  return (
    <Workspace.Root {...rootProps}>
      <Workspace.Aside>
        <Workspace.AsideHeader
          actions={
            <>
              <Workspace.SearchToggle />
              <Workspace.CreateDirectory />
              {asideActions}
            </>
          }
        >
          <Workspace.Search />
        </Workspace.AsideHeader>
        <Workspace.Tree />
      </Workspace.Aside>
      <Workspace.ActiveFile>
        <Workspace.ActiveFileHeader>
          <Workspace.FilePath />
        </Workspace.ActiveFileHeader>
        <Workspace.ActiveFileContent renderPreview={renderPreview} />
      </Workspace.ActiveFile>
    </Workspace.Root>
  );
}
