import type {
  StoragePromptBlockType,
  StoragePromptBlockSnapshotType,
  StorageResolvedPromptBlockType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageListPromptBlocksResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// Prompt Block Version Types
// ============================================================================

/**
 * Represents a stored version of a prompt block's content.
 * Config fields are top-level on the version row (no nested snapshot object).
 */
export interface PromptBlockVersion extends StoragePromptBlockSnapshotType, VersionBase {
  /** ID of the prompt block this version belongs to */
  blockId: string;
}

/**
 * Input for creating a new prompt block version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreatePromptBlockVersionInput extends StoragePromptBlockSnapshotType, CreateVersionInputBase {
  /** ID of the prompt block this version belongs to */
  blockId: string;
}

/**
 * Sort direction for version listings.
 */
export type PromptBlockVersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type PromptBlockVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing prompt block versions with pagination and sorting.
 */
export interface ListPromptBlockVersionsInput extends ListVersionsInputBase {
  /** ID of the prompt block to list versions for */
  blockId: string;
}

/**
 * Output for listing prompt block versions with pagination info.
 */
export interface ListPromptBlockVersionsOutput extends ListVersionsOutputBase<PromptBlockVersion> {}

// ============================================================================
// PromptBlocksStorage Base Class
// ============================================================================

export abstract class PromptBlocksStorage extends VersionedStorageDomain<
  StoragePromptBlockType,
  StoragePromptBlockSnapshotType,
  StorageResolvedPromptBlockType,
  PromptBlockVersion,
  CreatePromptBlockVersionInput,
  ListPromptBlockVersionsInput,
  ListPromptBlockVersionsOutput,
  { promptBlock: StorageCreatePromptBlockInput },
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput | undefined,
  StorageListPromptBlocksOutput,
  StorageListPromptBlocksResolvedOutput
> {
  protected readonly listKey = 'promptBlocks';
  protected readonly versionMetadataFields = [
    'id',
    'blockId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ] satisfies (keyof PromptBlockVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'PROMPT_BLOCKS',
    });
  }
}
