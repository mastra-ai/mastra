import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StoragePromptBlockType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  EntityOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  PromptBlockVersion,
  CreatePromptBlockVersionInput,
  ListPromptBlockVersionsInput,
  ListPromptBlockVersionsOutput,
  PromptBlockVersionOrderBy,
  PromptBlockVersionSortDirection,
} from './base';
import { PromptBlocksStorage } from './base';

export class InMemoryPromptBlocksStorage extends PromptBlocksStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.promptBlocks.clear();
    this.db.promptBlockVersions.clear();
  }

  // ==========================================================================
  // Prompt Block CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StoragePromptBlockType | null> {
    this.logger.debug(`InMemoryPromptBlocksStorage: getById called for ${id}`);
    const block = this.db.promptBlocks.get(id);
    return block ? this.deepCopyBlock(block) : null;
  }

  async create(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    const { promptBlock } = input;
    this.logger.debug(`InMemoryPromptBlocksStorage: create called for ${promptBlock.id}`);

    if (this.db.promptBlocks.has(promptBlock.id)) {
      throw new Error(`Prompt block with id ${promptBlock.id} already exists`);
    }

    const now = new Date();
    const newBlock: StoragePromptBlockType = {
      id: promptBlock.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: promptBlock.authorId,
      metadata: promptBlock.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.promptBlocks.set(promptBlock.id, newBlock);

    // Extract config fields from the flat input (everything except block-record fields)
    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = promptBlock;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      blockId: promptBlock.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin block record
    return this.deepCopyBlock(newBlock);
  }

  async update(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    const { id, ...updates } = input;
    this.logger.debug(`InMemoryPromptBlocksStorage: update called for ${id}`);

    const existingBlock = this.db.promptBlocks.get(id);
    if (!existingBlock) {
      throw new Error(`Prompt block with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, activeVersionId, metadata, status } = updates;

    // Update metadata fields on the block record
    const updatedBlock: StoragePromptBlockType = {
      ...existingBlock,
      ...(authorId !== undefined && { authorId }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StoragePromptBlockType['status'] }),
      ...(metadata !== undefined && {
        metadata: { ...existingBlock.metadata, ...metadata },
      }),
      updatedAt: new Date(),
    };

    // Save the updated block record
    this.db.promptBlocks.set(id, updatedBlock);
    return this.deepCopyBlock(updatedBlock);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`InMemoryPromptBlocksStorage: delete called for ${id}`);
    // Idempotent delete
    this.db.promptBlocks.delete(id);
    // Also delete all versions for this block
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryPromptBlocksStorage: list called`);

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

    // Get all blocks and apply filters
    let blocks = Array.from(this.db.promptBlocks.values());

    // Filter by status
    if (status) {
      blocks = blocks.filter(block => block.status === status);
    }

    // Filter by authorId if provided
    if (authorId !== undefined) {
      blocks = blocks.filter(block => block.authorId === authorId);
    }

    // Filter by metadata if provided (AND logic)
    if (metadata && Object.keys(metadata).length > 0) {
      blocks = blocks.filter(block => {
        if (!block.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(block.metadata![key], value));
      });
    }

    // Sort filtered blocks
    const sortedBlocks = this.sortBlocks(blocks, field, direction);

    // Deep clone blocks to avoid mutation
    const clonedBlocks = sortedBlocks.map(block => this.deepCopyBlock(block));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      promptBlocks: clonedBlocks.slice(offset, offset + perPage),
      total: clonedBlocks.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedBlocks.length,
    };
  }

  // ==========================================================================
  // Prompt Block Version Methods
  // ==========================================================================

  async createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion> {
    this.logger.debug(`InMemoryPromptBlocksStorage: createVersion called for block ${input.blockId}`);

    // Check if version with this ID already exists
    if (this.db.promptBlockVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (blockId, versionNumber) pair
    for (const version of this.db.promptBlockVersions.values()) {
      if (version.blockId === input.blockId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for prompt block ${input.blockId}`);
      }
    }

    const version: PromptBlockVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing
    this.db.promptBlockVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<PromptBlockVersion | null> {
    this.logger.debug(`InMemoryPromptBlocksStorage: getVersion called for ${id}`);
    const version = this.db.promptBlockVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null> {
    this.logger.debug(`InMemoryPromptBlocksStorage: getVersionByNumber called for block ${blockId}, v${versionNumber}`);

    for (const version of this.db.promptBlockVersions.values()) {
      if (version.blockId === blockId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(blockId: string): Promise<PromptBlockVersion | null> {
    this.logger.debug(`InMemoryPromptBlocksStorage: getLatestVersion called for block ${blockId}`);

    let latest: PromptBlockVersion | null = null;
    for (const version of this.db.promptBlockVersions.values()) {
      if (version.blockId === blockId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput> {
    const { blockId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryPromptBlocksStorage: listVersions called for block ${blockId}`);

    // Normalize perPage (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by blockId
    let versions = Array.from(this.db.promptBlockVersions.values()).filter(v => v.blockId === blockId);

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
    this.logger.debug(`InMemoryPromptBlocksStorage: deleteVersion called for ${id}`);
    this.db.promptBlockVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(`InMemoryPromptBlocksStorage: deleteVersionsByParentId called for block ${entityId}`);

    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.promptBlockVersions.entries()) {
      if (version.blockId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.promptBlockVersions.delete(id);
    }
  }

  async countVersions(blockId: string): Promise<number> {
    this.logger.debug(`InMemoryPromptBlocksStorage: countVersions called for block ${blockId}`);

    let count = 0;
    for (const version of this.db.promptBlockVersions.values()) {
      if (version.blockId === blockId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private deepCopyBlock(block: StoragePromptBlockType): StoragePromptBlockType {
    return {
      ...block,
      metadata: block.metadata ? { ...block.metadata } : block.metadata,
    };
  }

  private deepCopyVersion(version: PromptBlockVersion): PromptBlockVersion {
    return {
      ...version,
      rules: version.rules ? JSON.parse(JSON.stringify(version.rules)) : version.rules,
      changedFields: version.changedFields ? [...version.changedFields] : version.changedFields,
    };
  }

  private sortBlocks(
    blocks: StoragePromptBlockType[],
    field: EntityOrderBy,
    direction: ThreadSortDirection,
  ): StoragePromptBlockType[] {
    return blocks.sort((a, b) => {
      const aValue = a[field].getTime();
      const bValue = b[field].getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortVersions(
    versions: PromptBlockVersion[],
    field: PromptBlockVersionOrderBy,
    direction: PromptBlockVersionSortDirection,
  ): PromptBlockVersion[] {
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
