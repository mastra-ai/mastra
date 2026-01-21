import type { Client, InValue } from '@libsql/client';
import {
  calculatePagination,
  normalizePerPage,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_RUNS,
  TABLE_DATASET_RUN_RESULTS,
  DATASET_SCHEMA,
  DATASET_ITEM_SCHEMA,
  DATASET_RUN_SCHEMA,
  DATASET_RUN_RESULT_SCHEMA,
  DatasetsStorage,
} from '@mastra/core/storage';
import type {
  StoragePagination,
  CreateDatasetItemPayload,
  CreateDatasetPayload,
  CreateDatasetRunPayload,
  CreateDatasetRunResultPayload,
  Dataset,
  DatasetItem,
  DatasetRun,
  DatasetRunResult,
  ListDatasetItemsOptions,
  ListDatasetItemsResponse,
  ListDatasetRunResultsOptions,
  ListDatasetRunResultsResponse,
  ListDatasetRunsOptions,
  ListDatasetRunsResponse,
  ListDatasetsResponse,
  UpdateDatasetItemPayload,
  UpdateDatasetPayload,
  UpdateDatasetRunPayload,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

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
    await this.#db.createTable({ tableName: TABLE_DATASETS, schema: DATASET_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_ITEMS, schema: DATASET_ITEM_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_RUNS, schema: DATASET_RUN_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_RUN_RESULTS, schema: DATASET_RUN_RESULT_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_DATASET_RUN_RESULTS });
    await this.#db.deleteData({ tableName: TABLE_DATASET_RUNS });
    await this.#db.deleteData({ tableName: TABLE_DATASET_ITEMS });
    await this.#db.deleteData({ tableName: TABLE_DATASETS });
  }

  // ============================================================================
  // Dataset methods
  // ============================================================================

  async createDataset(payload: CreateDatasetPayload): Promise<Dataset> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.#db.insert({
      tableName: TABLE_DATASETS,
      record: {
        id,
        name: payload.name,
        description: payload.description ?? null,
        metadata: payload.metadata ?? null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

    return {
      id,
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getDatasetById(id: string): Promise<Dataset | null> {
    const result = await this.#client.execute({
      sql: `SELECT id, name, description, json(metadata) as metadata, createdAt, updatedAt FROM ${TABLE_DATASETS} WHERE id = ?`,
      args: [id],
    });

    const row = result.rows?.[0];
    if (!row) {
      return null;
    }

    return this.transformDatasetRow(row);
  }

  async getDatasetByName(name: string): Promise<Dataset | null> {
    const result = await this.#client.execute({
      sql: `SELECT id, name, description, json(metadata) as metadata, createdAt, updatedAt FROM ${TABLE_DATASETS} WHERE name = ?`,
      args: [name],
    });

    const row = result.rows?.[0];
    if (!row) {
      return null;
    }

    return this.transformDatasetRow(row);
  }

  async updateDataset(id: string, payload: UpdateDatasetPayload): Promise<Dataset> {
    const existing = await this.getDatasetById(id);
    if (!existing) {
      throw new Error(`Dataset not found: ${id}`);
    }

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now.toISOString() };

    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    await this.#db.update({
      tableName: TABLE_DATASETS,
      keys: { id },
      data: updates,
    });

    return {
      ...existing,
      ...payload,
      updatedAt: now,
    };
  }

  async deleteDataset(id: string): Promise<void> {
    await this.#db.delete({
      tableName: TABLE_DATASETS,
      keys: { id },
    });
  }

  async listDatasets(pagination: StoragePagination): Promise<ListDatasetsResponse> {
    const { page, perPage: perPageInput } = pagination;

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
      sql: `SELECT id, name, description, json(metadata) as metadata, createdAt, updatedAt FROM ${TABLE_DATASETS} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      args: [limitValue, start],
    });

    const datasets = result.rows?.map(row => this.transformDatasetRow(row)) ?? [];

    return {
      datasets,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }

  // ============================================================================
  // Dataset Item methods
  // ============================================================================

  async createDatasetItem(payload: CreateDatasetItemPayload): Promise<DatasetItem> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.#db.insert({
      tableName: TABLE_DATASET_ITEMS,
      record: {
        id,
        datasetId: payload.datasetId,
        input: payload.input,
        expectedOutput: payload.expectedOutput ?? null,
        metadata: payload.metadata ?? null,
        sourceTraceId: payload.sourceTraceId ?? null,
        sourceSpanId: payload.sourceSpanId ?? null,
        archivedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

    return {
      id,
      ...payload,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async createDatasetItems(payloads: CreateDatasetItemPayload[]): Promise<DatasetItem[]> {
    if (payloads.length === 0) return [];

    const now = new Date();
    const items: DatasetItem[] = [];
    const records: Record<string, unknown>[] = [];

    for (const payload of payloads) {
      const id = crypto.randomUUID();
      records.push({
        id,
        datasetId: payload.datasetId,
        input: payload.input,
        expectedOutput: payload.expectedOutput ?? null,
        metadata: payload.metadata ?? null,
        sourceTraceId: payload.sourceTraceId ?? null,
        sourceSpanId: payload.sourceSpanId ?? null,
        archivedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      items.push({
        id,
        ...payload,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.#db.batchInsert({
      tableName: TABLE_DATASET_ITEMS,
      records,
    });

    return items;
  }

  async getDatasetItemById(id: string): Promise<DatasetItem | null> {
    const result = await this.#client.execute({
      sql: `SELECT id, datasetId, json(input) as input, json(expectedOutput) as expectedOutput, json(metadata) as metadata, sourceTraceId, sourceSpanId, archivedAt, createdAt, updatedAt FROM ${TABLE_DATASET_ITEMS} WHERE id = ?`,
      args: [id],
    });

    const row = result.rows?.[0];
    if (!row) {
      return null;
    }

    return this.transformDatasetItemRow(row);
  }

  async updateDatasetItem(id: string, payload: UpdateDatasetItemPayload): Promise<DatasetItem> {
    const existing = await this.getDatasetItemById(id);
    if (!existing) {
      throw new Error(`DatasetItem not found: ${id}`);
    }

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now.toISOString() };

    if (payload.input !== undefined) updates.input = payload.input;
    if (payload.expectedOutput !== undefined) updates.expectedOutput = payload.expectedOutput;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    await this.#db.update({
      tableName: TABLE_DATASET_ITEMS,
      keys: { id },
      data: updates,
    });

    return {
      ...existing,
      ...payload,
      updatedAt: now,
    };
  }

  async archiveDatasetItem(id: string): Promise<void> {
    const existing = await this.getDatasetItemById(id);
    if (!existing) {
      throw new Error(`DatasetItem not found: ${id}`);
    }

    const now = new Date();
    await this.#db.update({
      tableName: TABLE_DATASET_ITEMS,
      keys: { id },
      data: {
        archivedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  }

  async listDatasetItems(
    options: ListDatasetItemsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetItemsResponse> {
    const { datasetId, asOf, includeArchived = false } = options;
    const { page, perPage: perPageInput } = pagination;

    const conditions: string[] = ['datasetId = ?'];
    const queryParams: InValue[] = [datasetId];

    if (asOf) {
      // Point-in-time query: item existed at asOf time
      // createdAt <= asOf AND (archivedAt IS NULL OR archivedAt > asOf)
      const asOfStr = asOf.toISOString();
      conditions.push('createdAt <= ?');
      queryParams.push(asOfStr);
      conditions.push('(archivedAt IS NULL OR archivedAt > ?)');
      queryParams.push(asOfStr);
    } else if (!includeArchived) {
      conditions.push('archivedAt IS NULL');
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
      sql: `SELECT id, datasetId, json(input) as input, json(expectedOutput) as expectedOutput, json(metadata) as metadata, sourceTraceId, sourceSpanId, archivedAt, createdAt, updatedAt FROM ${TABLE_DATASET_ITEMS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      args: [...queryParams, limitValue, start],
    });

    const items = result.rows?.map(row => this.transformDatasetItemRow(row)) ?? [];

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

  // ============================================================================
  // Dataset Run methods
  // ============================================================================

  async createDatasetRun(payload: CreateDatasetRunPayload): Promise<DatasetRun> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.#db.insert({
      tableName: TABLE_DATASET_RUNS,
      record: {
        id,
        datasetId: payload.datasetId,
        name: payload.name ?? null,
        targetType: payload.targetType,
        targetId: payload.targetId ?? null,
        scorerIds: payload.scorerIds,
        status: 'pending',
        itemCount: payload.itemCount,
        completedCount: 0,
        metadata: payload.metadata ?? null,
        createdAt: now.toISOString(),
        completedAt: null,
      },
    });

    return {
      id,
      ...payload,
      status: 'pending',
      completedCount: 0,
      createdAt: now,
      completedAt: null,
    };
  }

  async getDatasetRunById(id: string): Promise<DatasetRun | null> {
    const result = await this.#client.execute({
      sql: `SELECT id, datasetId, name, targetType, targetId, json(scorerIds) as scorerIds, status, itemCount, completedCount, json(metadata) as metadata, createdAt, completedAt FROM ${TABLE_DATASET_RUNS} WHERE id = ?`,
      args: [id],
    });

    const row = result.rows?.[0];
    if (!row) {
      return null;
    }

    return this.transformDatasetRunRow(row);
  }

  async updateDatasetRun(id: string, payload: UpdateDatasetRunPayload): Promise<DatasetRun> {
    const existing = await this.getDatasetRunById(id);
    if (!existing) {
      throw new Error(`DatasetRun not found: ${id}`);
    }

    const updates: Record<string, unknown> = {};

    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.completedCount !== undefined) updates.completedCount = payload.completedCount;
    if (payload.completedAt !== undefined) {
      updates.completedAt = payload.completedAt ? payload.completedAt.toISOString() : null;
    }

    if (Object.keys(updates).length > 0) {
      await this.#db.update({
        tableName: TABLE_DATASET_RUNS,
        keys: { id },
        data: updates,
      });
    }

    return {
      ...existing,
      ...payload,
    };
  }

  async listDatasetRuns(
    options: ListDatasetRunsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetRunsResponse> {
    const { datasetId, status } = options;
    const { page, perPage: perPageInput } = pagination;

    const conditions: string[] = [];
    const queryParams: InValue[] = [];

    if (datasetId) {
      conditions.push('datasetId = ?');
      queryParams.push(datasetId);
    }

    if (status) {
      conditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.#client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_RUNS} ${whereClause}`,
      args: queryParams,
    });
    const total = Number(countResult.rows?.[0]?.count ?? 0);

    if (total === 0) {
      return {
        runs: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const limitValue = perPageInput === false ? total : perPage;
    const end = perPageInput === false ? total : start + perPage;

    const result = await this.#client.execute({
      sql: `SELECT id, datasetId, name, targetType, targetId, json(scorerIds) as scorerIds, status, itemCount, completedCount, json(metadata) as metadata, createdAt, completedAt FROM ${TABLE_DATASET_RUNS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      args: [...queryParams, limitValue, start],
    });

    const runs = result.rows?.map(row => this.transformDatasetRunRow(row)) ?? [];

    return {
      runs,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }

  // ============================================================================
  // Dataset Run Result methods
  // ============================================================================

  async createDatasetRunResult(payload: CreateDatasetRunResultPayload): Promise<DatasetRunResult> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.#db.insert({
      tableName: TABLE_DATASET_RUN_RESULTS,
      record: {
        id,
        runId: payload.runId,
        itemId: payload.itemId,
        actualOutput: payload.actualOutput,
        traceId: payload.traceId ?? null,
        spanId: payload.spanId ?? null,
        status: payload.status,
        error: payload.error ?? null,
        durationMs: payload.durationMs ?? null,
        createdAt: now.toISOString(),
      },
    });

    return {
      id,
      ...payload,
      createdAt: now,
    };
  }

  async createDatasetRunResults(payloads: CreateDatasetRunResultPayload[]): Promise<DatasetRunResult[]> {
    if (payloads.length === 0) return [];

    const now = new Date();
    const results: DatasetRunResult[] = [];
    const records: Record<string, unknown>[] = [];

    for (const payload of payloads) {
      const id = crypto.randomUUID();
      records.push({
        id,
        runId: payload.runId,
        itemId: payload.itemId,
        actualOutput: payload.actualOutput,
        traceId: payload.traceId ?? null,
        spanId: payload.spanId ?? null,
        status: payload.status,
        error: payload.error ?? null,
        durationMs: payload.durationMs ?? null,
        createdAt: now.toISOString(),
      });
      results.push({
        id,
        ...payload,
        createdAt: now,
      });
    }

    await this.#db.batchInsert({
      tableName: TABLE_DATASET_RUN_RESULTS,
      records,
    });

    return results;
  }

  async listDatasetRunResults(
    options: ListDatasetRunResultsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetRunResultsResponse> {
    const { runId, status } = options;
    const { page, perPage: perPageInput } = pagination;

    const conditions: string[] = ['runId = ?'];
    const queryParams: InValue[] = [runId];

    if (status) {
      conditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countResult = await this.#client.execute({
      sql: `SELECT COUNT(*) as count FROM ${TABLE_DATASET_RUN_RESULTS} ${whereClause}`,
      args: queryParams,
    });
    const total = Number(countResult.rows?.[0]?.count ?? 0);

    if (total === 0) {
      return {
        results: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const limitValue = perPageInput === false ? total : perPage;
    const end = perPageInput === false ? total : start + perPage;

    const result = await this.#client.execute({
      sql: `SELECT id, runId, itemId, json(actualOutput) as actualOutput, traceId, spanId, status, error, durationMs, createdAt FROM ${TABLE_DATASET_RUN_RESULTS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      args: [...queryParams, limitValue, start],
    });

    const results = result.rows?.map(row => this.transformDatasetRunResultRow(row)) ?? [];

    return {
      results,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }

  // ============================================================================
  // Row transformation helpers
  // ============================================================================

  private transformDatasetRow(row: Record<string, unknown>): Dataset {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      metadata: this.parseJson(row.metadata) as Record<string, unknown> | undefined,
      createdAt: this.parseDate(row.createdAt),
      updatedAt: this.parseDate(row.updatedAt),
    };
  }

  private transformDatasetItemRow(row: Record<string, unknown>): DatasetItem {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      input: this.parseJson(row.input),
      expectedOutput: this.parseJson(row.expectedOutput),
      metadata: this.parseJson(row.metadata) as Record<string, unknown> | undefined,
      sourceTraceId: row.sourceTraceId as string | undefined,
      sourceSpanId: row.sourceSpanId as string | undefined,
      archivedAt: row.archivedAt ? this.parseDate(row.archivedAt) : null,
      createdAt: this.parseDate(row.createdAt),
      updatedAt: this.parseDate(row.updatedAt),
    };
  }

  private transformDatasetRunRow(row: Record<string, unknown>): DatasetRun {
    return {
      id: row.id as string,
      datasetId: row.datasetId as string,
      name: row.name as string | undefined,
      targetType: row.targetType as 'AGENT' | 'WORKFLOW' | 'CUSTOM',
      targetId: row.targetId as string | undefined,
      scorerIds: this.parseJson(row.scorerIds) as string[],
      status: row.status as 'pending' | 'running' | 'completed' | 'failed',
      itemCount: row.itemCount as number,
      completedCount: row.completedCount as number,
      metadata: this.parseJson(row.metadata) as Record<string, unknown> | undefined,
      createdAt: this.parseDate(row.createdAt),
      completedAt: row.completedAt ? this.parseDate(row.completedAt) : null,
    };
  }

  private transformDatasetRunResultRow(row: Record<string, unknown>): DatasetRunResult {
    return {
      id: row.id as string,
      runId: row.runId as string,
      itemId: row.itemId as string,
      // actualOutput can be explicitly null (error case), preserve it
      actualOutput: row.actualOutput === null ? null : this.parseJson(row.actualOutput),
      traceId: row.traceId as string | undefined,
      spanId: row.spanId as string | undefined,
      status: row.status as 'success' | 'error',
      error: row.error as string | undefined,
      durationMs: row.durationMs as number | undefined,
      createdAt: this.parseDate(row.createdAt),
    };
  }

  private parseJson(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private parseDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    return new Date();
  }
}
