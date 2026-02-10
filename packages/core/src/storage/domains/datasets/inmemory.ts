import { calculatePagination, normalizePerPage } from '../../base';
import type {
  DatasetRecord,
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
    this.db.itemVersions.clear();
    this.db.datasetVersions.clear();
  }

  // Dataset CRUD
  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const dataset: DatasetRecord = {
      id,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
      inputSchema: input.inputSchema,
      groundTruthSchema: input.groundTruthSchema,
      version: now, // Timestamp-based versioning
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasets.set(id, dataset);
    return dataset;
  }

  async getDatasetById({ id }: { id: string }): Promise<DatasetRecord | null> {
    return this.db.datasets.get(id) ?? null;
  }

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    const existing = this.db.datasets.get(args.id);
    if (!existing) {
      throw new Error(`Dataset not found: ${args.id}`);
    }

    const updated: DatasetRecord = {
      ...existing,
      name: args.name ?? existing.name,
      description: args.description ?? existing.description,
      metadata: args.metadata ?? existing.metadata,
      inputSchema: args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema,
      groundTruthSchema: args.groundTruthSchema !== undefined ? args.groundTruthSchema : existing.groundTruthSchema,
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
  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
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
      groundTruth: args.groundTruth,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasetItems.set(id, item);
    return item;
  }

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
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
      groundTruth: args.groundTruth ?? existing.groundTruth,
      metadata: args.metadata ?? existing.metadata,
      updatedAt: now,
    };
    this.db.datasetItems.set(args.id, updated);
    return updated;
  }

  protected async _doDeleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
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

    // Update dataset version timestamp
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
    let items: DatasetItem[];

    // When version is specified, query itemVersions for historical state
    if (args.version !== undefined) {
      const versionTime = args.version.getTime();

      // Get all versions for this dataset at or before the requested version
      const relevantVersions = Array.from(this.db.itemVersions.values()).filter(
        v => v.datasetId === args.datasetId && new Date(v.datasetVersion).getTime() <= versionTime,
      );

      // Group by itemId and get the latest version for each
      const latestByItem = new Map<string, DatasetItemVersion>();
      for (const v of relevantVersions) {
        const existing = latestByItem.get(v.itemId);
        if (!existing || new Date(v.datasetVersion).getTime() > new Date(existing.datasetVersion).getTime()) {
          latestByItem.set(v.itemId, v);
        }
      }

      // Convert version snapshots to DatasetItem format, excluding deleted items
      items = [];
      for (const v of latestByItem.values()) {
        if (!v.isDeleted) {
          // Get the original item to preserve createdAt and as fallback for missing snapshot
          const originalItem = this.db.datasetItems.get(v.itemId);
          const snapshot = v.snapshot ?? {};
          items.push({
            id: v.itemId,
            datasetId: v.datasetId,
            version: new Date(v.datasetVersion),
            input: snapshot.input ?? originalItem?.input,
            groundTruth: snapshot.groundTruth ?? originalItem?.groundTruth,
            metadata: snapshot.metadata ?? originalItem?.metadata,
            createdAt: originalItem?.createdAt ?? new Date(v.createdAt),
            updatedAt: new Date(v.datasetVersion),
          });
        }
      }
    } else {
      // Current state - query items table directly
      items = Array.from(this.db.datasetItems.values()).filter(item => item.datasetId === args.datasetId);
    }

    // Filter by search term if specified (case-insensitive partial match on input/groundTruth)
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      items = items.filter(item => {
        const inputStr = typeof item.input === 'string' ? item.input : JSON.stringify(item.input);
        const outputStr = item.groundTruth
          ? typeof item.groundTruth === 'string'
            ? item.groundTruth
            : JSON.stringify(item.groundTruth)
          : '';
        return inputStr.toLowerCase().includes(searchLower) || outputStr.toLowerCase().includes(searchLower);
      });
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
    // Query itemVersions for historical state at or before this version timestamp
    const versionTime = version.getTime();

    // Get all versions for this dataset at or before the requested version
    const relevantVersions = Array.from(this.db.itemVersions.values()).filter(
      v => v.datasetId === datasetId && new Date(v.datasetVersion).getTime() <= versionTime,
    );

    // Group by itemId and get the latest version for each
    const latestByItem = new Map<string, DatasetItemVersion>();
    for (const v of relevantVersions) {
      const existing = latestByItem.get(v.itemId);
      if (!existing || new Date(v.datasetVersion).getTime() > new Date(existing.datasetVersion).getTime()) {
        latestByItem.set(v.itemId, v);
      }
    }

    // Convert version snapshots to DatasetItem format, excluding deleted items
    const items: DatasetItem[] = [];
    for (const v of latestByItem.values()) {
      if (!v.isDeleted) {
        const originalItem = this.db.datasetItems.get(v.itemId);
        const snapshot = v.snapshot ?? {};
        items.push({
          id: v.itemId,
          datasetId: v.datasetId,
          version: new Date(v.datasetVersion),
          input: snapshot.input ?? originalItem?.input,
          groundTruth: snapshot.groundTruth ?? originalItem?.groundTruth,
          metadata: snapshot.metadata ?? originalItem?.metadata,
          createdAt: originalItem?.createdAt ?? new Date(v.createdAt),
          updatedAt: new Date(v.datasetVersion),
        });
      }
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }

  // Item version methods
  async createItemVersion(input: CreateItemVersionInput): Promise<DatasetItemVersion> {
    const id = crypto.randomUUID();
    const version: DatasetItemVersion = {
      id,
      itemId: input.itemId,
      datasetId: input.datasetId,
      versionNumber: input.versionNumber,
      datasetVersion: input.datasetVersion,
      snapshot: input.snapshot ?? {},
      isDeleted: input.isDeleted ?? false,
      createdAt: new Date(),
    };
    this.db.itemVersions.set(id, version);
    return version;
  }

  async getItemVersion(itemId: string, versionNumber?: number): Promise<DatasetItemVersion | null> {
    if (versionNumber !== undefined) {
      for (const v of this.db.itemVersions.values()) {
        if (v.itemId === itemId && v.versionNumber === versionNumber) {
          return v;
        }
      }
      return null;
    }
    return this.getLatestItemVersion(itemId);
  }

  async getLatestItemVersion(itemId: string): Promise<DatasetItemVersion | null> {
    let latest: DatasetItemVersion | null = null;
    for (const v of this.db.itemVersions.values()) {
      if (v.itemId === itemId) {
        if (!latest || v.versionNumber > latest.versionNumber) {
          latest = v;
        }
      }
    }
    return latest;
  }

  async listItemVersions(input: ListItemVersionsInput): Promise<ListItemVersionsOutput> {
    const versions: DatasetItemVersion[] = [];
    for (const v of this.db.itemVersions.values()) {
      if (v.itemId === input.itemId) {
        versions.push(v);
      }
    }
    versions.sort((a, b) => b.versionNumber - a.versionNumber);

    const { page, perPage: perPageInput } = input.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? versions.length : start + perPage;

    return {
      versions: versions.slice(start, end),
      pagination: {
        total: versions.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : versions.length > end,
      },
    };
  }

  // Dataset version methods
  async createDatasetVersion(datasetId: string, version: Date): Promise<DatasetVersion> {
    const id = crypto.randomUUID();
    const dsVersion: DatasetVersion = {
      id,
      datasetId,
      version,
      createdAt: new Date(),
    };
    this.db.datasetVersions.set(id, dsVersion);
    return dsVersion;
  }

  async listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput> {
    const versions: DatasetVersion[] = [];
    for (const v of this.db.datasetVersions.values()) {
      if (v.datasetId === input.datasetId) {
        versions.push(v);
      }
    }
    versions.sort((a, b) => b.version.getTime() - a.version.getTime());

    const { page, perPage: perPageInput } = input.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? versions.length : start + perPage;

    return {
      versions: versions.slice(start, end),
      pagination: {
        total: versions.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : versions.length > end,
      },
    };
  }

  // Bulk operations
  async bulkAddItems(input: BulkAddItemsInput): Promise<DatasetItem[]> {
    const dataset = this.db.datasets.get(input.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    const now = new Date();
    const items: DatasetItem[] = [];

    for (const itemInput of input.items) {
      const id = crypto.randomUUID();
      const item: DatasetItem = {
        id,
        datasetId: input.datasetId,
        version: now,
        input: itemInput.input,
        groundTruth: itemInput.groundTruth,
        metadata: itemInput.metadata,
        createdAt: now,
        updatedAt: now,
      };
      this.db.datasetItems.set(id, item);
      items.push(item);

      // Create item version
      await this.createItemVersion({
        itemId: id,
        datasetId: input.datasetId,
        versionNumber: 1,
        datasetVersion: now,
        snapshot: {
          input: item.input,
          groundTruth: item.groundTruth,
          metadata: item.metadata,
        },
        isDeleted: false,
      });
    }

    // Update dataset version once for entire bulk operation
    this.db.datasets.set(input.datasetId, {
      ...dataset,
      version: now,
      updatedAt: now,
    });

    // Single dataset version entry for bulk
    await this.createDatasetVersion(input.datasetId, now);

    return items;
  }

  async bulkDeleteItems(input: BulkDeleteItemsInput): Promise<void> {
    const dataset = this.db.datasets.get(input.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    const now = new Date();

    for (const itemId of input.itemIds) {
      const item = this.db.datasetItems.get(itemId);
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
          groundTruth: item.groundTruth,
          metadata: item.metadata,
        },
        isDeleted: true,
      });

      // Delete from items
      this.db.datasetItems.delete(itemId);
    }

    // Update dataset version once for entire bulk operation
    this.db.datasets.set(input.datasetId, {
      ...dataset,
      version: now,
      updatedAt: now,
    });

    // Single dataset version entry for bulk
    await this.createDatasetVersion(input.datasetId, now);
  }
}
