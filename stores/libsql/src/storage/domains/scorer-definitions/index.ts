import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ScorerDefinitionsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_SCORER_DEFINITIONS,
  TABLE_SCORER_DEFINITION_VERSIONS,
  SCORER_DEFINITIONS_SCHEMA,
  SCORER_DEFINITION_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
} from '@mastra/core/storage';
import type {
  ScorerDefinitionVersion,
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
} from '@mastra/core/storage/domains/scorer-definitions';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class ScorerDefinitionsLibSQL extends ScorerDefinitionsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SCORER_DEFINITIONS, schema: SCORER_DEFINITIONS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_SCORER_DEFINITION_VERSIONS,
      schema: SCORER_DEFINITION_VERSIONS_SCHEMA,
    });

    // Unique constraint on (scorerDefinitionId, versionNumber) to prevent duplicate versions from concurrent updates
    await this.#client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_scorer_definition_versions_scorer_version ON "${TABLE_SCORER_DEFINITION_VERSIONS}" ("scorerDefinitionId", "versionNumber")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SCORER_DEFINITIONS });
    await this.#db.deleteData({ tableName: TABLE_SCORER_DEFINITION_VERSIONS });
  }

  // ==========================================================================
  // Scorer Definition CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORER_DEFINITIONS)} FROM "${TABLE_SCORER_DEFINITIONS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseScorerRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async create(input: { scorerDefinition: StorageCreateScorerDefinitionInput }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    try {
      const now = new Date();

      // Insert thin scorer definition record
      await this.#db.insert({
        tableName: TABLE_SCORER_DEFINITIONS,
        record: {
          id: scorerDefinition.id,
          status: 'draft',
          activeVersionId: null,
          authorId: scorerDefinition.authorId ?? null,
          metadata: scorerDefinition.metadata ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      // Extract config fields for version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = scorerDefinition;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        scorerDefinitionId: scorerDefinition.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      });

      return {
        id: scorerDefinition.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: scorerDefinition.authorId,
        metadata: scorerDefinition.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Scorer definition with id ${id} not found`);
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Build update data for the scorer definition record
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) {
        updateData.metadata = { ...existing.metadata, ...metadata };
      }

      await this.#db.update({
        tableName: TABLE_SCORER_DEFINITIONS,
        keys: { id },
        data: updateData,
      });

      // Fetch and return updated scorer definition
      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer definition ${id} not found after update`,
          details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_SCORER_DEFINITIONS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      conditions.push('status = ?');
      queryParams.push(status);

      if (authorId !== undefined) {
        conditions.push('authorId = ?');
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          // Sanitize key to prevent SQL injection via json_extract path
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'LIST_SCORER_DEFINITIONS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          conditions.push(`json_extract(metadata, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_SCORER_DEFINITIONS}" ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          scorerDefinitions: [],
          total: 0,
          page,
          perPage: perPageInput ?? 100,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORER_DEFINITIONS)} FROM "${TABLE_SCORER_DEFINITIONS}" ${whereClause} ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const scorerDefinitions = result.rows?.map(row => this.#parseScorerRow(row)) ?? [];

      return {
        scorerDefinitions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORER_DEFINITIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Scorer Definition Version Methods
  // ==========================================================================

  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    try {
      const now = new Date();
      await this.#db.insert({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS,
        record: {
          id: input.id,
          scorerDefinitionId: input.scorerDefinitionId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          model: input.model ?? null,
          instructions: input.instructions ?? null,
          scoreRange: input.scoreRange ?? null,
          presetConfig: input.presetConfig ?? null,
          defaultSampling: input.defaultSampling ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now.toISOString(),
        },
      });

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORER_DEFINITION_VERSIONS)} FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersionByNumber(scorerDefinitionId: string, versionNumber: number): Promise<ScorerDefinitionVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORER_DEFINITION_VERSIONS)} FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE scorerDefinitionId = ? AND versionNumber = ?`,
        args: [scorerDefinitionId, versionNumber],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER_DEFINITION_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORER_DEFINITION_VERSIONS)} FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE scorerDefinitionId = ? ORDER BY versionNumber DESC LIMIT 1`,
        args: [scorerDefinitionId],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    try {
      const { scorerDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE scorerDefinitionId = ?`,
        args: [scorerDefinitionId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageInput ?? 20,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SCORER_DEFINITION_VERSIONS)} FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE scorerDefinitionId = ? ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [scorerDefinitionId, limitValue, start],
      });

      const versions = result.rows?.map(row => this.#parseVersionRow(row)) ?? [];

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE "scorerDefinitionId" = ?`,
        args: [entityId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER_DEFINITION_VERSIONS_BY_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async countVersions(scorerDefinitionId: string): Promise<number> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_SCORER_DEFINITION_VERSIONS}" WHERE scorerDefinitionId = ?`,
        args: [scorerDefinitionId],
      });
      return Number(result.rows?.[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  #parseScorerRow(row: Record<string, unknown>): StorageScorerDefinitionType {
    const safeParseJSON = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    return {
      id: row.id as string,
      status: (row.status as StorageScorerDefinitionType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  #parseVersionRow(row: Record<string, unknown>): ScorerDefinitionVersion {
    const safeParseJSON = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    return {
      id: row.id as string,
      scorerDefinitionId: row.scorerDefinitionId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      type: row.type as string as ScorerDefinitionVersion['type'],
      model: safeParseJSON(row.model) as ScorerDefinitionVersion['model'],
      instructions: (row.instructions as string) ?? undefined,
      scoreRange: safeParseJSON(row.scoreRange) as ScorerDefinitionVersion['scoreRange'],
      presetConfig: safeParseJSON(row.presetConfig) as ScorerDefinitionVersion['presetConfig'],
      defaultSampling: safeParseJSON(row.defaultSampling) as ScorerDefinitionVersion['defaultSampling'],
      changedFields: safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
