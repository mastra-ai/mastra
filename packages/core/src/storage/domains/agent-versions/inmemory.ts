import { normalizePerPage, calculatePagination } from '../../base';
import type { InMemoryDB } from '../inmemory-db';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  VersionOrderBy,
  VersionSortDirection,
} from './base';
import { AgentVersionsStorage } from './base';

export class InMemoryAgentVersionsStorage extends AgentVersionsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.agentVersions.clear();
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    this.logger.debug(`InMemoryAgentVersionsStorage: createVersion called for agent ${input.agentId}`);

    const version: AgentVersion = {
      ...input,
      createdAt: new Date(),
    };

    this.db.agentVersions.set(input.id, version);
    return { ...version };
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentVersionsStorage: getVersion called for ${id}`);
    const version = this.db.agentVersions.get(id);
    return version ? { ...version } : null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    this.logger.debug(
      `InMemoryAgentVersionsStorage: getVersionByNumber called for agent ${agentId}, v${versionNumber}`,
    );

    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId && version.versionNumber === versionNumber) {
        return { ...version };
      }
    }
    return null;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentVersionsStorage: getLatestVersion called for agent ${agentId}`);

    let latest: AgentVersion | null = null;
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? { ...latest } : null;
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryAgentVersionsStorage: listVersions called for agent ${agentId}`);

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

    // Filter versions by agentId
    let versions = Array.from(this.db.agentVersions.values()).filter(v => v.agentId === agentId);

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
      perPage: perPageForResponse === false ? total : perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    this.logger.debug(`InMemoryAgentVersionsStorage: deleteVersion called for ${id}`);
    // Idempotent delete - no-op if version doesn't exist
    this.db.agentVersions.delete(id);
  }

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    this.logger.debug(`InMemoryAgentVersionsStorage: deleteVersionsByAgentId called for agent ${agentId}`);

    for (const [id, version] of this.db.agentVersions.entries()) {
      if (version.agentId === agentId) {
        this.db.agentVersions.delete(id);
      }
    }
  }

  async countVersions(agentId: string): Promise<number> {
    this.logger.debug(`InMemoryAgentVersionsStorage: countVersions called for agent ${agentId}`);

    let count = 0;
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId) {
        count++;
      }
    }
    return count;
  }

  private sortVersions(
    versions: AgentVersion[],
    field: VersionOrderBy,
    direction: VersionSortDirection,
  ): AgentVersion[] {
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
