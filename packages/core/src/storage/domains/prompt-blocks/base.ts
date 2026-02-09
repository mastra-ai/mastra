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
  ];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'PROMPT_BLOCKS',
    });
  }

  // ==========================================================================
  // Domain-specific abstract methods
  // ==========================================================================

  abstract getPromptBlockById({ id }: { id: string }): Promise<StoragePromptBlockType | null>;
  abstract createPromptBlock({
    promptBlock,
  }: {
    promptBlock: StorageCreatePromptBlockInput;
  }): Promise<StoragePromptBlockType>;
  abstract updatePromptBlock({ id, ...updates }: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType>;
  abstract deletePromptBlock({ id }: { id: string }): Promise<void>;
  abstract listPromptBlocks(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput>;

  // ==========================================================================
  // Version methods (domain-specific naming)
  // ==========================================================================

  abstract getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null>;
  abstract getLatestVersion(blockId: string): Promise<PromptBlockVersion | null>;
  abstract listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput>;
  abstract deleteVersionsByBlockId(blockId: string): Promise<void>;
  abstract countVersions(blockId: string): Promise<number>;

  // ==========================================================================
  // Bridge: generic interface → domain-specific methods
  // ==========================================================================

  async getEntityById(id: string): Promise<StoragePromptBlockType | null> {
    return this.getPromptBlockById({ id });
  }

  async createEntity(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    return this.createPromptBlock(input);
  }

  async updateEntity(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    return this.updatePromptBlock(input);
  }

  async deleteEntity(id: string): Promise<void> {
    return this.deletePromptBlock({ id });
  }

  async listEntities(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    return this.listPromptBlocks(args);
  }

  async deleteVersionsByEntityId(entityId: string): Promise<void> {
    return this.deleteVersionsByBlockId(entityId);
  }

  // ==========================================================================
  // Public resolution methods (domain-specific naming, delegating to generic)
  // ==========================================================================

  async getPromptBlockByIdResolved({ id }: { id: string }): Promise<StorageResolvedPromptBlockType | null> {
    return this.getEntityByIdResolved(id);
  }

  async listPromptBlocksResolved(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksResolvedOutput> {
    return this.listEntitiesResolved(args);
  }
}
