import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  ScorerDefinitionVersion,
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
  ScorerDefinitionVersionOrderBy,
  ScorerDefinitionVersionSortDirection,
} from './base';
import { ScorerDefinitionsStorage } from './base';

export class InMemoryScorerDefinitionsStorage extends ScorerDefinitionsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.scorerDefinitions.clear();
    this.db.scorerDefinitionVersions.clear();
  }

  // ==========================================================================
  // Scorer Definition CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    this.logger.debug(`InMemoryScorerDefinitionsStorage: getById called for ${id}`);
    const scorer = this.db.scorerDefinitions.get(id);
    return scorer ? this.deepCopyScorer(scorer) : null;
  }

  async create(input: { scorerDefinition: StorageCreateScorerDefinitionInput }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    this.logger.debug(`InMemoryScorerDefinitionsStorage: create called for ${scorerDefinition.id}`);

    if (this.db.scorerDefinitions.has(scorerDefinition.id)) {
      throw new Error(`Scorer definition with id ${scorerDefinition.id} already exists`);
    }

    const now = new Date();
    const newScorer: StorageScorerDefinitionType = {
      id: scorerDefinition.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: scorerDefinition.authorId,
      metadata: scorerDefinition.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.scorerDefinitions.set(scorerDefinition.id, newScorer);

    // Extract config fields from the flat input (everything except scorer-record fields)
    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = scorerDefinition;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      scorerDefinitionId: scorerDefinition.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin scorer record
    return this.deepCopyScorer(newScorer);
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    this.logger.debug(`InMemoryScorerDefinitionsStorage: update called for ${id}`);

    const existingScorer = this.db.scorerDefinitions.get(id);
    if (!existingScorer) {
      throw new Error(`Scorer definition with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, activeVersionId, metadata, status } = updates;

    // Update metadata fields on the scorer record
    const updatedScorer: StorageScorerDefinitionType = {
      ...existingScorer,
      ...(authorId !== undefined && { authorId }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StorageScorerDefinitionType['status'] }),
      ...(metadata !== undefined && {
        metadata: { ...existingScorer.metadata, ...metadata },
      }),
      updatedAt: new Date(),
    };

    // Save the updated scorer record
    this.db.scorerDefinitions.set(id, updatedScorer);
    return this.deepCopyScorer(updatedScorer);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`InMemoryScorerDefinitionsStorage: delete called for ${id}`);
    // Idempotent delete
    this.db.scorerDefinitions.delete(id);
    // Also delete all versions for this scorer definition
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryScorerDefinitionsStorage: list called`);

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 100)
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Get all scorer definitions and apply filters
    let scorers = Array.from(this.db.scorerDefinitions.values());

    // Filter by status
    scorers = scorers.filter(scorer => scorer.status === status);

    // Filter by authorId if provided
    if (authorId !== undefined) {
      scorers = scorers.filter(scorer => scorer.authorId === authorId);
    }

    // Filter by metadata if provided (AND logic)
    if (metadata && Object.keys(metadata).length > 0) {
      scorers = scorers.filter(scorer => {
        if (!scorer.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(scorer.metadata![key], value));
      });
    }

    // Sort filtered scorer definitions
    const sortedScorers = this.sortScorers(scorers, field, direction);

    // Deep clone scorers to avoid mutation
    const clonedScorers = sortedScorers.map(scorer => this.deepCopyScorer(scorer));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      scorerDefinitions: clonedScorers.slice(offset, offset + perPage),
      total: clonedScorers.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedScorers.length,
    };
  }

  // ==========================================================================
  // Scorer Definition Version Methods
  // ==========================================================================

  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    this.logger.debug(
      `InMemoryScorerDefinitionsStorage: createVersion called for scorer definition ${input.scorerDefinitionId}`,
    );

    // Check if version with this ID already exists
    if (this.db.scorerDefinitionVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (scorerDefinitionId, versionNumber) pair
    for (const version of this.db.scorerDefinitionVersions.values()) {
      if (version.scorerDefinitionId === input.scorerDefinitionId && version.versionNumber === input.versionNumber) {
        throw new Error(
          `Version number ${input.versionNumber} already exists for scorer definition ${input.scorerDefinitionId}`,
        );
      }
    }

    const version: ScorerDefinitionVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing
    this.db.scorerDefinitionVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    this.logger.debug(`InMemoryScorerDefinitionsStorage: getVersion called for ${id}`);
    const version = this.db.scorerDefinitionVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(scorerDefinitionId: string, versionNumber: number): Promise<ScorerDefinitionVersion | null> {
    this.logger.debug(
      `InMemoryScorerDefinitionsStorage: getVersionByNumber called for scorer definition ${scorerDefinitionId}, v${versionNumber}`,
    );

    for (const version of this.db.scorerDefinitionVersions.values()) {
      if (version.scorerDefinitionId === scorerDefinitionId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    this.logger.debug(
      `InMemoryScorerDefinitionsStorage: getLatestVersion called for scorer definition ${scorerDefinitionId}`,
    );

    let latest: ScorerDefinitionVersion | null = null;
    for (const version of this.db.scorerDefinitionVersions.values()) {
      if (version.scorerDefinitionId === scorerDefinitionId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    const { scorerDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(
      `InMemoryScorerDefinitionsStorage: listVersions called for scorer definition ${scorerDefinitionId}`,
    );

    // Normalize perPage (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by scorerDefinitionId
    let versions = Array.from(this.db.scorerDefinitionVersions.values()).filter(
      v => v.scorerDefinitionId === scorerDefinitionId,
    );

    // Sort versions
    versions = this.sortVersions(versions, field, direction);

    // Deep clone
    const clonedVersions = versions.map(v => this.deepCopyVersion(v));

    const total = clonedVersions.length;
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const paginatedVersions = clonedVersions.slice(offset, offset + perPage);

    return {
      versions: paginatedVersions,
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    this.logger.debug(`InMemoryScorerDefinitionsStorage: deleteVersion called for ${id}`);
    this.db.scorerDefinitionVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(
      `InMemoryScorerDefinitionsStorage: deleteVersionsByParentId called for scorer definition ${entityId}`,
    );

    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.scorerDefinitionVersions.entries()) {
      if (version.scorerDefinitionId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.scorerDefinitionVersions.delete(id);
    }
  }

  async countVersions(scorerDefinitionId: string): Promise<number> {
    this.logger.debug(
      `InMemoryScorerDefinitionsStorage: countVersions called for scorer definition ${scorerDefinitionId}`,
    );

    let count = 0;
    for (const version of this.db.scorerDefinitionVersions.values()) {
      if (version.scorerDefinitionId === scorerDefinitionId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private deepCopyScorer(scorer: StorageScorerDefinitionType): StorageScorerDefinitionType {
    return {
      ...scorer,
      metadata: scorer.metadata ? { ...scorer.metadata } : scorer.metadata,
    };
  }

  private deepCopyVersion(version: ScorerDefinitionVersion): ScorerDefinitionVersion {
    return {
      ...version,
      model: version.model ? JSON.parse(JSON.stringify(version.model)) : version.model,
      scoreRange: version.scoreRange ? JSON.parse(JSON.stringify(version.scoreRange)) : version.scoreRange,
      presetConfig: version.presetConfig ? JSON.parse(JSON.stringify(version.presetConfig)) : version.presetConfig,
      defaultSampling: version.defaultSampling
        ? JSON.parse(JSON.stringify(version.defaultSampling))
        : version.defaultSampling,
      changedFields: version.changedFields ? [...version.changedFields] : version.changedFields,
    };
  }

  private sortScorers(
    scorers: StorageScorerDefinitionType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageScorerDefinitionType[] {
    return scorers.sort((a, b) => {
      const aValue = a[field].getTime();
      const bValue = b[field].getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortVersions(
    versions: ScorerDefinitionVersion[],
    field: ScorerDefinitionVersionOrderBy,
    direction: ScorerDefinitionVersionSortDirection,
  ): ScorerDefinitionVersion[] {
    return versions.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (field === 'createdAt') {
        aVal = a.createdAt.getTime();
        bVal = b.createdAt.getTime();
      } else {
        // versionNumber
        aVal = a.versionNumber;
        bVal = b.versionNumber;
      }

      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });
  }
}
