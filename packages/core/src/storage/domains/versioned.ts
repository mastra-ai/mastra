import type { StorageOrderBy, ThreadOrderBy, ThreadSortDirection } from '../types';
import { StorageDomain } from './base';

// ============================================================================
// Generic Version Types
// ============================================================================

/**
 * Base interface for version metadata fields that exist on every version row.
 * The `TFkField` parameter controls the name of the foreign key field.
 */
export interface VersionBase {
  /** UUID identifier for this version */
  id: string;
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
 * Base interface for version creation input.
 * Same as VersionBase but without the server-assigned `createdAt` timestamp.
 */
export interface CreateVersionInputBase extends Omit<VersionBase, 'createdAt'> {}

/**
 * Sort direction for version listings.
 */
export type VersionSortDirectionGeneric = ThreadSortDirection;

/**
 * Fields that can be used for ordering version listings.
 */
export type VersionOrderByGeneric = 'versionNumber' | 'createdAt';

/**
 * Input for listing versions with pagination and sorting.
 */
export interface ListVersionsInputBase {
  /** Page number (0-indexed) */
  page?: number;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 20 if not specified.
   */
  perPage?: number | false;
  /** Sorting options */
  orderBy?: {
    field?: VersionOrderByGeneric;
    direction?: VersionSortDirectionGeneric;
  };
}

/**
 * Output for listing versions with pagination info.
 */
export interface ListVersionsOutputBase<TVersion> {
  /** Array of versions for the current page */
  versions: TVersion[];
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
// Entity base — the "thin record" must have these fields
// ============================================================================

export interface VersionedEntityBase {
  id: string;
  activeVersionId?: string;
}

// ============================================================================
// Constants for validation (shared across all versioned domains)
// ============================================================================

const ENTITY_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};

const VERSION_ORDER_BY_SET: Record<VersionOrderByGeneric, true> = {
  versionNumber: true,
  createdAt: true,
};

// ============================================================================
// VersionedStorageDomain — generic base class
// ============================================================================

/**
 * Generic base class for versioned storage domains (agents, prompt blocks, scorer definitions).
 *
 * Type parameters:
 * - `TEntity`       — Thin record type (e.g. StorageAgentType)
 * - `TSnapshot`     — Snapshot config type (e.g. StorageAgentSnapshotType)
 * - `TResolved`     — Entity + snapshot merged (e.g. StorageResolvedAgentType)
 * - `TVersion`      — Version row (e.g. AgentVersion)
 * - `TCreateVersion` — Input for creating a version
 * - `TListVersionsInput` — Input for listing versions
 * - `TListVersionsOutput` — Output for listing versions
 * - `TCreateInput`  — Input for creating an entity
 * - `TUpdateInput`  — Input for updating an entity
 * - `TListInput`    — Input for listing entities
 * - `TListOutput`   — Output for listing entities (paginated thin records)
 * - `TListResolvedOutput` — Output for listing resolved entities
 */
export abstract class VersionedStorageDomain<
  TEntity extends VersionedEntityBase,
  TSnapshot,
  TResolved extends TEntity,
  TVersion extends VersionBase,
  TCreateVersion extends CreateVersionInputBase,
  TListVersionsInput extends ListVersionsInputBase,
  TListVersionsOutput extends ListVersionsOutputBase<TVersion>,
  TCreateInput,
  TUpdateInput,
  TListInput,
  TListOutput,
  TListResolvedOutput,
> extends StorageDomain {
  /**
   * The key name used in list outputs (e.g. 'agents', 'promptBlocks', 'scorerDefinitions').
   * Subclasses must provide this so the generic resolution logic can build the correct output shape.
   */
  protected abstract readonly listKey: string;

  /**
   * The set of version metadata field names (including the FK field) to strip
   * when extracting snapshot config from a version row.
   * e.g. ['id', 'agentId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt']
   */
  protected abstract readonly versionMetadataFields: string[];

  // ==========================================================================
  // Entity CRUD (abstract — implemented by concrete store classes)
  // ==========================================================================

  abstract getById(id: string): Promise<TEntity | null>;
  abstract create(input: TCreateInput): Promise<TEntity>;
  abstract update(input: TUpdateInput): Promise<TEntity>;
  abstract delete(id: string): Promise<void>;
  abstract list(args?: TListInput): Promise<TListOutput>;

  // ==========================================================================
  // Version methods (abstract — implemented by concrete store classes)
  // ==========================================================================

  abstract createVersion(input: TCreateVersion): Promise<TVersion>;
  abstract getVersion(id: string): Promise<TVersion | null>;
  abstract getVersionByNumber(entityId: string, versionNumber: number): Promise<TVersion | null>;
  abstract getLatestVersion(entityId: string): Promise<TVersion | null>;
  abstract listVersions(input: TListVersionsInput): Promise<TListVersionsOutput>;
  abstract deleteVersion(id: string): Promise<void>;
  abstract deleteVersionsByParentId(entityId: string): Promise<void>;
  abstract countVersions(entityId: string): Promise<number>;

  // ==========================================================================
  // Concrete resolution methods
  // ==========================================================================

  /**
   * Strips version metadata fields from a version row, leaving only snapshot config fields.
   */
  protected extractSnapshotConfig(version: TVersion): Partial<TSnapshot> {
    const result: Record<string, unknown> = {};
    const metadataSet = new Set(this.versionMetadataFields);

    for (const [key, value] of Object.entries(version)) {
      if (!metadataSet.has(key)) {
        result[key] = value;
      }
    }

    return result as Partial<TSnapshot>;
  }

  /**
   * Resolves an entity by merging its thin record with the active or latest version config.
   * Pass `{ status: 'draft' }` to resolve with the latest version instead of the active one.
   */
  async getByIdResolved(
    id: string,
    options?: { status?: 'draft' | 'published' | 'archived' },
  ): Promise<TResolved | null> {
    const entity = await this.getById(id);

    if (!entity) {
      return null;
    }

    return this.resolveEntity(entity, options);
  }

  /**
   * Lists entities with version resolution.
   * When `status` is `'draft'`, each entity is resolved with its latest version.
   * When `status` is `'published'` (default), each entity is resolved with its active version.
   */
  async listResolved(args?: TListInput): Promise<TListResolvedOutput> {
    const result = await this.list(args);

    const status = (args as Record<string, unknown> | undefined)?.status as string | undefined;
    const entities = (result as Record<string, unknown>)[this.listKey] as TEntity[];
    const resolved = await Promise.all(
      entities.map(entity => this.resolveEntity(entity, { status: status as 'draft' | 'published' | 'archived' })),
    );

    return {
      ...result,
      [this.listKey]: resolved,
    } as TListResolvedOutput;
  }

  /**
   * Resolves a single entity by merging it with its active or latest version.
   * - `status: 'published'` (default) — use activeVersionId, fall back to latest.
   * - `status: 'draft'` — always use the latest version.
   */
  protected async resolveEntity(
    entity: TEntity,
    options?: { status?: 'draft' | 'published' | 'archived' },
  ): Promise<TResolved> {
    const status = options?.status || 'published';
    let version: TVersion | null = null;

    if (status === 'draft') {
      // Draft resolution: always use the latest version (which may be ahead of activeVersionId)
      version = await this.getLatestVersion(entity.id);
    } else {
      // Published/archived resolution: use activeVersionId, fall back to latest
      if (entity.activeVersionId) {
        version = await this.getVersion(entity.activeVersionId);

        if (!version) {
          this.logger?.warn?.(
            `Entity ${entity.id} has activeVersionId ${entity.activeVersionId} but version not found. Falling back to latest version.`,
          );
        }
      }

      if (!version) {
        version = await this.getLatestVersion(entity.id);
      }
    }

    if (version) {
      const snapshotConfig = this.extractSnapshotConfig(version);
      return {
        ...entity,
        ...snapshotConfig,
        resolvedVersionId: version.id,
      } as unknown as TResolved;
    }

    return entity as unknown as TResolved;
  }

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in ENTITY_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction: orderBy?.direction && orderBy.direction in SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }

  protected parseVersionOrderBy(
    orderBy?: TListVersionsInput['orderBy'],
    defaultDirection: VersionSortDirectionGeneric = 'DESC',
  ): { field: VersionOrderByGeneric; direction: VersionSortDirectionGeneric } {
    return {
      field: orderBy?.field && orderBy.field in VERSION_ORDER_BY_SET ? orderBy.field : 'versionNumber',
      direction: orderBy?.direction && orderBy.direction in SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }
}
