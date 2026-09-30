import type { ReactNode } from 'react';
import type {
  WorkspaceCreateDirectoryHandler,
  WorkspaceDeleteHandler,
  WorkspaceSkillRef,
} from './use-workspace-context';
import { Workspace } from './workspace';
import type { WorkspacePreviewFactory } from './workspace-active-file';

export interface WorkspaceTreeViewProps {
  workspaceId: string;
  /** Workspace-relative path (e.g. `src/index.ts`) opened on mount. */
  initialFile?: string;
  /** Enables the delete action on tree rows. Omit to hide it. For directories, delete recursively. */
  onDelete?: WorkspaceDeleteHandler;
  /** Enables the "New folder" action. Receives a workspace-relative path. Omit to hide it. */
  onCreateDirectory?: WorkspaceCreateDirectoryHandler;
  /** Called whenever the user opens another file (e.g. to sync the URL). */
  onActiveFileChange?: (path: string | null) => void;
  /** Skill search hits go here instead of opening in the viewer (e.g. to navigate to the skill page). */
  onSkillSelect?: (skill: WorkspaceSkillRef) => void;
  /** Folders (and their contents) where delete and new folder are unavailable. Use `.` for the whole workspace. */
  readOnlyPaths?: string[];
  /** Include file search. Defaults to true. */
  searchFiles?: boolean;
  /** Include skill search. Defaults to true. The search action hides when both are false. */
  searchSkills?: boolean;
  /** Extra icon buttons rendered in the aside header, after search and new folder. */
  asideActions?: ReactNode;
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
