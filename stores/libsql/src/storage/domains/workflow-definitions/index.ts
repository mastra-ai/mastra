import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  WorkflowDefinitionsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_WORKFLOW_DEFINITIONS,
  TABLE_WORKFLOW_DEFINITION_VERSIONS,
  WORKFLOW_DEFINITIONS_SCHEMA,
  WORKFLOW_DEFINITION_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageWorkflowDefinitionType,
  StorageCreateWorkflowDefinitionInput,
  StorageUpdateWorkflowDefinitionInput,
  StorageListWorkflowDefinitionsInput,
  StorageListWorkflowDefinitionsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  WorkflowDefinitionVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class WorkflowDefinitionsLibSQL extends WorkflowDefinitionsStorage {
  #db: LibSQLDB;

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_DEFINITIONS, TABLE_WORKFLOW_DEFINITION_VERSIONS] as const;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_DEFINITIONS, schema: WORKFLOW_DEFINITIONS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
      schema: WORKFLOW_DEFINITION_VERSIONS_SCHEMA,
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS });
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_DEFINITIONS });
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_workflow_definitions_owner_id',
        table: TABLE_WORKFLOW_DEFINITIONS,
        columns: ['ownerId'],
      },
      {
        name: 'idx_workflow_definition_versions_definition_id',
        table: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        columns: ['workflowDefinitionId'],
      },
      {
        name: 'idx_workflow_definition_versions_definition_version',
        table: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        columns: ['workflowDefinitionId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseDefinitionRow(row: any): StorageWorkflowDefinitionType {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      inputSchema: this.parseJson(row.inputSchema, 'inputSchema'),
      outputSchema: this.parseJson(row.outputSchema, 'outputSchema'),
      stateSchema: this.parseJson(row.stateSchema, 'stateSchema'),
      stepGraph: this.parseJson(row.stepGraph, 'stepGraph'),
      steps: this.parseJson(row.steps, 'steps'),
      retryConfig: this.parseJson(row.retryConfig, 'retryConfig'),
      ownerId: row.ownerId as string | undefined,
      activeVersionId: row.activeVersionId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: any): WorkflowDefinitionVersion {
    return {
      id: row.id as string,
      workflowDefinitionId: row.workflowDefinitionId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string | undefined,
      snapshot: this.parseJson(row.snapshot, 'snapshot'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }

  // ==================== CRUD Methods ====================

  async createWorkflowDefinition(input: {
    definition: StorageCreateWorkflowDefinitionInput;
  }): Promise<StorageWorkflowDefinitionType> {
    const { definition } = input;
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        record: {
          id: definition.id,
          name: definition.name,
          description: definition.description ?? null,
          inputSchema: definition.inputSchema,
          outputSchema: definition.outputSchema,
          stateSchema: definition.stateSchema ?? null,
          stepGraph: definition.stepGraph,
          steps: definition.steps,
          retryConfig: definition.retryConfig ?? null,
          ownerId: definition.ownerId ?? null,
          activeVersionId: definition.activeVersionId ?? null,
          metadata: definition.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        ...definition,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_WORKFLOW_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { definitionId: definition.id },
        },
        error,
      );
    }
  }

  async getWorkflowDefinitionById(input: { id: string }): Promise<StorageWorkflowDefinitionType | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        keys: { id: input.id },
      });

      return result ? this.parseDefinitionRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_WORKFLOW_DEFINITION_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { definitionId: input.id },
        },
        error,
      );
    }
  }

  async updateWorkflowDefinition(input: StorageUpdateWorkflowDefinitionInput): Promise<StorageWorkflowDefinitionType> {
    const { id, ...updates } = input;
    try {
      // First, get the existing definition
      const existingDefinition = await this.getWorkflowDefinitionById({ id });
      if (!existingDefinition) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_WORKFLOW_DEFINITION', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Workflow definition ${id} not found`,
          details: { definitionId: id },
        });
      }

      // Build the data object with only the fields that are being updated
      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.inputSchema !== undefined) data.inputSchema = updates.inputSchema;
      if (updates.outputSchema !== undefined) data.outputSchema = updates.outputSchema;
      if (updates.stateSchema !== undefined) data.stateSchema = updates.stateSchema;
      if (updates.stepGraph !== undefined) data.stepGraph = updates.stepGraph;
      if (updates.steps !== undefined) data.steps = updates.steps;
      if (updates.retryConfig !== undefined) data.retryConfig = updates.retryConfig;
      if (updates.ownerId !== undefined) data.ownerId = updates.ownerId;
      if (updates.activeVersionId !== undefined) data.activeVersionId = updates.activeVersionId;
      if (updates.metadata !== undefined) {
        // Merge metadata
        data.metadata = { ...existingDefinition.metadata, ...updates.metadata };
      }

      // Only update if there's more than just updatedAt
      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_WORKFLOW_DEFINITIONS,
          keys: { id },
          data,
        });
      }

      // Return the updated definition
      const updatedDefinition = await this.getWorkflowDefinitionById({ id });
      if (!updatedDefinition) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_WORKFLOW_DEFINITION', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Workflow definition ${id} not found after update`,
          details: { definitionId: id },
        });
      }

      return updatedDefinition;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_WORKFLOW_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { definitionId: id },
        },
        error,
      );
    }
  }

  async deleteWorkflowDefinition(input: { id: string }): Promise<void> {
    try {
      // First delete all versions (cascade)
      await this.deleteVersionsByWorkflowDefinitionId(input.id);

      // Then delete the definition
      await this.#db.delete({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        keys: { id: input.id },
      });
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_WORKFLOW_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { definitionId: input.id },
        },
        error,
      );
    }
  }

  async listWorkflowDefinitions(
    input?: StorageListWorkflowDefinitionsInput,
  ): Promise<StorageListWorkflowDefinitionsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = input || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WORKFLOW_DEFINITIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const args: any[] = [];

      if (ownerId !== undefined) {
        conditions.push('"ownerId" = ?');
        args.push(ownerId);
      }

      // Note: metadata filtering is complex for JSON in SQLite; we filter in-memory for simplicity
      // Production implementations may use JSON_EXTRACT for specific keys

      const whereClause = conditions.length > 0 ? { sql: `WHERE ${conditions.join(' AND ')}`, args } : undefined;

      // Get total count
      const total = await this.#db.selectTotalCount({ tableName: TABLE_WORKFLOW_DEFINITIONS, whereClause });

      if (total === 0) {
        return {
          definitions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        whereClause,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
      });

      let definitions = rows.map(row => this.parseDefinitionRow(row));

      // Filter by metadata in-memory if needed
      if (metadata && Object.keys(metadata).length > 0) {
        definitions = definitions.filter(def => {
          if (!def.metadata) return false;
          return Object.entries(metadata).every(([key, value]) => def.metadata?.[key] === value);
        });
      }

      return {
        definitions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WORKFLOW_DEFINITIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==================== Version Methods ====================

  async createVersion(input: CreateVersionInput): Promise<WorkflowDefinitionVersion> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        record: {
          id: input.id,
          workflowDefinitionId: input.workflowDefinitionId,
          versionNumber: input.versionNumber,
          name: input.name ?? null,
          snapshot: input.snapshot,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, workflowDefinitionId: input.workflowDefinitionId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<WorkflowDefinitionVersion | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        keys: { id },
      });

      return result ? this.parseVersionRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(
    workflowDefinitionId: string,
    versionNumber: number,
  ): Promise<WorkflowDefinitionVersion | null> {
    try {
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        whereClause: {
          sql: 'WHERE "workflowDefinitionId" = ? AND "versionNumber" = ?',
          args: [workflowDefinitionId, versionNumber],
        },
        limit: 1,
      });

      return rows.length > 0 ? this.parseVersionRow(rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowDefinitionId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(workflowDefinitionId: string): Promise<WorkflowDefinitionVersion | null> {
    try {
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        whereClause: {
          sql: 'WHERE "workflowDefinitionId" = ?',
          args: [workflowDefinitionId],
        },
        orderBy: '"versionNumber" DESC',
        limit: 1,
      });

      return rows.length > 0 ? this.parseVersionRow(rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowDefinitionId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { workflowDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const whereClause = {
        sql: 'WHERE "workflowDefinitionId" = ?',
        args: [workflowDefinitionId],
      };

      // Get total count
      const total = await this.#db.selectTotalCount({ tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS, whereClause });

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        whereClause,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
      });

      const versions = rows.map(row => this.parseVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowDefinitionId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.#db.delete({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByWorkflowDefinitionId(workflowDefinitionId: string): Promise<void> {
    try {
      // Get all versions for this definition
      const versions = await this.listVersions({
        workflowDefinitionId,
        perPage: false, // Get all versions
      });

      if (versions.versions.length > 0) {
        await this.#db.batchDelete({
          tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
          keys: versions.versions.map(v => ({ id: v.id })),
        });
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_VERSIONS_BY_WORKFLOW_DEFINITION_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowDefinitionId },
        },
        error,
      );
    }
  }

  async countVersions(workflowDefinitionId: string): Promise<number> {
    try {
      return await this.#db.selectTotalCount({
        tableName: TABLE_WORKFLOW_DEFINITION_VERSIONS,
        whereClause: {
          sql: 'WHERE "workflowDefinitionId" = ?',
          args: [workflowDefinitionId],
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowDefinitionId },
        },
        error,
      );
    }
  }
}
