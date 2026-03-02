import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  DATASETS_SCHEMA,
  DATASET_ITEMS_SCHEMA,
  DATASET_VERSIONS_SCHEMA,
  DatasetsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
} from '@mastra/core/storage';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

/** Serialize a value for a jsonb column. Returns null for null/undefined. */
function jsonbArg(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

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
    // T3.23 — NO item_versions table
    await this.#db.createTable({ tableName: TABLE_DATASETS, schema: DATASETS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_ITEMS, schema: DATASET_ITEMS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_VERSIONS, schema: DATASET_VERSIONS_SCHEMA });
    // Add new columns for backwards compatibility with existing databases
    await this.#db.alterTable({
      tableName: TABLE_DATASETS,
      schema: DATASETS_SCHEMA,
      ifNotExists: ['defaultRequestContext', 'requestContextSchema'],
    });
    await this.#db.alterTable({
      tableName: TABLE_DATASET_ITEMS,
      schema: DATASET_ITEMS_SCHEMA,
      ifNotExists: ['requestContext'],
    });

    // T3.24 — SCD-2 indexes on dataset_items
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_dataset_items_dataset_validto ON "${TABLE_DATASET_ITEMS}" ("datasetId", "validTo")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_dataset_items_dataset_version ON "${TABLE_DATASET_ITEMS}" ("datasetId", "datasetVersion")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_dataset_items_dataset_validto_deleted ON "${TABLE_DATASET_ITEMS}" ("datasetId", "validTo", "isDeleted")`,
      args: [],
    });

    // T3.25 — indexes on dataset_versions
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset_version ON "${TABLE_DATASET_VERSIONS}" ("datasetId", "version")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_dataset_versions_dataset_version_unique ON "${TABLE_DATASET_VERSIONS}" ("datasetId", "version")`,
      args: [],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_DATASET_VERSIONS });
    await this.#db.deleteData({ tableName: TABLE_DATASET_ITEMS });
    await this.#db.deleteData({ tableName: TABLE_DATASETS });
  }

  // --- Row transformers ---

  private transformDatasetRow(row: Record<string, any>): DatasetRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      inputSchema: row.inputSchema ? safelyParseJSON(row.inputSchema) : undefined,
      groundTruthSchema: row.groundTruthSchema ? safelyParseJSON(row.groundTruthSchema) : undefined,
      defaultRequestContext: row.defaultRequestContext ? safelyParseJSON(row.defaultRequestContext) : undefined,
      requestContextSchema: row.requestContextSchema ? safelyParseJSON(row.requestContextSchema) : undefined,
      version: row.version as number,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  private transformItemRow(row: Record<string, any>): DatasetItem {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      input: safelyParseJSON(row.input),
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : undefined,
      requestContext: row.requestContext ? safelyParseJSON(row.requestContext) : undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  private transformItemRowFull(row: Record<string, any>): DatasetItemRow {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      datasetVersion: row.datasetVersion as number,
      validTo: row.validTo as number | null,
      isDeleted: Boolean(row.isDeleted),
      input: safelyParseJSON(row.input),
      groundTruth: row.groundTruth ? safelyParseJSON(row.groundTruth) : undefined,
      requestContext: row.requestContext ? safelyParseJSON(row.requestContext) : undefined,
      metadata: row.metadata ? safelyParseJSON(row.metadata) : undefined,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  private transformDatasetVersionRow(row: Record<string, any>): DatasetVersion {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      version: row.version as number,
      createdAt: ensureDate(row.createdAt)!,
    };
  }

  // --- Dataset CRUD ---

  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASETS,
        record: {
          id,
          name: input.name,
          description: input.description ?? null,
          metadata: input.metadata,
          inputSchema: input.inputSchema ?? null,
          groundTruthSchema: input.groundTruthSchema ?? null,
          defaultRequestContext: input.defaultRequestContext ?? null,
          requestContextSchema: input.requestContextSchema ?? null,
          version: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      });

      return {
        id,
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        inputSchema: input.inputSchema ?? undefined,
        groundTruthSchema: input.groundTruthSchema ?? undefined,
        defaultRequestContext: input.defaultRequestContext ?? undefined,
        requestContextSchema: input.requestContextSchema ?? undefined,
        version: 0,
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

  async getDatasetById({ id }: { id: string }): Promise<DatasetRecord | null> {
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

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
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
      if (args.groundTruthSchema !== undefined) {
        updates.push('groundTruthSchema = ?');
        values.push(args.groundTruthSchema === null ? null : JSON.stringify(args.groundTruthSchema));
      }
      if (args.defaultRequestContext !== undefined) {
        updates.push('defaultRequestContext = ?');
        values.push(args.defaultRequestContext === null ? null : JSON.stringify(args.defaultRequestContext));
      }
      if (args.requestContextSchema !== undefined) {
        updates.push('requestContextSchema = ?');
        values.push(args.requestContextSchema === null ? null : JSON.stringify(args.requestContextSchema));
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
        inputSchema: (args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema) ?? undefined,
        groundTruthSchema:
          (args.groundTruthSchema !== undefined ? args.groundTruthSchema : existing.groundTruthSchema) ?? undefined,
        defaultRequestContext:
          (args.defaultRequestContext !== undefined ? args.defaultRequestContext : existing.defaultRequestContext) ??
          undefined,
        requestContextSchema:
          (args.requestContextSchema !== undefined ? args.requestContextSchema : existing.requestContextSchema) ??
          undefined,
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
      // F3 fix: detach experiments (SET NULL) instead of deleting. Delete results for FK safety.
      // Each operation wrapped separately — experiment_results table may not exist even if experiments does.
      try {
        await this.#client.execute({
          sql: `DELETE FROM ${TABLE_EXPERIMENT_RESULTS} WHERE experimentId IN (SELECT id FROM ${TABLE_EXPERIMENTS} WHERE datasetId = ?)`,
          args: [id],
        });
      } catch {
        // experiment_results table may not exist
      }
      try {
        await this.#client.execute({
          sql: `UPDATE ${TABLE_EXPERIMENTS} SET datasetId = NULL, datasetVersion = NULL WHERE datasetId = ?`,
          args: [id],
        });
      } catch {
        // experiments table may not exist
      }

      // Dataset cascade — atomic batch (T3.18)
      await this.#client.batch(
        [
          { sql: `DELETE FROM ${TABLE_DATASET_VERSIONS} WHERE datasetId = ?`, args: [id] },
          { sql: `DELETE FROM ${TABLE_DATASET_ITEMS} WHERE datasetId = ?`, args: [id] },
          { sql: `DELETE FROM ${TABLE_DATASETS} WHERE id = ?`, args: [id] },
        ],
        'write',
      );
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
        sql: `SELECT ${buildSelectColumns(TABLE_DATASETS)} FROM ${TABLE_DATASETS} ORDER BY createdAt DESC, id ASC LIMIT ? OFFSET ?`,
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

  // --- SCD-2 item mutations ---

  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    try {
      const id = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      // T3.7, T3.21 — atomic batch: bump version, insert item, insert dataset_version
      const results = await this.#client.batch(
        [
          {
            sql: `UPDATE ${TABLE_DATASETS} SET version = version + 1 WHERE id = ? RETURNING version`,
            args: [args.datasetId],
          },
          {
            sql: `INSERT INTO ${TABLE_DATASET_ITEMS} (id, datasetId, datasetVersion, validTo, isDeleted, input, groundTruth, requestContext, metadata, createdAt, updatedAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), NULL, 0, jsonb(?), jsonb(?), jsonb(?), jsonb(?), ?, ?)`,
            args: [
              id,
              args.datasetId,
              args.datasetId,
              jsonbArg(args.input)!,
              jsonbArg(args.groundTruth),
              jsonbArg(args.requestContext),
              jsonbArg(args.metadata),
              nowIso,
              nowIso,
            ],
          },
          {
            sql: `INSERT INTO ${TABLE_DATASET_VERSIONS} (id, datasetId, version, createdAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), ?)`,
            args: [versionId, args.datasetId, args.datasetId, nowIso],
          },
        ],
        'write',
      );

      const newVersion = Number(results[0]!.rows[0]!.version);

      return {
        id,
        datasetId: args.datasetId,
        datasetVersion: newVersion,
        input: args.input,
        groundTruth: args.groundTruth,
        requestContext: args.requestContext,
        metadata: args.metadata,
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

      const versionId = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      // Merge fields
      const mergedInput = args.input ?? existing.input;
      const mergedGroundTruth = args.groundTruth ?? existing.groundTruth;
      const mergedRequestContext = args.requestContext ?? existing.requestContext;
      const mergedMetadata = args.metadata ?? existing.metadata;

      // T3.8, T3.21 — atomic batch: bump version, close old row, insert new row, insert dataset_version
      const results = await this.#client.batch(
        [
          {
            sql: `UPDATE ${TABLE_DATASETS} SET version = version + 1 WHERE id = ? RETURNING version`,
            args: [args.datasetId],
          },
          {
            sql: `UPDATE ${TABLE_DATASET_ITEMS} SET validTo = (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?) WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
            args: [args.datasetId, args.id],
          },
          {
            sql: `INSERT INTO ${TABLE_DATASET_ITEMS} (id, datasetId, datasetVersion, validTo, isDeleted, input, groundTruth, requestContext, metadata, createdAt, updatedAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), NULL, 0, jsonb(?), jsonb(?), jsonb(?), jsonb(?), ?, ?)`,
            args: [
              args.id,
              args.datasetId,
              args.datasetId,
              jsonbArg(mergedInput)!,
              jsonbArg(mergedGroundTruth),
              jsonbArg(mergedRequestContext),
              jsonbArg(mergedMetadata),
              existing.createdAt.toISOString(),
              nowIso,
            ],
          },
          {
            sql: `INSERT INTO ${TABLE_DATASET_VERSIONS} (id, datasetId, version, createdAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), ?)`,
            args: [versionId, args.datasetId, args.datasetId, nowIso],
          },
        ],
        'write',
      );

      const newVersion = Number(results[0]!.rows[0]!.version);

      return {
        ...existing,
        datasetVersion: newVersion,
        input: mergedInput,
        groundTruth: mergedGroundTruth,
        requestContext: mergedRequestContext,
        metadata: mergedMetadata,
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
      // Get current item — no-op if not found
      const existing = await this.getItemById({ id });
      if (!existing) return;
      if (existing.datasetId !== datasetId) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'DELETE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: id, expectedDatasetId: datasetId, actualDatasetId: existing.datasetId },
        });
      }

      const versionId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      // T3.9, T3.21 — atomic batch: bump version, close old row, insert tombstone, insert dataset_version
      await this.#client.batch(
        [
          {
            sql: `UPDATE ${TABLE_DATASETS} SET version = version + 1 WHERE id = ? RETURNING version`,
            args: [datasetId],
          },
          {
            sql: `UPDATE ${TABLE_DATASET_ITEMS} SET validTo = (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?) WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
            args: [datasetId, id],
          },
          {
            sql: `INSERT INTO ${TABLE_DATASET_ITEMS} (id, datasetId, datasetVersion, validTo, isDeleted, input, groundTruth, requestContext, metadata, createdAt, updatedAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), NULL, 1, jsonb(?), jsonb(?), jsonb(?), jsonb(?), ?, ?)`,
            args: [
              id,
              datasetId,
              datasetId,
              jsonbArg(existing.input)!,
              jsonbArg(existing.groundTruth),
              jsonbArg(existing.requestContext),
              jsonbArg(existing.metadata),
              existing.createdAt.toISOString(),
              nowIso,
            ],
          },
          {
            sql: `INSERT INTO ${TABLE_DATASET_VERSIONS} (id, datasetId, version, createdAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), ?)`,
            args: [versionId, datasetId, datasetId, nowIso],
          },
        ],
        'write',
      );
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

  // --- SCD-2 queries ---

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    try {
      let result;
      if (args.datasetVersion !== undefined) {
        // T3.13 — exact version match, exclude deleted
        result = await this.#client.execute({
          sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} WHERE id = ? AND datasetVersion = ? AND isDeleted = 0`,
          args: [args.id, args.datasetVersion],
        });
      } else {
        // T3.12 — current row (validTo IS NULL AND isDeleted = false)
        result = await this.#client.execute({
          sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
          args: [args.id],
        });
      }
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

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: number }): Promise<DatasetItem[]> {
    try {
      // T3.14, T3.22 — SCD-2 range query, NO window functions
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} WHERE datasetId = ? AND datasetVersion <= ? AND (validTo IS NULL OR validTo > ?) AND isDeleted = 0 ORDER BY createdAt DESC, id ASC`,
        args: [datasetId, version, version],
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

  async getItemHistory(itemId: string): Promise<DatasetItemRow[]> {
    try {
      // ALL rows including tombstones, ordered by datasetVersion DESC (newest first)
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} WHERE id = ? ORDER BY datasetVersion DESC`,
        args: [itemId],
      });

      return result.rows?.map(row => this.transformItemRowFull(row)) ?? [];
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ITEM_HISTORY', 'FAILED'),
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

      if (args.version !== undefined) {
        // SCD-2 time-travel query — T3.14, T3.22 (no window functions)
        const conditions: string[] = [
          'datasetId = ?',
          'datasetVersion <= ?',
          '(validTo IS NULL OR validTo > ?)',
          'isDeleted = 0',
        ];
        const queryParams: InValue[] = [args.datasetId, args.version, args.version];

        if (args.search) {
          conditions.push(`(LOWER(json(input)) LIKE ? OR LOWER(COALESCE(json(groundTruth), '')) LIKE ?)`);
          const searchPattern = `%${args.search.toLowerCase()}%`;
          queryParams.push(searchPattern, searchPattern);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

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
          sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} ${whereClause} ORDER BY createdAt DESC, id ASC LIMIT ? OFFSET ?`,
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
      }

      // T3.16 — current items only (validTo IS NULL AND isDeleted = false)
      const conditions: string[] = ['datasetId = ?', 'validTo IS NULL', 'isDeleted = 0'];
      const queryParams: InValue[] = [args.datasetId];

      if (args.search) {
        conditions.push(`(LOWER(json(input)) LIKE ? OR LOWER(COALESCE(json(groundTruth), '')) LIKE ?)`);
        const searchPattern = `%${args.search.toLowerCase()}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

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
        sql: `SELECT ${buildSelectColumns(TABLE_DATASET_ITEMS)} FROM ${TABLE_DATASET_ITEMS} ${whereClause} ORDER BY createdAt DESC, id ASC LIMIT ? OFFSET ?`,
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

  // --- Dataset version methods ---

  async createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_DATASET_VERSIONS,
        record: {
          id,
          datasetId,
          version,
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

  // --- Bulk operations (SCD-2 internally) ---

  protected async _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
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
      const versionId = crypto.randomUUID();

      // T3.19 — single version increment for all items
      const statements: { sql: string; args: InValue[] }[] = [
        {
          sql: `UPDATE ${TABLE_DATASETS} SET version = version + 1 WHERE id = ? RETURNING version`,
          args: [input.datasetId],
        },
      ];

      const items: { id: string; input: BatchInsertItemsInput['items'][number] }[] = [];
      for (const itemInput of input.items) {
        const id = crypto.randomUUID();
        items.push({ id, input: itemInput });
        statements.push({
          sql: `INSERT INTO ${TABLE_DATASET_ITEMS} (id, datasetId, datasetVersion, validTo, isDeleted, input, groundTruth, requestContext, metadata, createdAt, updatedAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), NULL, 0, jsonb(?), jsonb(?), jsonb(?), jsonb(?), ?, ?)`,
          args: [
            id,
            input.datasetId,
            input.datasetId,
            jsonbArg(itemInput.input)!,
            jsonbArg(itemInput.groundTruth),
            jsonbArg(itemInput.requestContext),
            jsonbArg(itemInput.metadata),
            nowIso,
            nowIso,
          ],
        });
      }

      // T3.11 — single dataset_version for the bulk operation
      statements.push({
        sql: `INSERT INTO ${TABLE_DATASET_VERSIONS} (id, datasetId, version, createdAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), ?)`,
        args: [versionId, input.datasetId, input.datasetId, nowIso],
      });

      const results = await this.#client.batch(statements, 'write');
      const newVersion = Number(results[0]!.rows[0]!.version);

      return items.map(({ id, input: itemInput }) => ({
        id,
        datasetId: input.datasetId,
        datasetVersion: newVersion,
        input: itemInput.input,
        groundTruth: itemInput.groundTruth,
        requestContext: itemInput.requestContext,
        metadata: itemInput.metadata,
        createdAt: now,
        updatedAt: now,
      }));
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

  protected async _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
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

      // Fetch current items for tombstone data
      const currentItems: DatasetItem[] = [];
      for (const itemId of input.itemIds) {
        const item = await this.getItemById({ id: itemId });
        if (item && item.datasetId === input.datasetId) {
          currentItems.push(item);
        }
      }

      if (currentItems.length === 0) return;

      const nowIso = new Date().toISOString();
      const versionId = crypto.randomUUID();

      // T3.20 — single version increment
      const statements: { sql: string; args: InValue[] }[] = [
        {
          sql: `UPDATE ${TABLE_DATASETS} SET version = version + 1 WHERE id = ? RETURNING version`,
          args: [input.datasetId],
        },
      ];

      for (const item of currentItems) {
        // Close old row
        statements.push({
          sql: `UPDATE ${TABLE_DATASET_ITEMS} SET validTo = (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?) WHERE id = ? AND validTo IS NULL AND isDeleted = 0`,
          args: [input.datasetId, item.id],
        });
        // Insert tombstone
        statements.push({
          sql: `INSERT INTO ${TABLE_DATASET_ITEMS} (id, datasetId, datasetVersion, validTo, isDeleted, input, groundTruth, requestContext, metadata, createdAt, updatedAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), NULL, 1, jsonb(?), jsonb(?), jsonb(?), jsonb(?), ?, ?)`,
          args: [
            item.id,
            input.datasetId,
            input.datasetId,
            jsonbArg(item.input)!,
            jsonbArg(item.groundTruth),
            jsonbArg(item.requestContext),
            jsonbArg(item.metadata),
            item.createdAt.toISOString(),
            nowIso,
          ],
        });
      }

      // T3.11 — single dataset_version
      statements.push({
        sql: `INSERT INTO ${TABLE_DATASET_VERSIONS} (id, datasetId, version, createdAt) VALUES (?, ?, (SELECT version FROM ${TABLE_DATASETS} WHERE id = ?), ?)`,
        args: [versionId, input.datasetId, input.datasetId, nowIso],
      });

      await this.#client.batch(statements, 'write');
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
