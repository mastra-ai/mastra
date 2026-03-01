import type { Pool, RowDataPacket } from 'mysql2/promise';
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

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

export class ScorerDefinitionsMySQL extends ScorerDefinitionsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SCORER_DEFINITIONS, schema: SCORER_DEFINITIONS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_SCORER_DEFINITION_VERSIONS, schema: SCORER_DEFINITION_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SCORER_DEFINITION_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_SCORER_DEFINITIONS });
  }

  private safeParseJSON(val: unknown): any {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  private parseScorerRow(row: Record<string, unknown>): StorageScorerDefinitionType {
    return {
      id: row.id as string,
      status: (row.status as StorageScorerDefinitionType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): ScorerDefinitionVersion {
    return {
      id: row.id as string,
      scorerDefinitionId: row.scorerDefinitionId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      type: row.type as string as ScorerDefinitionVersion['type'],
      model: this.safeParseJSON(row.model) as ScorerDefinitionVersion['model'],
      instructions: (row.instructions as string) ?? undefined,
      scoreRange: this.safeParseJSON(row.scoreRange) as ScorerDefinitionVersion['scoreRange'],
      presetConfig: this.safeParseJSON(row.presetConfig) as ScorerDefinitionVersion['presetConfig'],
      defaultSampling: this.safeParseJSON(row.defaultSampling) as ScorerDefinitionVersion['defaultSampling'],
      changedFields: this.safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }

  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_SCORER_DEFINITIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseScorerRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_SCORER_DEFINITION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async create(input: { scorerDefinition: StorageCreateScorerDefinitionInput }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_SCORER_DEFINITIONS,
        record: { id: scorerDefinition.id, status: 'draft', activeVersionId: null, authorId: scorerDefinition.authorId ?? null, metadata: scorerDefinition.metadata ?? null, createdAt: now, updatedAt: now },
      });

      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = scorerDefinition;
      const versionId = crypto.randomUUID();
      await this.createVersion({ id: versionId, scorerDefinitionId: scorerDefinition.id, versionNumber: 1, ...snapshotConfig, changedFields: Object.keys(snapshotConfig), changeMessage: 'Initial version' });

      return { id: scorerDefinition.id, status: 'draft', activeVersionId: undefined, authorId: scorerDefinition.authorId, metadata: scorerDefinition.metadata, createdAt: now, updatedAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_SCORER_DEFINITION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Scorer definition with id ${id} not found`);

      const { authorId, activeVersionId, metadata, status } = updates;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = { ...existing.metadata, ...metadata };

      await this.operations.update({ tableName: TABLE_SCORER_DEFINITIONS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND_AFTER_UPDATE'), domain: ErrorDomain.STORAGE, category: ErrorCategory.SYSTEM, text: `Scorer definition ${id} not found after update`, details: { id } });
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_SCORER_DEFINITION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_SCORER_DEFINITIONS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_SCORER_DEFINITION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: any[] = [];
      if (status) { conditions.push(`${quoteIdentifier('status', 'column name')} = ?`); queryParams.push(status); }
      if (authorId !== undefined) { conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`); queryParams.push(authorId); }
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_SCORER_DEFINITIONS', 'INVALID_METADATA_KEY'), domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: `Invalid metadata key: ${key}`, details: { key } });
          conditions.push(`JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = conditions.length > 0 ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams } : undefined;
      const total = await this.operations.loadTotalCount({ tableName: TABLE_SCORER_DEFINITIONS, whereClause });
      if (total === 0) return { scorerDefinitions: [], total: 0, page, perPage: perPageInput ?? 100, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SCORER_DEFINITIONS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { scorerDefinitions: rows.map(row => this.parseScorerRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_SCORER_DEFINITIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS,
        record: {
          id: input.id, scorerDefinitionId: input.scorerDefinitionId, versionNumber: input.versionNumber,
          name: input.name, description: input.description ?? null, type: input.type,
          model: input.model ?? null, instructions: input.instructions ?? null,
          scoreRange: input.scoreRange ?? null, presetConfig: input.presetConfig ?? null,
          defaultSampling: input.defaultSampling ?? null,
          changedFields: input.changedFields ?? null, changeMessage: input.changeMessage ?? null, createdAt: now,
        },
      });
      return { ...input, createdAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_SCORER_DEFINITION_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_SCORER_DEFINITION_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_SCORER_DEFINITION_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersionByNumber(scorerDefinitionId: string, versionNumber: number): Promise<ScorerDefinitionVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('scorerDefinitionId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`, args: [scorerDefinitionId, versionNumber] },
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_SCORER_DEFINITION_VERSION_BY_NUMBER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('scorerDefinitionId', 'column name')} = ?`, args: [scorerDefinitionId] },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`, limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_LATEST_SCORER_DEFINITION_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    try {
      const { scorerDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const whereClause = { sql: ` WHERE ${quoteIdentifier('scorerDefinitionId', 'column name')} = ?`, args: [scorerDefinitionId] };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_SCORER_DEFINITION_VERSIONS, whereClause });
      if (total === 0) return { versions: [], total: 0, page, perPage: perPageInput ?? 20, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { versions: rows.map(row => this.parseVersionRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_SCORER_DEFINITION_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try { await this.operations.delete({ tableName: TABLE_SCORER_DEFINITION_VERSIONS, keys: { id } }); } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_SCORER_DEFINITION_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_SCORER_DEFINITION_VERSIONS)} WHERE ${quoteIdentifier('scorerDefinitionId', 'column name')} = ?`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_SCORER_DEFINITION_VERSIONS_BY_SCORER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async countVersions(scorerDefinitionId: string): Promise<number> {
    try {
      return await this.operations.loadTotalCount({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('scorerDefinitionId', 'column name')} = ?`, args: [scorerDefinitionId] },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'COUNT_SCORER_DEFINITION_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }
}
