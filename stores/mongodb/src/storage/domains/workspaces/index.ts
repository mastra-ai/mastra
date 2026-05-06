import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  WorkspacesStorage,
  createStorageErrorId,
  TABLE_WORKSPACES,
  TABLE_WORKSPACE_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageWorkspaceType,
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
} from '@mastra/core/storage';
import type {
  WorkspaceVersion,
  CreateWorkspaceVersionInput,
  ListWorkspaceVersionsInput,
  ListWorkspaceVersionsOutput,
} from '@mastra/core/storage/domains/workspaces';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * Snapshot config fields that live on workspace version documents.
 */
const SNAPSHOT_FIELDS = [
  'name',
  'description',
  'filesystem',
  'sandbox',
  'mounts',
  'search',
  'skills',
  'tools',
  'autoSync',
  'operationTimeout',
] as const;

export class MongoDBWorkspacesStorage extends WorkspacesStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_WORKSPACES, TABLE_WORKSPACE_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBWorkspacesStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_WORKSPACES, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_WORKSPACES, keys: { status: 1 } },
      { collection: TABLE_WORKSPACES, keys: { createdAt: -1 } },
      { collection: TABLE_WORKSPACES, keys: { authorId: 1 } },
      { collection: TABLE_WORKSPACE_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_WORKSPACE_VERSIONS,
        keys: { workspaceId: 1, versionNumber: -1 },
        options: { unique: true },
      },
      { collection: TABLE_WORKSPACE_VERSIONS, keys: { workspaceId: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const versionsCollection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
    await versionsCollection.deleteMany({});
    const workspacesCollection = await this.getCollection(TABLE_WORKSPACES);
    await workspacesCollection.deleteMany({});
  }

  // ==========================================================================
  // Workspace CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACES);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformWorkspace(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_WORKSPACE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { workspace: StorageCreateWorkspaceInput }): Promise<StorageWorkspaceType> {
    const { workspace } = input;
    try {
      const collection = await this.getCollection(TABLE_WORKSPACES);

      // Derive workspace ID from name, falling back to caller-provided ID
      const slug = workspace.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const id = slug || workspace.id;
      if (!id) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_WORKSPACE', 'INVALID_NAME'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Cannot derive a valid ID from workspace name "${workspace.name}"`,
          details: { name: workspace.name },
        });
      }

      // Check if workspace already exists
      const existing = await collection.findOne({ id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_WORKSPACE', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Workspace with id ${id} already exists`,
        });
      }

      const now = new Date();

      // Create thin workspace record
      const newWorkspace: StorageWorkspaceType = {
        id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: workspace.authorId,
        metadata: workspace.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeWorkspace(newWorkspace));

      // Extract snapshot config from flat input
      const snapshotConfig: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((workspace as any)[field] !== undefined) {
          snapshotConfig[field] = (workspace as any)[field];
        }
      }

      // Create version 1
      const versionId = randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          workspaceId: id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        } as CreateWorkspaceVersionInput);
      } catch (versionError) {
        // Clean up the orphaned workspace record
        await collection.deleteOne({ id });
        throw versionError;
      }

      return newWorkspace;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { name: workspace.name },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateWorkspaceInput): Promise<StorageWorkspaceType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_WORKSPACES);

      const existingWorkspace = await collection.findOne<any>({ id });
      if (!existingWorkspace) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_WORKSPACE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Workspace with id ${id} not found`,
        });
      }

      const updateDoc: Record<string, any> = {
        updatedAt: new Date(),
      };

      // Metadata-level fields
      const metadataFields = {
        authorId: updates.authorId,
        activeVersionId: updates.activeVersionId,
        metadata: updates.metadata,
        status: updates.status,
      };

      // Extract config fields
      const configFields: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((updates as any)[field] !== undefined) {
          configFields[field] = (updates as any)[field];
        }
      }

      // If we have config updates, create a new version
      if (Object.keys(configFields).length > 0) {
        const latestVersion = await this.getLatestVersion(id);

        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'UPDATE_WORKSPACE', 'NO_VERSION'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `Cannot update config fields for workspace ${id} - no versions exist`,
            details: { id },
          });
        }

        // Extract existing snapshot and merge with updates
        const existingSnapshot = this.extractSnapshotFields(latestVersion);

        await this.createVersion({
          id: randomUUID(),
          workspaceId: id,
          versionNumber: latestVersion.versionNumber + 1,
          ...existingSnapshot,
          ...configFields,
          changedFields: Object.keys(configFields),
          changeMessage: `Updated: ${Object.keys(configFields).join(', ')}`,
        } as CreateWorkspaceVersionInput);
      }

      // Handle metadata-level updates
      if (metadataFields.authorId !== undefined) updateDoc.authorId = metadataFields.authorId;
      if (metadataFields.activeVersionId !== undefined) {
        updateDoc.activeVersionId = metadataFields.activeVersionId;
        // Auto-set status to 'published' when activeVersionId is set, consistent with InMemory and LibSQL
        if (metadataFields.status === undefined) {
          updateDoc.status = 'published';
        }
      }
      if (metadataFields.status !== undefined) {
        updateDoc.status = metadataFields.status;
      }

      // Merge metadata
      if (metadataFields.metadata !== undefined) {
        const existingMetadata = existingWorkspace.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...metadataFields.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedWorkspace = await collection.findOne<any>({ id });
      if (!updatedWorkspace) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_WORKSPACE', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Workspace with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformWorkspace(updatedWorkspace);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete all versions first
      await this.deleteVersionsByParentId(id);

      // Then delete the workspace
      const collection = await this.getCollection(TABLE_WORKSPACES);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_WORKSPACES', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_WORKSPACES);

      // Build filter
      const filter: Record<string, any> = {};
      if (authorId) {
        filter.authorId = authorId;
      }
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          filter[`metadata.${key}`] = value;
        }
      }

      const total = await collection.countDocuments(filter);

      if (total === 0 || perPage === 0) {
        return {
          workspaces: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find(filter)
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const workspaces = results.map((doc: any) => this.transformWorkspace(doc));

      return {
        workspaces,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_WORKSPACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Workspace Version Methods
  // ==========================================================================

  async createVersion(input: CreateWorkspaceVersionInput): Promise<WorkspaceVersion> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      const now = new Date();

      const versionDoc: Record<string, any> = {
        id: input.id,
        workspaceId: input.workspaceId,
        versionNumber: input.versionNumber,
        changedFields: input.changedFields ?? undefined,
        changeMessage: input.changeMessage ?? undefined,
        createdAt: now,
      };

      // Copy snapshot fields
      for (const field of SNAPSHOT_FIELDS) {
        if ((input as any)[field] !== undefined) {
          versionDoc[field] = (input as any)[field];
        }
      }

      await collection.insertOne(versionDoc);

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, workspaceId: input.workspaceId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<WorkspaceVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(workspaceId: string, versionNumber: number): Promise<WorkspaceVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      const result = await collection.findOne<any>({ workspaceId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_WORKSPACE_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(workspaceId: string): Promise<WorkspaceVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      const result = await collection.find<any>({ workspaceId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListWorkspaceVersionsInput): Promise<ListWorkspaceVersionsOutput> {
    const { workspaceId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_WORKSPACE_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);

      const total = await collection.countDocuments({ workspaceId });

      if (total === 0 || perPage === 0) {
        return {
          versions: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find({ workspaceId })
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const versions = results.map((doc: any) => this.transformVersion(doc));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(workspaceId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      await collection.deleteMany({ workspaceId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_WORKSPACE_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }

  async countVersions(workspaceId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_WORKSPACE_VERSIONS);
      return await collection.countDocuments({ workspaceId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private transformWorkspace(doc: any): StorageWorkspaceType {
    const { _id, ...rest } = doc;
    return {
      id: rest.id,
      status: rest.status as 'draft' | 'published' | 'archived',
      activeVersionId: rest.activeVersionId,
      authorId: rest.authorId,
      metadata: rest.metadata,
      createdAt: rest.createdAt instanceof Date ? rest.createdAt : new Date(rest.createdAt),
      updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt : new Date(rest.updatedAt),
    };
  }

  private serializeWorkspace(workspace: StorageWorkspaceType): Record<string, any> {
    return {
      id: workspace.id,
      status: workspace.status,
      activeVersionId: workspace.activeVersionId,
      authorId: workspace.authorId,
      metadata: workspace.metadata,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  private transformVersion(doc: any): WorkspaceVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      workspaceId: version.workspaceId,
      versionNumber: version.versionNumber,
      changedFields: version.changedFields,
      changeMessage: version.changeMessage,
      createdAt: version.createdAt instanceof Date ? version.createdAt : new Date(version.createdAt),
    };

    // Copy snapshot fields
    for (const field of SNAPSHOT_FIELDS) {
      if (version[field] !== undefined) {
        result[field] = version[field];
      }
    }

    return result as WorkspaceVersion;
  }

  private extractSnapshotFields(version: WorkspaceVersion): Record<string, any> {
    const result: Record<string, any> = {};
    for (const field of SNAPSHOT_FIELDS) {
      if ((version as any)[field] !== undefined) {
        result[field] = (version as any)[field];
      }
    }
    return result;
  }
}
