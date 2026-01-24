import { calculatePagination, normalizePerPage } from '../../base';
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
} from '../../types';
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
  }

  // Dataset CRUD
  async createDataset(input: CreateDatasetInput): Promise<Dataset> {
    const id = crypto.randomUUID();
    const now = new Date();
    const dataset: Dataset = {
      id,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
      version: now, // Timestamp-based versioning
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasets.set(id, dataset);
    return dataset;
  }

  async getDatasetById({ id }: { id: string }): Promise<Dataset | null> {
    return this.db.datasets.get(id) ?? null;
  }

  async updateDataset(args: UpdateDatasetInput): Promise<Dataset> {
    const existing = this.db.datasets.get(args.id);
    if (!existing) {
      throw new Error(`Dataset not found: ${args.id}`);
    }
    const updated: Dataset = {
      ...existing,
      name: args.name ?? existing.name,
      description: args.description ?? existing.description,
      metadata: args.metadata ?? existing.metadata,
      updatedAt: new Date(),
    };
    this.db.datasets.set(args.id, updated);
    return updated;
  }

  async deleteDataset({ id }: { id: string }): Promise<void> {
    // Delete all items for this dataset first
    for (const [itemId, item] of this.db.datasetItems) {
      if (item.datasetId === id) {
        this.db.datasetItems.delete(itemId);
      }
    }
    this.db.datasets.delete(id);
  }

  async listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput> {
    const datasets = Array.from(this.db.datasets.values());
    // Sort by createdAt descending (newest first)
    datasets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
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

  // Item CRUD with auto-versioning (timestamp-based)
  async addItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    const dataset = this.db.datasets.get(args.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    // New version timestamp
    const now = new Date();
    this.db.datasets.set(args.datasetId, {
      ...dataset,
      version: now,
      updatedAt: now,
    });

    const id = crypto.randomUUID();
    const item: DatasetItem = {
      id,
      datasetId: args.datasetId,
      version: now, // Item stores the version timestamp when added
      input: args.input,
      expectedOutput: args.expectedOutput,
      context: args.context,
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasetItems.set(id, item);
    return item;
  }

  async updateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    const existing = this.db.datasetItems.get(args.id);
    if (!existing) {
      throw new Error(`Item not found: ${args.id}`);
    }
    if (existing.datasetId !== args.datasetId) {
      throw new Error(`Item ${args.id} does not belong to dataset ${args.datasetId}`);
    }

    const dataset = this.db.datasets.get(args.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    // New version timestamp
    const now = new Date();
    this.db.datasets.set(args.datasetId, {
      ...dataset,
      version: now,
      updatedAt: now,
    });

    const updated: DatasetItem = {
      ...existing,
      version: now, // Update item's version timestamp
      input: args.input ?? existing.input,
      expectedOutput: args.expectedOutput ?? existing.expectedOutput,
      context: args.context ?? existing.context,
      updatedAt: now,
    };
    this.db.datasetItems.set(args.id, updated);
    return updated;
  }

  async deleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
    const existing = this.db.datasetItems.get(id);
    if (!existing) {
      throw new Error(`Item not found: ${id}`);
    }
    if (existing.datasetId !== datasetId) {
      throw new Error(`Item ${id} does not belong to dataset ${datasetId}`);
    }

    const dataset = this.db.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    // New version timestamp on delete
    const now = new Date();
    this.db.datasets.set(datasetId, {
      ...dataset,
      version: now,
      updatedAt: now,
    });

    this.db.datasetItems.delete(id);
  }

  async getItemById({ id }: { id: string }): Promise<DatasetItem | null> {
    return this.db.datasetItems.get(id) ?? null;
  }

  async listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput> {
    let items = Array.from(this.db.datasetItems.values()).filter(item => item.datasetId === args.datasetId);

    // Filter by version if specified (snapshot semantics: items at or before this version timestamp)
    if (args.version !== undefined) {
      const versionTime = args.version.getTime();
      items = items.filter(item => item.version.getTime() <= versionTime);
    }

    // Sort by createdAt descending
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? items.length : start + perPage;

    return {
      items: items.slice(start, end),
      pagination: {
        total: items.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : items.length > end,
      },
    };
  }

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: Date }): Promise<DatasetItem[]> {
    // Snapshot semantics: return items that existed at or before this version timestamp
    const versionTime = version.getTime();
    const items = Array.from(this.db.datasetItems.values()).filter(
      item => item.datasetId === datasetId && item.version.getTime() <= versionTime,
    );
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }
}
