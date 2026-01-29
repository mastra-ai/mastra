import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoredScorersStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_STORED_SCORERS,
  TABLE_STORED_SCORER_VERSIONS,
  STORED_SCORERS_SCHEMA,
  STORED_SCORER_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StoredScorerType,
  StorageCreateScorerInput,
  StorageUpdateScorerInput,
  StorageListScorersInput,
  StorageListScorersOutput,
  StoredScorerVersionType,
  StorageCreateScorerVersionInput,
  ListScorerVersionsInput,
  ListScorerVersionsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class StoredScorersLibSQL extends StoredScorersStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    // Create stored scorers table
    await this.#db.createTable({ tableName: TABLE_STORED_SCORERS, schema: STORED_SCORERS_SCHEMA });

    // Create stored scorer versions table
    await this.#db.createTable({ tableName: TABLE_STORED_SCORER_VERSIONS, schema: STORED_SCORER_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_STORED_SCORER_VERSIONS });
    await this.#db.deleteData({ tableName: TABLE_STORED_SCORERS });
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

  private parseScorerRow(row: any): StoredScorerType {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      model: this.parseJson(row.model, 'model'),
      prompt: row.prompt as string,
      scoreRange: this.parseJson(row.scoreRange, 'scoreRange'),
      metadata: this.parseJson(row.metadata, 'metadata'),
      ownerId: row.ownerId as string | undefined,
      activeVersionId: row.activeVersionId as string | undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  private parseScorerVersionRow(row: Record<string, unknown>): StoredScorerVersionType {
    return {
      id: row.id as string,
      scorerId: row.scorerId as string,
      versionNumber: row.versionNumber as number,
      name: (row.name as string) || undefined,
      snapshot: this.parseJson(row.snapshot, 'snapshot') as StoredScorerVersionType['snapshot'],
      changedFields: row.changedFields ? (this.parseJson(row.changedFields, 'changedFields') as string[]) : undefined,
      changeMessage: (row.changeMessage as string) || undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }

  async createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StoredScorerType> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_STORED_SCORERS,
        record: {
          id: scorer.id,
          name: scorer.name,
          description: scorer.description ?? null,
          model: scorer.model,
          prompt: scorer.prompt,
          scoreRange: scorer.scoreRange,
          metadata: scorer.metadata ?? null,
          ownerId: scorer.ownerId ?? null,
          activeVersionId: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        ...scorer,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: scorer.id },
        },
        error,
      );
    }
  }

  async getScorerById({ id }: { id: string }): Promise<StoredScorerType | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_STORED_SCORERS,
        keys: { id },
      });

      return result ? this.parseScorerRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StoredScorerType> {
    try {
      // First, get the existing scorer
      const existingScorer = await this.getScorerById({ id });
      if (!existingScorer) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer ${id} not found`,
          details: { scorerId: id },
        });
      }

      // Build the data object with only the fields that are being updated
      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.model !== undefined) data.model = updates.model;
      if (updates.prompt !== undefined) data.prompt = updates.prompt;
      if (updates.scoreRange !== undefined) data.scoreRange = updates.scoreRange;
      if (updates.metadata !== undefined) {
        // Merge metadata
        data.metadata = { ...existingScorer.metadata, ...updates.metadata };
      }
      if (updates.ownerId !== undefined) data.ownerId = updates.ownerId;
      if (updates.activeVersionId !== undefined) data.activeVersionId = updates.activeVersionId;

      // Only update if there's more than just updatedAt
      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_STORED_SCORERS,
          keys: { id },
          data,
        });
      }

      // Return the updated scorer
      const updatedScorer = await this.getScorerById({ id });
      if (!updatedScorer) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer ${id} not found after update`,
          details: { scorerId: id },
        });
      }

      return updatedScorer;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async deleteScorer({ id }: { id: string }): Promise<void> {
    try {
      // First delete all versions for this scorer
      await this.deleteScorerVersionsByScorerId(id);

      await this.#db.delete({
        tableName: TABLE_STORED_SCORERS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORERS', 'INVALID_PAGE'),
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
      // Build WHERE clause for filtering
      const whereClauses: string[] = [];
      const whereValues: any[] = [];

      if (ownerId !== undefined) {
        whereClauses.push(`"ownerId" = ?`);
        whereValues.push(ownerId);
      }

      // Filter by metadata using JSON extraction (SQLite/LibSQL syntax)
      // SECURITY: Validate metadata keys to prevent SQL injection
      if (metadata && Object.keys(metadata).length > 0) {
        // Only allow alphanumeric keys with underscores (safe for JSON path interpolation)
        const SAFE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

        for (const [key, value] of Object.entries(metadata)) {
          // Skip invalid keys to prevent SQL injection
          if (!SAFE_KEY_PATTERN.test(key)) {
            console.warn(`Skipping invalid metadata key for filtering: "${key}" (must match ${SAFE_KEY_PATTERN})`);
            continue;
          }
          // Use CAST for text comparison to match sql-builder.ts pattern
          if (typeof value === 'string') {
            whereClauses.push(`CAST(json_extract(metadata, '$.${key}') AS TEXT) = ?`);
            whereValues.push(value);
          } else {
            whereClauses.push(`json_extract(metadata, '$.${key}') = ?`);
            whereValues.push(JSON.stringify(value));
          }
        }
      }

      const whereClause =
        whereClauses.length > 0 ? { sql: `WHERE ${whereClauses.join(' AND ')}`, args: whereValues } : undefined;

      // Get total count with filters
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_STORED_SCORERS,
        whereClause,
      });

      if (total === 0) {
        return {
          scorers: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results with filters
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_STORED_SCORERS,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
        whereClause,
      });

      const scorers = rows.map(row => this.parseScorerRow(row));

      return {
        scorers,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORERS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Scorer Version Methods
  // ==========================================================================

  async createScorerVersion(input: StorageCreateScorerVersionInput): Promise<StoredScorerVersionType> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        record: {
          id: input.id,
          scorerId: input.scorerId,
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
          id: createStorageErrorId('LIBSQL', 'CREATE_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, scorerId: input.scorerId },
        },
        error,
      );
    }
  }

  async getScorerVersion(id: string): Promise<StoredScorerVersionType | null> {
    try {
      const result = await this.#db.select<Record<string, unknown>>({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        keys: { id },
      });

      return result ? this.parseScorerVersionRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getScorerVersionByNumber(scorerId: string, versionNumber: number): Promise<StoredScorerVersionType | null> {
    try {
      const rows = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        whereClause: {
          sql: 'WHERE "scorerId" = ? AND "versionNumber" = ?',
          args: [scorerId, versionNumber],
        },
        limit: 1,
      });

      return rows.length > 0 ? this.parseScorerVersionRow(rows[0]!) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestScorerVersion(scorerId: string): Promise<StoredScorerVersionType | null> {
    try {
      const rows = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        whereClause: {
          sql: 'WHERE "scorerId" = ?',
          args: [scorerId],
        },
        orderBy: '"versionNumber" DESC',
        limit: 1,
      });

      return rows.length > 0 ? this.parseScorerVersionRow(rows[0]!) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async listScorerVersions(input: ListScorerVersionsInput): Promise<ListScorerVersionsOutput> {
    const { scorerId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseScorerVersionOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORER_VERSIONS', 'INVALID_PAGE'),
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
      const whereClause = {
        sql: 'WHERE "scorerId" = ?',
        args: [scorerId],
      };

      // Get total count
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        whereClause,
      });

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse === false ? 0 : perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const fieldColumn = field === 'createdAt' ? '"createdAt"' : '"versionNumber"';
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        whereClause,
        orderBy: `${fieldColumn} ${direction}`,
        limit: limitValue,
        offset,
      });

      const versions = rows.map(row => this.parseScorerVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse === false ? total : perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_SCORER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async deleteScorerVersion(id: string): Promise<void> {
    try {
      await this.#db.delete({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteScorerVersionsByScorerId(scorerId: string): Promise<void> {
    try {
      // Delete all versions for this scorer in a single query
      await this.#db.delete({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        keys: { scorerId },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER_VERSIONS_BY_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async countScorerVersions(scorerId: string): Promise<number> {
    try {
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_STORED_SCORER_VERSIONS,
        whereClause: {
          sql: 'WHERE "scorerId" = ?',
          args: [scorerId],
        },
      });

      return total;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_SCORER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }
}
