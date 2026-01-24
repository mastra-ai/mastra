import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  DATASETS_SCHEMA,
  DATASET_ITEMS_SCHEMA,
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
} from '@mastra/core/storage';
import type {
  Dataset,
  DatasetItem,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class DatasetsLibSQL extends DatasetsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_DATASETS, schema: DATASETS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_ITEMS, schema: DATASET_ITEMS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_DATASET_ITEMS });
    await this.#db.deleteData({ tableName: TABLE_DATASETS });
  }

  // Helper to transform row to Dataset
  private transformDatasetRow(row: Record<string, any>): Dataset {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      version: ensureDate(row.version)!, // Timestamp-based versioning
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  // Helper to transform row to DatasetItem
  private transformItemRow(row: Record<string, any>): DatasetItem {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      version: ensureDate(row.version)!, // Timestamp when item was added/modified
      input: safelyParseJSON(row.input),
      expectedOutput: row.expectedOutput ? safelyParseJSON(row.expectedOutput) : undefined,
      context: row.context ? safelyParseJSON(row.context) : undefined,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  // Dataset CRUD
  async createDataset(input: CreateDatasetInput): Promise<Dataset> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      // Note: prepareStatement handles JSON.stringify for jsonb columns automatically
      await this.#db.insert({
        tableName: TABLE_DATASETS,
        record: {
          id,
          name: input.name,
          description: input.description ?? null,
          metadata: input.metadata, // jsonb serialization handled by prepareStatement
          version: nowIso, // Timestamp-based versioning
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      });

      return {
        id,
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        version: now, // Return as Date
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getDatasetById({ id }: { id: string }): Promise<Dataset | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASETS)} FROM ${TABLE_DATASETS} WHERE id = ?`,
        args: [id],
      });
      return result.rows?.[0] ? this.transformDatasetRow(result.rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateDataset(args: UpdateDatasetInput): Promise<Dataset> {
    try {
      const existing = await this.getDatasetById({ id: args.id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_DATASET', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: args.id },
        });
      }

      const now = new Date().toISOString();
      const updates: string[] = ['updatedAt = ?'];
      const values: InValue[] = [now];

      if (args.name !== undefined) {
        updates.push('name = ?');
        values.push(args.name);
      }
      if (args.description !== undefined) {
        updates.push('description = ?');
        values.push(args.description);
      }
      if (args.metadata !== undefined) {
        updates.push('metadata = ?');
        values.push(JSON.stringify(args.metadata));
      }

      values.push(args.id);

      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASETS} SET ${updates.join(', ')} WHERE id = ?`,
        args: values,
      });

      return {
        ...existing,
        name: args.name ?? existing.name,
        description: args.description ?? existing.description,
        metadata: args.metadata ?? existing.metadata,
        updatedAt: new Date(now),
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteDataset({ id }: { id: string }): Promise<void> {
    try {
      // Delete items first (foreign key semantics)
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_DATASET_ITEMS} WHERE datasetId = ?`,
        args: [id],
      });
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_DATASETS} WHERE id = ?`,
        args: [id],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASETS}`,
        args: [],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          datasets: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASETS)} FROM ${TABLE_DATASETS} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [limitValue, start],
      });

      return {
        datasets: result.rows?.map(row => this.transformDatasetRow(row)) ?? [],
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_DATASETS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Item CRUD with timestamp versioning
  async addItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    try {
      const now = new Date();
      const nowIso = now.toISOString();

      // Check dataset exists
      const datasetResult = await this.#client.execute({
        sql: `SELECT id FROM ${TABLE_DATASETS} WHERE id = ?`,
        args: [args.datasetId],
      });

      if (!datasetResult.rows?.[0]) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'ADD_ITEM', 'DATASET_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: args.datasetId },
        });
      }

      // Update dataset version timestamp
      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASETS} SET version = ?, updatedAt = ? WHERE id = ?`,
        args: [nowIso, nowIso, args.datasetId],
      });

      // Insert item with version timestamp
      // Note: prepareStatement handles JSON.stringify for jsonb columns automatically
      const id = crypto.randomUUID();
      await this.#db.insert({
        tableName: TABLE_DATASET_ITEMS,
        record: {
          id,
          datasetId: args.datasetId,
          version: nowIso, // Item stores the version timestamp when added
          input: args.input,
          expectedOutput: args.expectedOutput,
          context: args.context,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      });

      return {
        id,
        datasetId: args.datasetId,
        version: now, // Return as Date
        input: args.input,
        expectedOutput: args.expectedOutput,
        context: args.context,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'ADD_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    try {
      // Verify item exists and belongs to dataset
      const existing = await this.getItemById({ id: args.id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_ITEM', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id },
        });
      }
      if (existing.datasetId !== args.datasetId) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id, expectedDatasetId: args.datasetId, actualDatasetId: existing.datasetId },
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();

      // Update dataset version timestamp
      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASETS} SET version = ?, updatedAt = ? WHERE id = ?`,
        args: [nowIso, nowIso, args.datasetId],
      });

      // Update item with new version timestamp
      const updates: string[] = ['version = ?', 'updatedAt = ?'];
      const values: InValue[] = [nowIso, nowIso];

      if (args.input !== undefined) {
        updates.push('input = ?');
        values.push(JSON.stringify(args.input));
      }
      if (args.expectedOutput !== undefined) {
        updates.push('expectedOutput = ?');
        values.push(JSON.stringify(args.expectedOutput));
      }
      if (args.context !== undefined) {
        updates.push('context = ?');
        values.push(JSON.stringify(args.context));
      }

      values.push(args.id);

      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASET_ITEMS} SET ${updates.join(', ')} WHERE id = ?`,
        args: values,
      });

      return {
        ...existing,
        version: now, // Return as Date
        input: args.input ?? existing.input,
        expectedOutput: args.expectedOutput ?? existing.expectedOutput,
        context: args.context ?? existing.context,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
    try {
      // Verify item exists
      const existing = await this.getItemById({ id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'DELETE_ITEM', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: id },
        });
      }
      if (existing.datasetId !== datasetId) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'DELETE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: id, expectedDatasetId: datasetId, actualDatasetId: existing.datasetId },
        });
      }

      const nowIso = new Date().toISOString();

      // Update dataset version timestamp
      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASETS} SET version = ?, updatedAt = ? WHERE id = ?`,
        args: [nowIso, nowIso, datasetId],
      });

      // Delete item
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_DATASET_ITEMS} WHERE id = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemById({ id }: { id: string }): Promise<DatasetItem | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} WHERE id = ?`,
        args: [id],
      });
      return result.rows?.[0] ? this.transformItemRow(result.rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;

      // Build WHERE clause
      const conditions: string[] = ['datasetId = ?'];
      const queryParams: InValue[] = [args.datasetId];

      if (args.version !== undefined) {
        conditions.push('version <= ?');
        queryParams.push(args.version.toISOString()); // Compare as ISO timestamp strings
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_ITEMS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          items: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      return {
        items: result.rows?.map(row => this.transformItemRow(row)) ?? [],
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: Date }): Promise<DatasetItem[]> {
    try {
      // Snapshot semantics: return items that existed at or before this version timestamp
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} WHERE datasetId = ? AND version <= ? ORDER BY createdAt DESC`,
        args: [datasetId, version.toISOString()], // Compare as ISO timestamp strings
      });
      return result.rows?.map(row => this.transformItemRow(row)) ?? [];
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ITEMS_BY_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
