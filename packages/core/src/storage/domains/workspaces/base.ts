import type {
  StorageWorkspaceType,
  StorageWorkspaceSnapshotType,
  StorageResolvedWorkspaceType,
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  StorageListWorkspacesResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// Workspace Version Types
// ============================================================================

/**
 * Represents a stored version of a workspace's configuration.
 * Config fields are top-level on the version row (no nested snapshot object).
 */
export interface WorkspaceVersion extends StorageWorkspaceSnapshotType, VersionBase {
  /** ID of the workspace this version belongs to */
  workspaceId: string;
}

/**
 * Input for creating a new workspace version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreateWorkspaceVersionInput extends StorageWorkspaceSnapshotType, CreateVersionInputBase {
  /** ID of the workspace this version belongs to */
  workspaceId: string;
}

/**
 * Sort direction for version listings.
 */
export type WorkspaceVersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type WorkspaceVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing workspace versions with pagination and sorting.
 */
export interface ListWorkspaceVersionsInput extends ListVersionsInputBase {
  /** ID of the workspace to list versions for */
  workspaceId: string;
}

/**
 * Output for listing workspace versions with pagination info.
 */
export interface ListWorkspaceVersionsOutput extends ListVersionsOutputBase<WorkspaceVersion> {}

// ============================================================================
// WorkspacesStorage Base Class
// ============================================================================

export abstract class WorkspacesStorage extends VersionedStorageDomain<
  StorageWorkspaceType,
  StorageWorkspaceSnapshotType,
  StorageResolvedWorkspaceType,
  WorkspaceVersion,
  CreateWorkspaceVersionInput,
  ListWorkspaceVersionsInput,
  ListWorkspaceVersionsOutput,
  { workspace: StorageCreateWorkspaceInput },
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput | undefined,
  StorageListWorkspacesOutput,
  StorageListWorkspacesResolvedOutput
> {
  protected readonly listKey = 'workspaces';
  protected readonly versionMetadataFields = [
    'id',
    'workspaceId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ] satisfies (keyof WorkspaceVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKSPACES',
    });
  }
}
