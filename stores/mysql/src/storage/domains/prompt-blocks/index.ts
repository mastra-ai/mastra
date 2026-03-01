import type { Pool, RowDataPacket } from 'mysql2/promise';
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

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

export class PromptBlocksMySQL extends PromptBlocksStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_PROMPT_BLOCKS, schema: PROMPT_BLOCKS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_PROMPT_BLOCK_VERSIONS, schema: PROMPT_BLOCK_VERSIONS_SCHEMA });
    await this.operations.alterTable({
      tableName: TABLE_PROMPT_BLOCK_VERSIONS,
      schema: PROMPT_BLOCK_VERSIONS_SCHEMA,
      ifNotExists: ['requestContextSchema'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_PROMPT_BLOCK_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_PROMPT_BLOCKS });
  }

  private safeParseJSON(val: unknown): any {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  private parseBlockRow(row: Record<string, unknown>): StoragePromptBlockType {
    return {
      id: row.id as string,
      status: (row.status as StoragePromptBlockType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): PromptBlockVersion {
    return {
      id: row.id as string,
      blockId: row.blockId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      content: row.content as string,
      rules: this.safeParseJSON(row.rules) as PromptBlockVersion['rules'],
      requestContextSchema: this.safeParseJSON(row.requestContextSchema) as Record<string, unknown> | undefined,
      changedFields: this.safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }

  async getById(id: string): Promise<StoragePromptBlockType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_PROMPT_BLOCKS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [id],
      );
      return rows.length ? this.parseBlockRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'GET_PROMPT_BLOCK', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async create(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    const { promptBlock } = input;
    try {
      const now = new Date();

      await this.operations.insert({
        tableName: TABLE_PROMPT_BLOCKS,
        record: {
          id: promptBlock.id,
          status: 'draft',
          activeVersionId: null,
          authorId: promptBlock.authorId ?? null,
          metadata: promptBlock.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

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
        { id: createStorageErrorId('MYSQL', 'CREATE_PROMPT_BLOCK', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async update(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Prompt block with id ${id} not found`);

      const { authorId, activeVersionId, metadata, status } = updates;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = { ...existing.metadata, ...metadata };

      await this.operations.update({ tableName: TABLE_PROMPT_BLOCKS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_PROMPT_BLOCK', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE, category: ErrorCategory.SYSTEM,
          text: `Prompt block ${id} not found after update`, details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'UPDATE_PROMPT_BLOCK', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_PROMPT_BLOCKS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'DELETE_PROMPT_BLOCK', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (status) {
        conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
        queryParams.push(status);
      }
      if (authorId !== undefined) {
        conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`);
        queryParams.push(authorId);
      }
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('MYSQL', 'LIST_PROMPT_BLOCKS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE, category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}`, details: { key },
            });
          }
          conditions.push(`JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = conditions.length > 0 ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams } : undefined;
      const total = await this.operations.loadTotalCount({ tableName: TABLE_PROMPT_BLOCKS, whereClause });

      if (total === 0) {
        return { promptBlocks: [], total: 0, page, perPage: perPageInput ?? 100, hasMore: false };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_PROMPT_BLOCKS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
      });

      return {
        promptBlocks: rows.map(row => this.parseBlockRow(row)),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'LIST_PROMPT_BLOCKS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  async createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion> {
    try {
      const now = new Date();
      await this.operations.insert({
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
          createdAt: now,
        },
      });
      return { ...input, createdAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'CREATE_PROMPT_BLOCK_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<PromptBlockVersion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_PROMPT_BLOCK_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'GET_PROMPT_BLOCK_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_PROMPT_BLOCK_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('blockId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`, args: [blockId, versionNumber] },
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'GET_PROMPT_BLOCK_VERSION_BY_NUMBER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async getLatestVersion(blockId: string): Promise<PromptBlockVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_PROMPT_BLOCK_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('blockId', 'column name')} = ?`, args: [blockId] },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`,
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'GET_LATEST_PROMPT_BLOCK_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput> {
    try {
      const { blockId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      const whereClause = { sql: ` WHERE ${quoteIdentifier('blockId', 'column name')} = ?`, args: [blockId] };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_PROMPT_BLOCK_VERSIONS, whereClause });

      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageInput ?? 20, hasMore: false };
      }

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_PROMPT_BLOCK_VERSIONS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
      });

      return {
        versions: rows.map(row => this.parseVersionRow(row)),
        total, page, perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'LIST_PROMPT_BLOCK_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.operations.delete({ tableName: TABLE_PROMPT_BLOCK_VERSIONS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'DELETE_PROMPT_BLOCK_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_PROMPT_BLOCK_VERSIONS)} WHERE ${quoteIdentifier('blockId', 'column name')} = ?`,
        [entityId],
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'DELETE_PROMPT_BLOCK_VERSIONS_BY_BLOCK', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }

  async countVersions(blockId: string): Promise<number> {
    try {
      return await this.operations.loadTotalCount({
        tableName: TABLE_PROMPT_BLOCK_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('blockId', 'column name')} = ?`, args: [blockId] },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        { id: createStorageErrorId('MYSQL', 'COUNT_PROMPT_BLOCK_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY },
        error,
      );
    }
  }
}
