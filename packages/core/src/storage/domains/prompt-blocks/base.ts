import type {
  StoragePromptBlockType,
  StoragePromptBlockSnapshotType,
  StorageResolvedPromptBlockType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageListPromptBlocksResolvedOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import { StorageDomain } from '../base';

// ============================================================================
// Prompt Block Version Types
// ============================================================================

/**
 * Represents a stored version of a prompt block's content.
 * Config fields are top-level on the version row (no nested snapshot object).
 */
export interface PromptBlockVersion extends StoragePromptBlockSnapshotType {
  /** UUID identifier for this version */
  id: string;
  /** ID of the prompt block this version belongs to */
  blockId: string;
  /** Sequential version number (1, 2, 3, ...) */
  versionNumber: number;
  /** Array of field names that changed from the previous version */
  changedFields?: string[];
  /** Optional message describing the changes */
  changeMessage?: string;
  /** When this version was created */
  createdAt: Date;
}

/**
 * Input for creating a new prompt block version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreatePromptBlockVersionInput extends StoragePromptBlockSnapshotType {
  /** UUID identifier for this version */
  id: string;
  /** ID of the prompt block this version belongs to */
  blockId: string;
  /** Sequential version number */
  versionNumber: number;
  /** Array of field names that changed from the previous version */
  changedFields?: string[];
  /** Optional message describing the changes */
  changeMessage?: string;
}

/**
 * Sort direction for version listings.
 */
export type PromptBlockVersionSortDirection = ThreadSortDirection;

/**
 * Fields that can be used for ordering version listings.
 */
export type PromptBlockVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing prompt block versions with pagination and sorting.
 */
export interface ListPromptBlockVersionsInput {
  /** ID of the prompt block to list versions for */
  blockId: string;
  /** Page number (0-indexed) */
  page?: number;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 20 if not specified.
   */
  perPage?: number | false;
  /** Sorting options */
  orderBy?: {
    field?: PromptBlockVersionOrderBy;
    direction?: PromptBlockVersionSortDirection;
  };
}

/**
 * Output for listing prompt block versions with pagination info.
 */
export interface ListPromptBlockVersionsOutput {
  /** Array of versions for the current page */
  versions: PromptBlockVersion[];
  /** Total number of versions */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number | false;
  /** Whether there are more pages */
  hasMore: boolean;
}

// ============================================================================
// Constants for validation
// ============================================================================

const PROMPT_BLOCK_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const PROMPT_BLOCK_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};

const VERSION_ORDER_BY_SET: Record<PromptBlockVersionOrderBy, true> = {
  versionNumber: true,
  createdAt: true,
};

// ============================================================================
// PromptBlocksStorage Base Class
// ============================================================================

export abstract class PromptBlocksStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'PROMPT_BLOCKS',
    });
  }

  // ==========================================================================
  // Prompt Block CRUD Methods
  // ==========================================================================

  /**
   * Retrieves a prompt block by its unique identifier (raw thin record, without version resolution).
   * @param id - The unique identifier of the prompt block
   * @returns The thin prompt block record if found, null otherwise
   */
  abstract getPromptBlockById({ id }: { id: string }): Promise<StoragePromptBlockType | null>;

  /**
   * Retrieves a prompt block by its unique identifier, resolving config from the active version.
   * This is the preferred method for fetching prompt blocks as it ensures the returned
   * configuration matches the active version.
   *
   * @param id - The unique identifier of the prompt block
   * @returns The resolved prompt block (metadata + version config), or null if not found
   */
  async getPromptBlockByIdResolved({ id }: { id: string }): Promise<StorageResolvedPromptBlockType | null> {
    const block = await this.getPromptBlockById({ id });

    if (!block) {
      return null;
    }

    // Try to get the version to merge with
    let version: PromptBlockVersion | null = null;

    // If an active version is set, use that
    if (block.activeVersionId) {
      version = await this.getVersion(block.activeVersionId);

      // Warn if activeVersionId points to a non-existent version
      if (!version) {
        this.logger?.warn?.(
          `Prompt block ${block.id} has activeVersionId ${block.activeVersionId} but version not found. Falling back to latest version.`,
        );
      }
    }

    // If no active version or it wasn't found, fall back to latest version
    if (!version) {
      version = await this.getLatestVersion(block.id);
    }

    // If we have a version, merge its config with block metadata
    if (version) {
      // Extract snapshot config fields from the version
      const {
        id: _versionId,
        blockId: _blockId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      // Return merged block metadata + version config
      return {
        ...block,
        ...snapshotConfig,
      };
    }

    // No versions exist - return thin record cast as resolved (config fields will be undefined)
    return block as StorageResolvedPromptBlockType;
  }

  /**
   * Lists all prompt blocks with version resolution.
   * For each block that has an activeVersionId, the config is resolved from the version.
   *
   * @param args - Pagination and ordering options
   * @returns Paginated list of resolved prompt blocks
   */
  async listPromptBlocksResolved(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksResolvedOutput> {
    const result = await this.listPromptBlocks(args);

    // Resolve each block's active version or latest version
    const resolvedBlocks = await Promise.all(
      result.promptBlocks.map(async block => {
        // Try to get the version to merge with
        let version: PromptBlockVersion | null = null;

        // If an active version is set, use that
        if (block.activeVersionId) {
          version = await this.getVersion(block.activeVersionId);
        }

        // If no active version or it wasn't found, fall back to latest version
        if (!version) {
          version = await this.getLatestVersion(block.id);
        }

        // If we have a version, merge its config with block metadata
        if (version) {
          const {
            id: _versionId,
            blockId: _blockId,
            versionNumber: _versionNumber,
            changedFields: _changedFields,
            changeMessage: _changeMessage,
            createdAt: _createdAt,
            ...snapshotConfig
          } = version;

          return {
            ...block,
            ...snapshotConfig,
          } as StorageResolvedPromptBlockType;
        }

        // No versions exist - return thin record cast as resolved
        return block as StorageResolvedPromptBlockType;
      }),
    );

    return {
      ...result,
      promptBlocks: resolvedBlocks,
    };
  }

  /**
   * Creates a new prompt block in storage.
   * @param promptBlock - The prompt block data to create (thin record fields + initial snapshot)
   * @returns The created thin prompt block record with timestamps
   */
  abstract createPromptBlock({
    promptBlock,
  }: {
    promptBlock: StorageCreatePromptBlockInput;
  }): Promise<StoragePromptBlockType>;

  /**
   * Updates an existing prompt block in storage.
   * @param id - The unique identifier of the prompt block to update
   * @param updates - The fields to update
   * @returns The updated thin prompt block record
   */
  abstract updatePromptBlock({ id, ...updates }: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType>;

  /**
   * Deletes a prompt block from storage.
   * @param id - The unique identifier of the prompt block to delete
   */
  abstract deletePromptBlock({ id }: { id: string }): Promise<void>;

  /**
   * Lists all prompt blocks with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of thin prompt block records
   */
  abstract listPromptBlocks(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput>;

  // ==========================================================================
  // Prompt Block Version Methods
  // ==========================================================================

  /**
   * Creates a new version record for a prompt block.
   * @param input - The version data to create (config fields are top-level)
   * @returns The created version with timestamp
   */
  abstract createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion>;

  /**
   * Retrieves a version by its unique ID.
   * @param id - The UUID of the version
   * @returns The version if found, null otherwise
   */
  abstract getVersion(id: string): Promise<PromptBlockVersion | null>;

  /**
   * Retrieves a version by block ID and version number.
   * @param blockId - The ID of the prompt block
   * @param versionNumber - The version number to look up
   * @returns The version if found, null otherwise
   */
  abstract getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null>;

  /**
   * Retrieves the latest (highest versionNumber) version for a prompt block.
   * @param blockId - The ID of the prompt block
   * @returns The latest version if found, null otherwise
   */
  abstract getLatestVersion(blockId: string): Promise<PromptBlockVersion | null>;

  /**
   * Lists versions for a prompt block with pagination and sorting.
   * @param input - Pagination and filter options
   * @returns Paginated list of versions
   */
  abstract listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput>;

  /**
   * Deletes a specific version by ID.
   * @param id - The UUID of the version to delete
   */
  abstract deleteVersion(id: string): Promise<void>;

  /**
   * Deletes all versions for a prompt block.
   * @param blockId - The ID of the prompt block
   */
  abstract deleteVersionsByBlockId(blockId: string): Promise<void>;

  /**
   * Counts the total number of versions for a prompt block.
   * @param blockId - The ID of the prompt block
   * @returns The count of versions
   */
  abstract countVersions(blockId: string): Promise<number>;

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Parses orderBy input for consistent prompt block sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in PROMPT_BLOCK_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in PROMPT_BLOCK_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }

  /**
   * Parses orderBy input for consistent version sorting behavior.
   */
  protected parseVersionOrderBy(
    orderBy?: ListPromptBlockVersionsInput['orderBy'],
    defaultDirection: PromptBlockVersionSortDirection = 'DESC',
  ): { field: PromptBlockVersionOrderBy; direction: PromptBlockVersionSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in VERSION_ORDER_BY_SET ? orderBy.field : 'versionNumber',
      direction:
        orderBy?.direction && orderBy.direction in PROMPT_BLOCK_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }
}
