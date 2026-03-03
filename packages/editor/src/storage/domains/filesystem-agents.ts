import { AgentsStorage } from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
} from '@mastra/core/storage';
import type { AgentVersion, CreateVersionInput, ListVersionsInput, ListVersionsOutput } from '@mastra/core/storage';

import type { FilesystemDB } from '../filesystem-db';
import { FilesystemVersionedHelpers } from '../filesystem-versioned';

/**
 * Fields persisted for filesystem-stored agents.
 * Only fields that `applyStoredOverrides` actually uses plus the
 * minimum required by the storage schema (`name`, `model`).
 */
const PERSISTED_SNAPSHOT_FIELDS = new Set([
  'name',
  'instructions',
  'model',
  'tools',
  'integrationTools',
  'mcpClients',
  'requestContextSchema',
]);

function stripUnusedFields<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (PERSISTED_SNAPSHOT_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result as T;
}

export class FilesystemAgentsStorage extends AgentsStorage {
  private helpers: FilesystemVersionedHelpers<StorageAgentType, AgentVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'agents.json',
      parentIdField: 'agentId',
      name: 'FilesystemAgentsStorage',
      versionMetadataFields: ['id', 'agentId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;
    const now = new Date();
    const entity: StorageAgentType = {
      id: agent.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: agent.authorId,
      metadata: agent.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(agent.id, entity);

    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = agent;
    const filtered = stripUnusedFields(snapshotConfig);
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      agentId: agent.id,
      versionNumber: 1,
      ...filtered,
      changedFields: Object.keys(filtered),
      changeMessage: 'Initial version',
    } as CreateVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    return this.helpers.updateEntity(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page, perPage, orderBy, authorId, metadata, status } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'agents',
      filters: { authorId, metadata, status },
    });
    return result as unknown as StorageListAgentsOutput;
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    const { id, agentId, versionNumber, changedFields, changeMessage, ...snapshotFields } = input;
    const filtered = stripUnusedFields(snapshotFields as Record<string, unknown>);
    return this.helpers.createVersion({
      id,
      agentId,
      versionNumber,
      changedFields,
      changeMessage,
      ...filtered,
    } as AgentVersion);
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    return this.helpers.getVersionByNumber(agentId, versionNumber);
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    return this.helpers.getLatestVersion(agentId);
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'agentId');
    return result as ListVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(agentId: string): Promise<number> {
    return this.helpers.countVersions(agentId);
  }
}
