/**
 * Server-side directory browser for the web project picker.
 *
 * The browser cannot read absolute filesystem paths (the File System Access API
 * only exposes a directory *name*), so the picker must ask the server — which
 * does have filesystem access — to enumerate directories. The result is real
 * absolute paths the user can select without typing.
 *
 * All access is confined to a configured `root` (default: the user's home
 * directory). Requests that try to escape the root via `..` or symlinks are
 * clamped back to the root.
 */

export interface DirectoryEntry {
  name: string;
  /** Absolute path to the entry. */
  path: string;
}

export interface DirectoryListing {
  /** The allowed root; clients cannot browse above this. */
  root: string;
  /** The absolute path that was listed. */
  path: string;
  /** Parent directory path, or null when `path` is the root. */
  parent: string | null;
  /** Subdirectories of `path` (directories only, sorted, hidden excluded). */
  entries: DirectoryEntry[];
}

export interface WorkspaceRenderedEntry {
  name: string;
  /** Path relative to the configured rendered root. */
  path: string;
  type: 'file' | 'directory';
  size: number;
  updatedAt: string;
}

export interface WorkspaceRenderedListing {
  /** The confined workspace/project root. */
  workspacePath: string;
  /** Configured workspace-relative rendered root, e.g. `.artifacts`. */
  root: string;
  /** The confined absolute path for the rendered root. */
  rootPath: string;
  entries: WorkspaceRenderedEntry[];
}

export interface WorkspaceFile {
  /** The confined workspace/project root. */
  workspacePath: string;
  /** Workspace-relative file path. */
  path: string;
  name: string;
  size: number;
  updatedAt: string;
  contentType: 'text' | 'unsupported';
  content?: string;
  truncated?: boolean;
}

export interface WorkspaceTreeEntry {
  name: string;
  /** Path from the session's layout root, the form the file route takes. */
  path: string;
  type: 'file' | 'directory';
  size?: number;
  /** Set when the entry is a symlink: where it points, as written in the link. */
  symlinkTarget?: string;
  /** Set when the entry is a symlink: the tree path of what it resolves to. */
  linkedPath?: string;
}

/** One directory of a session's checkouts, read live from its sandbox. */
export interface WorkspaceTreeListing {
  workspacePath: string;
  /** The listed directory; empty for the top level. */
  path: string;
  /** False when this process holds no sandbox for the session, so nothing was read. */
  available: boolean;
  entries: WorkspaceTreeEntry[];
}

export interface WorkspaceFileIndex {
  workspacePath: string;
  /** False when this process holds no sandbox for the session, so nothing was read. */
  available: boolean;
  /** Tracked and untracked files git doesn't ignore, workspace-relative, in each checkout's order. */
  paths: string[];
  /** Files are left out: a checkout's list hit the size cap, or a checkout couldn't be listed. */
  truncated: boolean;
}

export type WorkspaceChangeStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted';

export interface WorkspaceChange {
  path: string;
  previousPath?: string;
  status: WorkspaceChangeStatus;
  additions?: number;
  deletions?: number;
  binary?: boolean;
}

export interface WorkspaceChangesRepository {
  slug: string;
  /** The path prefix of this repository's changes in the flat list, e.g. `platform/`. */
  prefix: string;
  /** False when the checkout could not be inspected (missing, or git failed). */
  available: boolean;
  changes: WorkspaceChange[];
  additions?: number;
  deletions?: number;
}

export interface WorkspaceChanges {
  workspacePath: string;
  available: boolean;
  /** Every repository's changes, paths prefixed by the repository directory in a multi-repository session. */
  changes: WorkspaceChange[];
  additions?: number;
  deletions?: number;
  /**
   * One group per environment repository, in position order. Present only
   * when the session's environment holds two or more repositories.
   */
  repositories?: WorkspaceChangesRepository[];
}

export type WorkspaceChangesScope = 'branch' | 'uncommitted';

export type WorkspacePatchOmission = 'file-too-large' | 'total-too-large';

export interface WorkspaceChangePatches extends WorkspaceChanges {
  scope: WorkspaceChangesScope;
  /** Each change's unified diff, keyed by its `path` in `changes`. */
  patches: Record<string, string>;
  /** Why a change has no entry in `patches`; a change in neither map is one git could not diff. */
  omittedPatches: Record<string, WorkspacePatchOmission>;
  /** Git's first error line when it could not diff changed files, prefixed by the slug with several repositories. */
  diffError?: string;
}

export type ArtifactEntry = WorkspaceRenderedEntry;

export interface ArtifactListing {
  /** The confined workspace/project root. */
  rootPath: string;
  /** The workspace artifact directory. */
  artifactsPath: string;
  entries: ArtifactEntry[];
}
