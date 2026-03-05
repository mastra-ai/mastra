import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  PromptBlocksStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_PROMPT_BLOCKS,
  TABLE_PROMPT_BLOCK_VERSIONS,
  PROMPT_BLOCKS_SCHEMA,
  PROMPT_BLOCK_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StoragePromptBlockType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  PromptBlockVersion,
  CreatePromptBlockVersionInput,
  ListPromptBlockVersionsInput,
  ListPromptBlockVersionsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class PromptBlocksLibSQL extends PromptBlocksStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_PROMPT_BLOCKS, schema: PROMPT_BLOCKS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_PROMPT_BLOCK_VERSIONS, schema: PROMPT_BLOCK_VERSIONS_SCHEMA });

    // Add new columns for backwards compatibility with existing databases
    await this.#db.alterTable({
      tableName: TABLE_PROMPT_BLOCK_VERSIONS,
      schema: PROMPT_BLOCK_VERSIONS_SCHEMA,
      ifNotExists: ['requestContextSchema'],
    });

    // Unique constraint on (blockId, versionNumber) to prevent duplicate versions from concurrent updates
    await this.#client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_block_versions_block_version ON "${TABLE_PROMPT_BLOCK_VERSIONS}" ("blockId", "versionNumber")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_PROMPT_BLOCKS });
    await this.#db.deleteData({ tableName: TABLE_PROMPT_BLOCK_VERSIONS });
  }

  // ==========================================================================
  // Prompt Block CRUD
  // ==========================================================================

  async getById(id: string): Promise<StoragePromptBlockType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_PROMPT_BLOCKS)} FROM "${TABLE_PROMPT_BLOCKS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseBlockRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async create(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    const { promptBlock } = input;
    try {
      const now = new Date();

      // Insert thin block record
      await this.#db.insert({
        tableName: TABLE_PROMPT_BLOCKS,
        record: {
          id: promptBlock.id,
          status: 'draft',
          activeVersionId: null,
          authorId: promptBlock.authorId ?? null,
          metadata: promptBlock.metadata ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      // Extract config fields for version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = promptBlock;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        blockId: promptBlock.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      });

      return {
        id: promptBlock.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: promptBlock.authorId,
        metadata: promptBlock.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async update(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Prompt block with id ${id} not found`);
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Build update data for the block record
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
        tableName: TABLE_PROMPT_BLOCKS,
        keys: { id },
        data: updateData,
      });

      // Fetch and return updated block
      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_PROMPT_BLOCK', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Prompt block ${id} not found after update`,
          details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_PROMPT_BLOCK', 'FAILED'),
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
        sql: `DELETE FROM "${TABLE_PROMPT_BLOCKS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (status) {
        conditions.push('status = ?');
        queryParams.push(status);
      }

      if (authorId !== undefined) {
        conditions.push('authorId = ?');
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          // Sanitize key to prevent SQL injection via json_extract path
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'LIST_PROMPT_BLOCKS', 'INVALID_METADATA_KEY'),
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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_PROMPT_BLOCKS}" ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          promptBlocks: [],
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
        sql: `SELECT ${buildSelectColumns(TABLE_PROMPT_BLOCKS)} FROM "${TABLE_PROMPT_BLOCKS}" ${whereClause} ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const promptBlocks = result.rows?.map(row => this.#parseBlockRow(row)) ?? [];

      return {
        promptBlocks,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_PROMPT_BLOCKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Prompt Block Version Methods
  // ==========================================================================

  async createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion> {
    try {
      const now = new Date();
      await this.#db.insert({
        tableName: TABLE_PROMPT_BLOCK_VERSIONS,
        record: {
          id: input.id,
          blockId: input.blockId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          content: input.content,
          rules: input.rules ?? null,
          requestContextSchema: input.requestContextSchema ?? null,
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
          id: createStorageErrorId('LIBSQL', 'CREATE_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<PromptBlockVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_PROMPT_BLOCK_VERSIONS)} FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_PROMPT_BLOCK_VERSIONS)} FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE blockId = ? AND versionNumber = ?`,
        args: [blockId, versionNumber],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_PROMPT_BLOCK_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestVersion(blockId: string): Promise<PromptBlockVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_PROMPT_BLOCK_VERSIONS)} FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE blockId = ? ORDER BY versionNumber DESC LIMIT 1`,
        args: [blockId],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput> {
    try {
      const { blockId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE blockId = ?`,
        args: [blockId],
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
        sql: `SELECT ${buildSelectColumns(TABLE_PROMPT_BLOCK_VERSIONS)} FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE blockId = ? ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [blockId, limitValue, start],
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
          id: createStorageErrorId('LIBSQL', 'LIST_PROMPT_BLOCK_VERSIONS', 'FAILED'),
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
        sql: `DELETE FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_PROMPT_BLOCK_VERSION', 'FAILED'),
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
        sql: `DELETE FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE "blockId" = ?`,
        args: [entityId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_PROMPT_BLOCK_VERSIONS_BY_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async countVersions(blockId: string): Promise<number> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_PROMPT_BLOCK_VERSIONS}" WHERE blockId = ?`,
        args: [blockId],
      });
      return Number(result.rows?.[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_PROMPT_BLOCK_VERSIONS', 'FAILED'),
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

  #parseBlockRow(row: Record<string, unknown>): StoragePromptBlockType {
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
      status: (row.status as StoragePromptBlockType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  #parseVersionRow(row: Record<string, unknown>): PromptBlockVersion {
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
      blockId: row.blockId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      content: row.content as string,
      rules: safeParseJSON(row.rules) as PromptBlockVersion['rules'],
      requestContextSchema: safeParseJSON(row.requestContextSchema) as Record<string, unknown> | undefined,
      changedFields: safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
