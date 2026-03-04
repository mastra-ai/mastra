import { normalizePerPage, calculatePagination } from './base';
import type { StorageOrderBy } from './types';
import type {
  VersionBase,
  ListVersionsInputBase,
  ListVersionsOutputBase,
  VersionedEntityBase,
} from './domains/versioned';

import type { FilesystemDB } from './filesystem-db';
import { GitHistory } from './git-history';

/**
 * Prefix for version IDs that come from git history.
 * These versions are read-only and cannot be deleted.
 */
const GIT_VERSION_PREFIX = 'git-';

/**
 * Configuration for a filesystem-backed versioned storage domain.
 */
export interface FilesystemVersionedConfig {
  /** The FilesystemDB instance for I/O */
  db: FilesystemDB;
  /** Filename for the entities JSON file (e.g., 'agents.json') */
  entitiesFile: string;
  /** The key name of the parent FK field on versions (e.g., 'agentId') */
  parentIdField: string;
  /** Name for logging/error messages */
  name: string;
  /**
   * Fields that are version metadata (not part of the snapshot config).
   * These are stripped when writing to disk.
   * e.g., ['id', 'agentId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt']
   */
  versionMetadataFields: string[];
  /** Maximum number of git commits to load per file (default: 50) */
  gitHistoryLimit?: number;
}

/**
 * Generic helpers for filesystem-backed versioned storage domains.
 *
 * Versions are kept entirely in memory. Only the published snapshot config
 * (the clean primitive configuration) is persisted to the on-disk JSON file.
 * This means the JSON files are human-readable, Git-friendly, and contain
 * no version metadata like `changedFields` or `changeMessage`.
 *
 * When the storage directory is inside a git repository, committed versions
 * of the JSON file are automatically loaded as read-only version history.
 * Each git commit that touched the file becomes a version record, giving
 * users a full published history in the version panel — powered by git.
 *
 * On-disk format for `agents.json`:
 * ```json
 * {
 *   "my-agent-id": {
 *     "name": "My Agent",
 *     "instructions": "Be helpful",
 *     "model": { "provider": "openai", "name": "gpt-4" }
 *   }
 * }
 * ```
 */
export class FilesystemVersionedHelpers<
  TEntity extends VersionedEntityBase & { createdAt: Date; updatedAt: Date; status: string },
  TVersion extends VersionBase,
> {
  readonly db: FilesystemDB;
  readonly entitiesFile: string;
  readonly parentIdField: string;
  readonly name: string;
  readonly versionMetadataFields: string[];
  private readonly gitHistoryLimit: number;

  /**
   * In-memory entity records (thin metadata), keyed by entity ID.
   */
  private entities = new Map<string, TEntity>();

  /**
   * In-memory version records, keyed by version ID.
   * Includes both in-memory/hydrated versions and git-based versions (metadata only).
   */
  private versions = new Map<string, TVersion>();

  /**
   * Whether we've loaded from disk yet.
   */
  private hydrated = false;

  /**
   * Git history utility instance (shared across all helpers).
   */
  private static gitHistory = new GitHistory();

  /**
   * Promise that resolves when git history has been loaded.
   * null means git history loading hasn't been triggered yet.
   */
  private gitHistoryPromise: Promise<void> | null = null;

  /**
   * The highest version number from git history, per entity ID.
   * Used to assign version numbers to new in-memory versions that continue
   * after the git history.
   */
  private gitVersionCounts = new Map<string, number>();

  constructor(config: FilesystemVersionedConfig) {
    this.db = config.db;
    this.entitiesFile = config.entitiesFile;
    this.parentIdField = config.parentIdField;
    this.name = config.name;
    this.versionMetadataFields = config.versionMetadataFields;
    this.gitHistoryLimit = config.gitHistoryLimit ?? 50;
  }

  /**
   * Check if a version ID represents a git-based version.
   */
  static isGitVersion(id: string): boolean {
    return id.startsWith(GIT_VERSION_PREFIX);
  }

  /**
   * Hydrate in-memory state from the on-disk JSON file.
   * For each entry on disk, creates an in-memory entity (status: 'published')
   * and a synthetic version with the snapshot config.
   *
   * Also kicks off async git history loading in the background.
   * Version numbers for hydrated entities are assigned as 1 initially,
   * but will be reassigned after git history loads.
   */
  hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;

    const diskData = this.db.readDomain<Record<string, unknown>>(this.entitiesFile);

    for (const [entityId, snapshotConfig] of Object.entries(diskData)) {
      if (!snapshotConfig || typeof snapshotConfig !== 'object') continue;

      const versionId = `hydrated-${entityId}-v1`;
      const now = new Date();

      // Create a synthetic entity record
      const entity = {
        id: entityId,
        status: 'published',
        activeVersionId: versionId,
        createdAt: now,
        updatedAt: now,
      } as TEntity;

      this.entities.set(entityId, entity);

      // Create a synthetic version with the snapshot config.
      // Version number starts at 1 but may be bumped after git history loads.
      const version = {
        id: versionId,
        [this.parentIdField]: entityId,
        versionNumber: 1,
        ...snapshotConfig,
        createdAt: now,
      } as TVersion;

      this.versions.set(versionId, version);
    }

    // Kick off async git history loading (fire and forget)
    this.gitHistoryPromise = this.loadGitHistory();
  }

  /**
   * Ensure git history has been loaded before proceeding.
   * Call this in version-related methods to ensure git versions are available.
   */
  private async ensureGitHistory(): Promise<void> {
    this.hydrate();
    if (this.gitHistoryPromise) {
      await this.gitHistoryPromise;
    }
  }

  /**
   * Load git commit history for the domain's JSON file.
   * Creates read-only version records (metadata + snapshot config) for each
   * commit where an entity existed. Reassigns version numbers for
   * hydrated (current disk) versions to sit on top of git history.
   */
  private async loadGitHistory(): Promise<void> {
    const git = FilesystemVersionedHelpers.gitHistory;
    const dir = this.db.dir;

    // Check if we're in a git repo
    const isRepo = await git.isGitRepo(dir);
    if (!isRepo) return;

    // Get commit history for this domain's file
    const commits = await git.getFileHistory(dir, this.entitiesFile, this.gitHistoryLimit);
    if (commits.length === 0) return;

    // Process commits from oldest to newest so version numbers are sequential
    const orderedCommits = [...commits].reverse();

    // Track per-entity version counts from git
    const entityVersionCount = new Map<string, number>();
    // Track previous snapshot per entity to skip unchanged entries
    const previousSnapshots = new Map<string, string>();

    for (let i = 0; i < orderedCommits.length; i++) {
      const commit = orderedCommits[i]!;

      // Load the file content at this commit
      const fileContent = await git.getFileAtCommit<Record<string, Record<string, unknown>>>(
        dir,
        commit.hash,
        this.entitiesFile,
      );
      if (!fileContent) continue;

      // Create a version record for each entity that actually changed in this commit
      for (const [entityId, snapshotConfig] of Object.entries(fileContent)) {
        if (!snapshotConfig || typeof snapshotConfig !== 'object') continue;

        // Skip if entity data is unchanged from the previous commit
        const serialized = JSON.stringify(snapshotConfig);
        if (previousSnapshots.get(entityId) === serialized) continue;
        previousSnapshots.set(entityId, serialized);

        const count = (entityVersionCount.get(entityId) ?? 0) + 1;
        entityVersionCount.set(entityId, count);

        const versionId = `${GIT_VERSION_PREFIX}${commit.hash}-${entityId}`;

        // Skip if we somehow already have this version
        if (this.versions.has(versionId)) continue;

        const version = {
          id: versionId,
          [this.parentIdField]: entityId,
          versionNumber: count,
          changeMessage: commit.message,
          ...snapshotConfig,
          createdAt: commit.date,
        } as TVersion;

        this.versions.set(versionId, version);
      }
    }

    // Save the max git version count per entity
    this.gitVersionCounts = entityVersionCount;

    // Reassign version numbers for hydrated (current disk) versions
    // so they sit on top of git history
    for (const [entityId, gitCount] of entityVersionCount) {
      const hydratedVersionId = `hydrated-${entityId}-v1`;
      const version = this.versions.get(hydratedVersionId);
      if (version) {
        (version as Record<string, unknown>).versionNumber = gitCount + 1;
      }
    }
  }

  // ==========================================================================
  // Disk persistence — only published snapshot configs
  // ==========================================================================

  /**
   * Write the published snapshot config for an entity to disk.
   * Strips all entity metadata and version metadata fields, leaving only
   * the clean primitive configuration.
   */
  private persistToDisk(): void {
    const diskData: Record<string, Record<string, unknown>> = {};

    for (const [entityId, entity] of this.entities) {
      if (entity.status !== 'published' || !entity.activeVersionId) continue;

      const version = this.versions.get(entity.activeVersionId);
      if (!version) continue;

      const snapshotConfig = this.extractSnapshotConfig(version);
      diskData[entityId] = snapshotConfig;
    }

    this.db.writeDomain(this.entitiesFile, diskData);
  }

  /**
   * Extract the snapshot config from a version, stripping version metadata fields.
   */
  private extractSnapshotConfig(version: TVersion): Record<string, unknown> {
    const metadataSet = new Set(this.versionMetadataFields);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(version)) {
      if (!metadataSet.has(key)) {
        result[key] = value;
      }
    }

    return result;
  }

  // ==========================================================================
  // Entity CRUD
  // ==========================================================================

  async getById(id: string): Promise<TEntity | null> {
    this.hydrate();
    return this.entities.has(id) ? structuredClone(this.entities.get(id)!) : null;
  }

  async createEntity(id: string, entity: TEntity): Promise<TEntity> {
    this.hydrate();
    if (this.entities.has(id)) {
      throw new Error(`${this.name}: entity with id ${id} already exists`);
    }
    this.entities.set(id, structuredClone(entity));
    return structuredClone(entity);
  }

  async updateEntity(id: string, updates: Record<string, unknown>): Promise<TEntity> {
    this.hydrate();
    const existing = this.entities.get(id);
    if (!existing) {
      throw new Error(`${this.name}: entity with id ${id} not found`);
    }

    const updated = { ...existing } as Record<string, unknown>;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue;
      if (value === undefined) continue;

      if (key === 'metadata' && typeof value === 'object' && value !== null) {
        updated['metadata'] = {
          ...((updated['metadata'] as Record<string, unknown> | undefined) ?? {}),
          ...(value as Record<string, unknown>),
        };
      } else {
        updated[key] = value;
      }
    }
    updated['updatedAt'] = new Date();

    const updatedEntity = updated as TEntity;
    this.entities.set(id, structuredClone(updatedEntity));

    // Persist to disk when publication state changes:
    // - entity becomes published (write to disk)
    // - entity was published but status changed (remove from disk)
    const wasPublished = existing.status === 'published';
    const isPublished = updatedEntity.status === 'published' && updatedEntity.activeVersionId;
    if (isPublished || (wasPublished && updates['status'] !== undefined)) {
      this.persistToDisk();
    }

    return structuredClone(updatedEntity);
  }

  async deleteEntity(id: string): Promise<void> {
    this.hydrate();
    this.entities.delete(id);
    await this.deleteVersionsByParentId(id);
    this.persistToDisk();
  }

  async listEntities(args: {
    page?: number;
    perPage?: number | false;
    orderBy?: StorageOrderBy;
    filters?: Record<string, unknown>;
    listKey: string;
  }): Promise<Record<string, unknown>> {
    this.hydrate();
    const { page = 0, perPage: perPageInput, orderBy, filters, listKey } = args;

    const perPage = normalizePerPage(perPageInput, 100);
    if (page < 0) throw new Error('page must be >= 0');

    let entities = Array.from(this.entities.values());

    // Apply filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;
        if (key === 'metadata' && typeof value === 'object' && value !== null) {
          entities = entities.filter(e => {
            const meta = (e as Record<string, unknown>)['metadata'] as Record<string, unknown> | undefined;
            if (!meta) return false;
            return Object.entries(value as Record<string, unknown>).every(
              ([k, v]) => JSON.stringify(meta[k]) === JSON.stringify(v),
            );
          });
        } else {
          entities = entities.filter(e => (e as Record<string, unknown>)[key] === value);
        }
      }
    }

    // Sort
    const field = (orderBy?.field as string) ?? 'createdAt';
    const direction = (orderBy?.direction as string) ?? 'DESC';
    entities.sort((a, b) => {
      const aVal = new Date((a as Record<string, unknown>)[field] as string | Date).getTime();
      const bVal = new Date((b as Record<string, unknown>)[field] as string | Date).getTime();
      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      [listKey]: entities.slice(offset, offset + perPage),
      total: entities.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < entities.length,
    };
  }

  // ==========================================================================
  // Version Methods (in-memory + git history)
  // ==========================================================================

  async createVersion(input: TVersion): Promise<TVersion> {
    await this.ensureGitHistory();
    if (this.versions.has(input.id)) {
      throw new Error(`${this.name}: version with id ${input.id} already exists`);
    }

    const parentId = (input as Record<string, unknown>)[this.parentIdField] as string;

    // Check for duplicate (parentId, versionNumber) pair
    for (const v of this.versions.values()) {
      if ((v as Record<string, unknown>)[this.parentIdField] === parentId && v.versionNumber === input.versionNumber) {
        throw new Error(`${this.name}: version number ${input.versionNumber} already exists for entity ${parentId}`);
      }
    }

    const version: TVersion = {
      ...input,
      createdAt: new Date(),
    } as TVersion;

    this.versions.set(input.id, structuredClone(version));
    return structuredClone(version);
  }

  async getVersion(id: string): Promise<TVersion | null> {
    await this.ensureGitHistory();
    return this.versions.has(id) ? structuredClone(this.versions.get(id)!) : null;
  }

  async getVersionByNumber(entityId: string, versionNumber: number): Promise<TVersion | null> {
    await this.ensureGitHistory();
    for (const v of this.versions.values()) {
      if ((v as Record<string, unknown>)[this.parentIdField] === entityId && v.versionNumber === versionNumber) {
        return structuredClone(v);
      }
    }
    return null;
  }

  async getLatestVersion(entityId: string): Promise<TVersion | null> {
    await this.ensureGitHistory();
    let latest: TVersion | null = null;
    for (const v of this.versions.values()) {
      if ((v as Record<string, unknown>)[this.parentIdField] === entityId) {
        if (!latest || v.versionNumber > latest.versionNumber) {
          latest = v;
        }
      }
    }
    return latest ? structuredClone(latest) : null;
  }

  async listVersions(input: ListVersionsInputBase, parentIdField: string): Promise<ListVersionsOutputBase<TVersion>> {
    await this.ensureGitHistory();
    const { page = 0, perPage: perPageInput, orderBy } = input;
    const entityId = (input as Record<string, unknown>)[parentIdField] as string;

    const perPage = normalizePerPage(perPageInput, 20);
    if (page < 0) throw new Error('page must be >= 0');

    let versions = Array.from(this.versions.values()).filter(
      v => (v as Record<string, unknown>)[this.parentIdField] === entityId,
    );

    // Sort
    const field = (orderBy?.field as string) ?? 'versionNumber';
    const direction = (orderBy?.direction as string) ?? 'DESC';
    versions.sort((a, b) => {
      const aVal = field === 'createdAt' ? new Date(a.createdAt).getTime() : a.versionNumber;
      const bVal = field === 'createdAt' ? new Date(b.createdAt).getTime() : b.versionNumber;
      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      versions: versions.slice(offset, offset + perPage),
      total: versions.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < versions.length,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    await this.ensureGitHistory();
    // Git-based versions are read-only
    if (FilesystemVersionedHelpers.isGitVersion(id)) return;
    this.versions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.ensureGitHistory();
    for (const [versionId, version] of this.versions) {
      if ((version as Record<string, unknown>)[this.parentIdField] === entityId) {
        // Skip git-based versions (read-only)
        if (FilesystemVersionedHelpers.isGitVersion(versionId)) continue;
        this.versions.delete(versionId);
      }
    }
  }

  async countVersions(entityId: string): Promise<number> {
    await this.ensureGitHistory();
    let count = 0;
    for (const v of this.versions.values()) {
      if ((v as Record<string, unknown>)[this.parentIdField] === entityId) {
        count++;
      }
    }
    return count;
  }

  async getNextVersionNumber(entityId: string): Promise<number> {
    await this.ensureGitHistory();
    return this._getNextVersionNumber(entityId);
  }

  private _getNextVersionNumber(entityId: string): number {
    const gitCount = this.gitVersionCounts.get(entityId) ?? 0;
    let maxVersion = gitCount;
    for (const v of this.versions.values()) {
      if ((v as Record<string, unknown>)[this.parentIdField] === entityId) {
        maxVersion = Math.max(maxVersion, v.versionNumber);
      }
    }
    return maxVersion + 1;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.entities.clear();
    this.versions.clear();
    this.gitVersionCounts.clear();
    this.gitHistoryPromise = null;
    this.hydrated = false;
    this.db.clearDomain(this.entitiesFile);
  }
}
