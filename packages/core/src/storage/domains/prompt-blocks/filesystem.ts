import type { FilesystemDB } from '../../filesystem-db';
import { FilesystemVersionedHelpers } from '../../filesystem-versioned';
import type {
  StoragePromptBlockType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
} from '../../types';
import type {
  PromptBlockVersion,
  CreatePromptBlockVersionInput,
  ListPromptBlockVersionsInput,
  ListPromptBlockVersionsOutput,
} from './base';
import { PromptBlocksStorage } from './base';

export class FilesystemPromptBlocksStorage extends PromptBlocksStorage {
  private helpers: FilesystemVersionedHelpers<StoragePromptBlockType, PromptBlockVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'prompt-blocks.json',
      parentIdField: 'blockId',
      name: 'FilesystemPromptBlocksStorage',
      versionMetadataFields: ['id', 'blockId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StoragePromptBlockType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    const { promptBlock } = input;
    const now = new Date();
    const entity: StoragePromptBlockType = {
      id: promptBlock.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: promptBlock.authorId,
      metadata: promptBlock.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(promptBlock.id, entity);

    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = promptBlock;
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      blockId: promptBlock.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    } as CreatePromptBlockVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    const { id, ...updates } = input;
    return this.helpers.updateEntity(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    const { page, perPage, orderBy, authorId, metadata, status } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'promptBlocks',
      filters: { authorId, metadata, status },
    });
    return result as unknown as StorageListPromptBlocksOutput;
  }

  async createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion> {
    return this.helpers.createVersion(input as PromptBlockVersion);
  }

  async getVersion(id: string): Promise<PromptBlockVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null> {
    return this.helpers.getVersionByNumber(blockId, versionNumber);
  }

  async getLatestVersion(blockId: string): Promise<PromptBlockVersion | null> {
    return this.helpers.getLatestVersion(blockId);
  }

  async listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'blockId');
    return result as ListPromptBlockVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(blockId: string): Promise<number> {
    return this.helpers.countVersions(blockId);
  }
}
