import { randomUUID } from 'crypto';

import type {
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
} from '../../../datasets/types';
import { calculatePagination, normalizePerPage } from '../../base';
import type { StoragePagination } from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { DatasetsStorage } from './base';

export class DatasetsInMemory extends DatasetsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.datasets.clear();
    this.db.datasetItems.clear();
    this.db.datasetRuns.clear();
    this.db.datasetRunResults.clear();
  }

  // ============================================================================
  // Dataset methods
  // ============================================================================

  async createDataset(payload: CreateDatasetPayload): Promise<Dataset> {
    const now = new Date();
    const dataset: Dataset = {
      id: randomUUID(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasets.set(dataset.id, dataset);
    return dataset;
  }

  async getDatasetById(id: string): Promise<Dataset | null> {
    return this.db.datasets.get(id) ?? null;
  }

  async getDatasetByName(name: string): Promise<Dataset | null> {
    for (const dataset of this.db.datasets.values()) {
      if (dataset.name === name) {
        return dataset;
      }
    }
    return null;
  }

  async updateDataset(id: string, payload: UpdateDatasetPayload): Promise<Dataset> {
    const existing = this.db.datasets.get(id);
    if (!existing) {
      throw new Error(`Dataset not found: ${id}`);
    }
    const updated: Dataset = {
      ...existing,
      ...payload,
      updatedAt: new Date(),
    };
    this.db.datasets.set(id, updated);
    return updated;
  }

  async deleteDataset(id: string): Promise<void> {
    this.db.datasets.delete(id);
  }

  async listDatasets(pagination: StoragePagination): Promise<ListDatasetsResponse> {
    const datasets = Array.from(this.db.datasets.values());
    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? datasets.length : start + perPage;

    return {
      datasets: datasets.slice(start, end),
      pagination: {
        total: datasets.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : datasets.length > end,
      },
    };
  }

  // ============================================================================
  // Dataset Item methods
  // ============================================================================

  async createDatasetItem(payload: CreateDatasetItemPayload): Promise<DatasetItem> {
    const now = new Date();
    const item: DatasetItem = {
      id: randomUUID(),
      ...payload,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasetItems.set(item.id, item);
    return item;
  }

  async createDatasetItems(payloads: CreateDatasetItemPayload[]): Promise<DatasetItem[]> {
    const items: DatasetItem[] = [];
    for (const payload of payloads) {
      const item = await this.createDatasetItem(payload);
      items.push(item);
    }
    return items;
  }

  async getDatasetItemById(id: string): Promise<DatasetItem | null> {
    return this.db.datasetItems.get(id) ?? null;
  }

  async updateDatasetItem(id: string, payload: UpdateDatasetItemPayload): Promise<DatasetItem> {
    const existing = this.db.datasetItems.get(id);
    if (!existing) {
      throw new Error(`DatasetItem not found: ${id}`);
    }
    const updated: DatasetItem = {
      ...existing,
      ...payload,
      updatedAt: new Date(),
    };
    this.db.datasetItems.set(id, updated);
    return updated;
  }

  async archiveDatasetItem(id: string): Promise<void> {
    const existing = this.db.datasetItems.get(id);
    if (!existing) {
      throw new Error(`DatasetItem not found: ${id}`);
    }
    const updated: DatasetItem = {
      ...existing,
      archivedAt: new Date(),
      updatedAt: new Date(),
    };
    this.db.datasetItems.set(id, updated);
  }

  async listDatasetItems(
    options: ListDatasetItemsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetItemsResponse> {
    const { datasetId, asOf, includeArchived = false } = options;

    // Filter items
    const filtered = Array.from(this.db.datasetItems.values()).filter(item => {
      // Must match datasetId
      if (item.datasetId !== datasetId) {
        return false;
      }

      if (asOf) {
        // Point-in-time query: item must exist at asOf time
        // createdAt <= asOf AND (archivedAt is null OR archivedAt > asOf)
        if (item.createdAt > asOf) {
          return false;
        }
        if (item.archivedAt && item.archivedAt <= asOf) {
          return false;
        }
      } else {
        // Normal query: respect includeArchived flag
        if (!includeArchived && item.archivedAt) {
          return false;
        }
      }

      return true;
    });

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;

    return {
      items: filtered.slice(start, end),
      pagination: {
        total: filtered.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : filtered.length > end,
      },
    };
  }

  // ============================================================================
  // Dataset Run methods
  // ============================================================================

  async createDatasetRun(payload: CreateDatasetRunPayload): Promise<DatasetRun> {
    const now = new Date();
    const run: DatasetRun = {
      id: randomUUID(),
      ...payload,
      status: 'pending',
      completedCount: 0,
      createdAt: now,
      completedAt: null,
    };
    this.db.datasetRuns.set(run.id, run);
    return run;
  }

  async getDatasetRunById(id: string): Promise<DatasetRun | null> {
    return this.db.datasetRuns.get(id) ?? null;
  }

  async updateDatasetRun(id: string, payload: UpdateDatasetRunPayload): Promise<DatasetRun> {
    const existing = this.db.datasetRuns.get(id);
    if (!existing) {
      throw new Error(`DatasetRun not found: ${id}`);
    }
    const updated: DatasetRun = {
      ...existing,
      ...payload,
    };
    this.db.datasetRuns.set(id, updated);
    return updated;
  }

  async listDatasetRuns(
    options: ListDatasetRunsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetRunsResponse> {
    const { datasetId, status } = options;

    const filtered = Array.from(this.db.datasetRuns.values()).filter(run => {
      if (datasetId && run.datasetId !== datasetId) {
        return false;
      }
      if (status && run.status !== status) {
        return false;
      }
      return true;
    });

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;

    return {
      runs: filtered.slice(start, end),
      pagination: {
        total: filtered.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : filtered.length > end,
      },
    };
  }

  // ============================================================================
  // Dataset Run Result methods
  // ============================================================================

  async createDatasetRunResult(payload: CreateDatasetRunResultPayload): Promise<DatasetRunResult> {
    const result: DatasetRunResult = {
      id: randomUUID(),
      ...payload,
      createdAt: new Date(),
    };
    this.db.datasetRunResults.set(result.id, result);
    return result;
  }

  async createDatasetRunResults(payloads: CreateDatasetRunResultPayload[]): Promise<DatasetRunResult[]> {
    const results: DatasetRunResult[] = [];
    for (const payload of payloads) {
      const result = await this.createDatasetRunResult(payload);
      results.push(result);
    }
    return results;
  }

  async listDatasetRunResults(
    options: ListDatasetRunResultsOptions,
    pagination: StoragePagination,
  ): Promise<ListDatasetRunResultsResponse> {
    const { runId, status } = options;

    const filtered = Array.from(this.db.datasetRunResults.values()).filter(result => {
      if (result.runId !== runId) {
        return false;
      }
      if (status && result.status !== status) {
        return false;
      }
      return true;
    });

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;

    return {
      results: filtered.slice(start, end),
      pagination: {
        total: filtered.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : filtered.length > end,
      },
    };
  }
}
