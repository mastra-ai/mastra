import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_ITEM_VERSIONS,
  TABLE_DATASET_VERSIONS,
  DATASETS_SCHEMA,
  DATASET_ITEMS_SCHEMA,
  DATASET_ITEM_VERSIONS_SCHEMA,
  DATASET_VERSIONS_SCHEMA,
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
} from '@mastra/core/storage';
import type {
  Dataset,
  DatasetItem,
  DatasetItemVersion,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  CreateItemVersionInput,
  ListItemVersionsInput,
  ListItemVersionsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BulkAddItemsInput,
  BulkDeleteItemsInput,
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
    await this.#db.createTable({ tableName: TABLE_DATASET_ITEM_VERSIONS, schema: DATASET_ITEM_VERSIONS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_VERSIONS, schema: DATASET_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_DATASET_ITEM_VERSIONS });
    await this.#db.deleteData({ tableName: TABLE_DATASET_VERSIONS });
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
      inputSchema: row.inputSchema ? safelyParseJSON(row.inputSchema) : undefined,
      outputSchema: row.outputSchema ? safelyParseJSON(row.outputSchema) : undefined,
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

  // Helper to transform row to DatasetItemVersion
  private transformItemVersionRow(row: Record<string, any>): DatasetItemVersion {
    return {
      id: row.id as string,
      itemId: row.itemId as string,
      datasetId: row.datasetId as string,
      versionNumber: row.versionNumber as number,
      datasetVersion: ensureDate(row.datasetVersion)!,
      snapshot: safelyParseJSON(row.snapshot),
      isDeleted: Boolean(row.isDeleted),
      createdAt: ensureDate(row.createdAt)!,
    };
  }

  // Helper to transform row to DatasetVersion
  private transformDatasetVersionRow(row: Record<string, any>): DatasetVersion {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      version: ensureDate(row.version)!,
      createdAt: ensureDate(row.createdAt)!,
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
          inputSchema: input.inputSchema ?? null,
          outputSchema: input.outputSchema ?? null,
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
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema,
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

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<Dataset> {
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
      if (args.inputSchema !== undefined) {
        updates.push('inputSchema = ?');
        values.push(args.inputSchema === null ? null : JSON.stringify(args.inputSchema));
      }
      if (args.outputSchema !== undefined) {
        updates.push('outputSchema = ?');
        values.push(args.outputSchema === null ? null : JSON.stringify(args.outputSchema));
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
        inputSchema: args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema,
        outputSchema: args.outputSchema !== undefined ? args.outputSchema : existing.outputSchema,
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
  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    try {
      const now = new Date();
      const nowIso = now.toISOString();

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

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
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

  protected async _doDeleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
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

      // When version is specified, query itemVersions for historical state
      if (args.version !== undefined) {
        // Query to get latest version per item at or before the requested version, excluding deleted
        // Uses a subquery to get max datasetVersion per itemId, then joins to get full row
        const versionIso = args.version.toISOString();

        let searchCondition = '';
        const searchParams: InValue[] = [];
        if (args.search) {
          // Search in snapshot JSON (stored as text)
          searchCondition = `AND (LOWER(v.snapshot) LIKE ? OR LOWER(v.snapshot) LIKE ?)`;
          const searchPattern = `%${args.search.toLowerCase()}%`;
          searchParams.push(searchPattern, searchPattern);
        }

        // Get items at version using window function to get latest per itemId
        // Use json() wrapper for snapshot column to convert binary JSONB to TEXT
        const sql = `
          WITH latest_versions AS (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY itemId ORDER BY datasetVersion DESC) as rn
            FROM ${TABLE_DATASET_ITEM_VERSIONS}
            WHERE datasetId = ? AND datasetVersion <= ?
          )
          SELECT v.id, v.itemId, v.datasetId, v.versionNumber, v.datasetVersion,
                 json(v.snapshot) as snapshot, v.isDeleted, v.createdAt
          FROM latest_versions v
          WHERE v.rn = 1 AND v.isDeleted = 0 ${searchCondition}
          ORDER BY v.createdAt DESC
        `;

        const countSql = `
          WITH latest_versions AS (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY itemId ORDER BY datasetVersion DESC) as rn
            FROM ${TABLE_DATASET_ITEM_VERSIONS}
            WHERE datasetId = ? AND datasetVersion <= ?
          )
          SELECT COUNT(*) as count FROM latest_versions v
          WHERE v.rn = 1 AND v.isDeleted = 0 ${searchCondition}
        `;

        const countResult = await this.#client.execute({
          sql: countSql,
          args: [args.datasetId, versionIso, ...searchParams],
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
          sql: `${sql} LIMIT ? OFFSET ?`,
          args: [args.datasetId, versionIso, ...searchParams, limitValue, start],
        });

        // Transform version snapshots to DatasetItem format
        const items: DatasetItem[] =
          result.rows?.map(row => {
            const snapshot = safelyParseJSON(row.snapshot as string) ?? {};
            return {
              id: row.itemId as string,
              datasetId: row.datasetId as string,
              version: ensureDate(row.datasetVersion as string)!,
              input: snapshot.input ?? null, // Ensure input is never undefined
              expectedOutput: snapshot.expectedOutput,
              context: snapshot.context,
              createdAt: ensureDate(row.createdAt as string)!,
              updatedAt: ensureDate(row.datasetVersion as string)!,
            };
          }) ?? [];

        return {
          items,
          pagination: {
            total,
            page,
            perPage: perPageForResponse,
            hasMore: end < total,
          },
        };
      }

      // Current state - query items table directly
      const conditions: string[] = ['datasetId = ?'];
      const queryParams: InValue[] = [args.datasetId];

      if (args.search) {
        // Search in both input and expectedOutput (stored as JSON text)
        conditions.push(`(LOWER(input) LIKE ? OR LOWER(COALESCE(expectedOutput, '')) LIKE ?)`);
        const searchPattern = `%${args.search.toLowerCase()}%`;
        queryParams.push(searchPattern, searchPattern);
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
      // Query itemVersions for historical state at or before this version timestamp
      const versionIso = version.toISOString();

      // Use json() wrapper for snapshot column to convert binary JSONB to TEXT
      const sql = `
        WITH latest_versions AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY itemId ORDER BY datasetVersion DESC) as rn
          FROM ${TABLE_DATASET_ITEM_VERSIONS}
          WHERE datasetId = ? AND datasetVersion <= ?
        )
        SELECT v.id, v.itemId, v.datasetId, v.versionNumber, v.datasetVersion,
               json(v.snapshot) as snapshot, v.isDeleted, v.createdAt
        FROM latest_versions v
        WHERE v.rn = 1 AND v.isDeleted = 0
        ORDER BY v.createdAt DESC
      `;

      const result = await this.#client.execute({
        sql,
        args: [datasetId, versionIso],
      });

      // Transform version snapshots to DatasetItem format
      return (
        result.rows?.map(row => {
          const snapshot = safelyParseJSON(row.snapshot as string) ?? {};
          return {
            id: row.itemId as string,
            datasetId: row.datasetId as string,
            version: ensureDate(row.datasetVersion as string)!,
            input: snapshot.input ?? null, // Ensure input is never undefined
            expectedOutput: snapshot.expectedOutput,
            context: snapshot.context,
            createdAt: ensureDate(row.createdAt as string)!,
            updatedAt: ensureDate(row.datasetVersion as string)!,
          };
        }) ?? []
      );
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

  // Item version methods
  async createItemVersion(input: CreateItemVersionInput): Promise<DatasetItemVersion> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASET_ITEM_VERSIONS,
        record: {
          id,
          itemId: input.itemId,
          datasetId: input.datasetId,
          versionNumber: input.versionNumber,
          datasetVersion: input.datasetVersion.toISOString(),
          snapshot: input.snapshot,
          isDeleted: (input.isDeleted ?? false) ? 1 : 0,
          createdAt: nowIso,
        },
      });

      return {
        id,
        itemId: input.itemId,
        datasetId: input.datasetId,
        versionNumber: input.versionNumber,
        datasetVersion: input.datasetVersion,
        snapshot: input.snapshot ?? {},
        isDeleted: input.isDeleted ?? false,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_ITEM_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemVersion(itemId: string, versionNumber?: number): Promise<DatasetItemVersion | null> {
    try {
      if (versionNumber !== undefined) {
        const result = await this.#client.execute({
          sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEM_VERSIONS)} FROM ${TABLE_DATASET_ITEM_VERSIONS} WHERE itemId = ? AND versionNumber = ?`,
          args: [itemId, versionNumber],
        });
        return result.rows?.[0] ? this.transformItemVersionRow(result.rows[0]) : null;
      }
      return this.getLatestItemVersion(itemId);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ITEM_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestItemVersion(itemId: string): Promise<DatasetItemVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEM_VERSIONS)} FROM ${TABLE_DATASET_ITEM_VERSIONS} WHERE itemId = ? ORDER BY versionNumber DESC LIMIT 1`,
        args: [itemId],
      });
      return result.rows?.[0] ? this.transformItemVersionRow(result.rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_ITEM_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listItemVersions(input: ListItemVersionsInput): Promise<ListItemVersionsOutput> {
    try {
      const { page, perPage: perPageInput } = input.pagination;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_ITEM_VERSIONS} WHERE itemId = ?`,
        args: [input.itemId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEM_VERSIONS)} FROM ${TABLE_DATASET_ITEM_VERSIONS} WHERE itemId = ? ORDER BY versionNumber DESC LIMIT ? OFFSET ?`,
        args: [input.itemId, limitValue, start],
      });

      return {
        versions: result.rows?.map(row => this.transformItemVersionRow(row)) ?? [],
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
          id: createStorageErrorId('LIBSQL', 'LIST_ITEM_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Dataset version methods
  async createDatasetVersion(datasetId: string, version: Date): Promise<DatasetVersion> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASET_VERSIONS,
        record: {
          id,
          datasetId,
          version: version.toISOString(),
          createdAt: nowIso,
        },
      });

      return {
        id,
        datasetId,
        version,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_DATASET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput> {
    try {
      const { page, perPage: perPageInput } = input.pagination;

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ?`,
        args: [input.datasetId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_VERSIONS)} FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ? ORDER BY version DESC LIMIT ? OFFSET ?`,
        args: [input.datasetId, limitValue, start],
      });

      return {
        versions: result.rows?.map(row => this.transformDatasetVersionRow(row)) ?? [],
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
          id: createStorageErrorId('LIBSQL', 'LIST_DATASET_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Bulk operations
  async bulkAddItems(input: BulkAddItemsInput): Promise<DatasetItem[]> {
    try {
      const dataset = await this.getDatasetById({ id: input.datasetId });
      if (!dataset) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'BULK_ADD_ITEMS', 'DATASET_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const items: DatasetItem[] = [];

      for (const itemInput of input.items) {
        const id = crypto.randomUUID();

        await this.#db.insert({
          tableName: TABLE_DATASET_ITEMS,
          record: {
            id,
            datasetId: input.datasetId,
            version: nowIso,
            input: itemInput.input,
            expectedOutput: itemInput.expectedOutput,
            context: itemInput.context,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        });

        const item: DatasetItem = {
          id,
          datasetId: input.datasetId,
          version: now,
          input: itemInput.input,
          expectedOutput: itemInput.expectedOutput,
          context: itemInput.context,
          createdAt: now,
          updatedAt: now,
        };
        items.push(item);

        // Create item version
        await this.createItemVersion({
          itemId: id,
          datasetId: input.datasetId,
          versionNumber: 1,
          datasetVersion: now,
          snapshot: {
            input: item.input,
            expectedOutput: item.expectedOutput,
            context: item.context,
          },
          isDeleted: false,
        });
      }

      // Update dataset version once for entire bulk operation
      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASETS} SET version = ?, updatedAt = ? WHERE id = ?`,
        args: [nowIso, nowIso, input.datasetId],
      });

      // Single dataset version entry for bulk
      await this.createDatasetVersion(input.datasetId, now);

      return items;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BULK_ADD_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async bulkDeleteItems(input: BulkDeleteItemsInput): Promise<void> {
    try {
      const dataset = await this.getDatasetById({ id: input.datasetId });
      if (!dataset) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'BULK_DELETE_ITEMS', 'DATASET_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();

      for (const itemId of input.itemIds) {
        const item = await this.getItemById({ id: itemId });
        if (!item || item.datasetId !== input.datasetId) continue;

        // Get latest version number
        const latestVersion = await this.getLatestItemVersion(itemId);
        const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

        // Create tombstone version
        await this.createItemVersion({
          itemId,
          datasetId: input.datasetId,
          versionNumber: nextVersionNumber,
          datasetVersion: now,
          snapshot: {
            input: item.input,
            expectedOutput: item.expectedOutput,
            context: item.context,
          },
          isDeleted: true,
        });

        // Delete from items
        await this.#client.execute({
          sql: `DELETE FROM ${TABLE_DATASET_ITEMS} WHERE id = ?`,
          args: [itemId],
        });
      }

      // Update dataset version once for entire bulk operation
      await this.#client.execute({
        sql: `UPDATE ${TABLE_DATASETS} SET version = ?, updatedAt = ? WHERE id = ?`,
        args: [nowIso, nowIso, input.datasetId],
      });

      // Single dataset version entry for bulk
      await this.createDatasetVersion(input.datasetId, now);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BULK_DELETE_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
