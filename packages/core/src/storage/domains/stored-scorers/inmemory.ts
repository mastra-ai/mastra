import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StoredScorerType,
  StorageCreateScorerInput,
  StorageUpdateScorerInput,
  StorageListScorersInput,
  StorageListScorersOutput,
  ThreadOrderBy,
  ThreadSortDirection,
  StoredScorerVersionType,
  StorageCreateScorerVersionInput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  ListScorerVersionsInput,
  ListScorerVersionsOutput,
  ScorerVersionOrderBy,
  ScorerVersionSortDirection,
} from './base';
import { StoredScorersStorage } from './base';

export class InMemoryStoredScorersStorage extends StoredScorersStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.storedScorers.clear();
    this.db.scorerVersions.clear();
  }

  // ==========================================================================
  // Scorer CRUD Methods
  // ==========================================================================

  async getScorerById({ id }: { id: string }): Promise<StoredScorerType | null> {
    this.logger.debug(`InMemoryStoredScorersStorage: getScorerById called for ${id}`);
    const scorer = this.db.storedScorers.get(id);
    return scorer
      ? {
          ...scorer,
          metadata: scorer.metadata ? { ...scorer.metadata } : scorer.metadata,
          model: { ...scorer.model },
          scoreRange: { ...scorer.scoreRange },
        }
      : null;
  }

  async createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StoredScorerType> {
    this.logger.debug(`InMemoryStoredScorersStorage: createScorer called for ${scorer.id}`);

    if (this.db.storedScorers.has(scorer.id)) {
      throw new Error(`Scorer with id ${scorer.id} already exists`);
    }

    const now = new Date();
    const newScorer: StoredScorerType = {
      ...scorer,
      createdAt: now,
      updatedAt: now,
    };

    this.db.storedScorers.set(scorer.id, newScorer);
    return { ...newScorer };
  }

  async updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StoredScorerType> {
    this.logger.debug(`InMemoryStoredScorersStorage: updateScorer called for ${id}`);

    const existingScorer = this.db.storedScorers.get(id);
    if (!existingScorer) {
      throw new Error(`Scorer with id ${id} not found`);
    }

    const updatedScorer: StoredScorerType = {
      ...existingScorer,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.model !== undefined && { model: updates.model }),
      ...(updates.prompt !== undefined && { prompt: updates.prompt }),
      ...(updates.scoreRange !== undefined && { scoreRange: updates.scoreRange }),
      ...(updates.metadata !== undefined && {
        metadata: { ...existingScorer.metadata, ...updates.metadata },
      }),
      ...(updates.ownerId !== undefined && { ownerId: updates.ownerId }),
      ...(updates.activeVersionId !== undefined && { activeVersionId: updates.activeVersionId }),
      updatedAt: new Date(),
    };

    this.db.storedScorers.set(id, updatedScorer);
    return { ...updatedScorer };
  }

  async deleteScorer({ id }: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryStoredScorersStorage: deleteScorer called for ${id}`);
    // Idempotent delete - no-op if scorer doesn't exist
    this.db.storedScorers.delete(id);
    // Also delete all versions for this scorer
    await this.deleteScorerVersionsByScorerId(id);
  }

  async listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryStoredScorersStorage: listScorers called`);

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

    // Get all scorers and apply filters
    let scorers = Array.from(this.db.storedScorers.values());

    // Filter by ownerId if provided
    if (ownerId !== undefined) {
      scorers = scorers.filter(scorer => scorer.ownerId === ownerId);
    }

    // Filter by metadata if provided (AND logic - all key-value pairs must match)
    if (metadata && Object.keys(metadata).length > 0) {
      scorers = scorers.filter(scorer => {
        if (!scorer.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(scorer.metadata![key], value));
      });
    }

    // Sort filtered scorers
    const sortedScorers = this.sortScorers(scorers, field, direction);

    // Clone scorers to avoid mutation
    const clonedScorers = sortedScorers.map(scorer => ({
      ...scorer,
      metadata: scorer.metadata ? { ...scorer.metadata } : scorer.metadata,
      model: { ...scorer.model },
      scoreRange: { ...scorer.scoreRange },
    }));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      scorers: clonedScorers.slice(offset, offset + perPage),
      total: clonedScorers.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedScorers.length,
    };
  }

  // ==========================================================================
  // Scorer Version Methods
  // ==========================================================================

  async createScorerVersion(input: StorageCreateScorerVersionInput): Promise<StoredScorerVersionType> {
    this.logger.debug(`InMemoryStoredScorersStorage: createScorerVersion called for scorer ${input.scorerId}`);

    // Check if version with this ID already exists (versions are immutable)
    if (this.db.scorerVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    const version: StoredScorerVersionType = {
      ...input,
      createdAt: new Date(),
    };

    this.db.scorerVersions.set(input.id, version);
    return { ...version };
  }

  async getScorerVersion(id: string): Promise<StoredScorerVersionType | null> {
    this.logger.debug(`InMemoryStoredScorersStorage: getScorerVersion called for ${id}`);
    const version = this.db.scorerVersions.get(id);
    return version ? { ...version } : null;
  }

  async getScorerVersionByNumber(scorerId: string, versionNumber: number): Promise<StoredScorerVersionType | null> {
    this.logger.debug(
      `InMemoryStoredScorersStorage: getScorerVersionByNumber called for scorer ${scorerId}, v${versionNumber}`,
    );

    for (const version of this.db.scorerVersions.values()) {
      if (version.scorerId === scorerId && version.versionNumber === versionNumber) {
        return { ...version };
      }
    }
    return null;
  }

  async getLatestScorerVersion(scorerId: string): Promise<StoredScorerVersionType | null> {
    this.logger.debug(`InMemoryStoredScorersStorage: getLatestScorerVersion called for scorer ${scorerId}`);

    let latest: StoredScorerVersionType | null = null;
    for (const version of this.db.scorerVersions.values()) {
      if (version.scorerId === scorerId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? { ...latest } : null;
  }

  async listScorerVersions(input: ListScorerVersionsInput): Promise<ListScorerVersionsOutput> {
    const { scorerId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseScorerVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryStoredScorersStorage: listScorerVersions called for scorer ${scorerId}`);

    // Normalize perPage for query (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by scorerId
    let versions = Array.from(this.db.scorerVersions.values()).filter(v => v.scorerId === scorerId);

    // Sort versions
    versions = this.sortVersions(versions, field, direction);

    // Clone versions to avoid mutation
    const clonedVersions = versions.map(v => ({ ...v }));

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

  async deleteScorerVersion(id: string): Promise<void> {
    this.logger.debug(`InMemoryStoredScorersStorage: deleteScorerVersion called for ${id}`);
    // Idempotent delete - no-op if version doesn't exist
    this.db.scorerVersions.delete(id);
  }

  async deleteScorerVersionsByScorerId(scorerId: string): Promise<void> {
    this.logger.debug(`InMemoryStoredScorersStorage: deleteScorerVersionsByScorerId called for scorer ${scorerId}`);

    for (const [id, version] of this.db.scorerVersions.entries()) {
      if (version.scorerId === scorerId) {
        this.db.scorerVersions.delete(id);
      }
    }
  }

  async countScorerVersions(scorerId: string): Promise<number> {
    this.logger.debug(`InMemoryStoredScorersStorage: countScorerVersions called for scorer ${scorerId}`);

    let count = 0;
    for (const version of this.db.scorerVersions.values()) {
      if (version.scorerId === scorerId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private sortScorers(
    scorers: StoredScorerType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StoredScorerType[] {
    return scorers.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortVersions(
    versions: StoredScorerVersionType[],
    field: ScorerVersionOrderBy,
    direction: ScorerVersionSortDirection,
  ): StoredScorerVersionType[] {
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
