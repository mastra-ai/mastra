import { calculatePagination, normalizePerPage } from '../../base';
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
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { DatasetsStorage } from './base';

/** Convert a storage row to the public DatasetItem type (strips validTo/isDeleted) */
function toDatasetItem(row: DatasetItemRow): DatasetItem {
  return {
    id: row.id,
    datasetId: row.datasetId,
    datasetVersion: row.datasetVersion,
    input: row.input,
    groundTruth: row.groundTruth,
    requestContext: row.requestContext,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Internal record that allows null schemas (for "clear schema" semantics) */
type InternalDatasetRecord = Omit<DatasetRecord, 'inputSchema' | 'groundTruthSchema' | 'requestContextSchema'> & {
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
  requestContextSchema?: Record<string, unknown> | null;
  defaultRequestContext?: unknown;
};

/** Normalize internal record (which may have null schemas) to public DatasetRecord */
function toDatasetRecord(record: InternalDatasetRecord): DatasetRecord {
  return {
    ...record,
    inputSchema: record.inputSchema ?? undefined,
    groundTruthSchema: record.groundTruthSchema ?? undefined,
    requestContextSchema: record.requestContextSchema ?? undefined,
    defaultRequestContext: record.defaultRequestContext ?? undefined,
  };
}

export class DatasetsInMemory extends DatasetsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.datasets.clear();
    this.db.datasetItems.clear();
    this.db.datasetVersions.clear();
  }

  // Dataset CRUD
  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const dataset = {
      id,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
      inputSchema: input.inputSchema,
      groundTruthSchema: input.groundTruthSchema,
      defaultRequestContext: input.defaultRequestContext,
      requestContextSchema: input.requestContextSchema,
      version: 0,
      createdAt: now,
      updatedAt: now,
    } as DatasetRecord;
    this.db.datasets.set(id, dataset);
    return toDatasetRecord(dataset);
  }

  async getDatasetById({ id }: { id: string }): Promise<DatasetRecord | null> {
    const record = this.db.datasets.get(id);
    return record ? toDatasetRecord(record) : null;
  }

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    const existing = this.db.datasets.get(args.id);
    if (!existing) {
      throw new Error(`Dataset not found: ${args.id}`);
    }

    const updated = {
      ...existing,
      name: args.name ?? existing.name,
      description: args.description ?? existing.description,
      metadata: args.metadata ?? existing.metadata,
      inputSchema: args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema,
      groundTruthSchema: args.groundTruthSchema !== undefined ? args.groundTruthSchema : existing.groundTruthSchema,
      defaultRequestContext:
        args.defaultRequestContext !== undefined ? args.defaultRequestContext : existing.defaultRequestContext,
      requestContextSchema:
        args.requestContextSchema !== undefined ? args.requestContextSchema : existing.requestContextSchema,
      updatedAt: new Date(),
    } as DatasetRecord;
    this.db.datasets.set(args.id, updated);
    return toDatasetRecord(updated);
  }

  async deleteDataset({ id }: { id: string }): Promise<void> {
    // Cascade: delete items and versions
    for (const [itemId, rows] of this.db.datasetItems) {
      if (rows.length > 0 && rows[0]!.datasetId === id) {
        this.db.datasetItems.delete(itemId);
      }
    }
    for (const [vId, v] of this.db.datasetVersions) {
      if (v.datasetId === id) {
        this.db.datasetVersions.delete(vId);
      }
    }

    // F3 fix: detach experiments (SET NULL) instead of deleting them
    for (const [expId, exp] of this.db.experiments) {
      if (exp.datasetId === id) {
        this.db.experiments.set(expId, { ...exp, datasetId: null, datasetVersion: null });
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
      datasets: datasets.slice(start, end).map(toDatasetRecord),
      pagination: {
        total: datasets.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : datasets.length > end,
      },
    };
  }

  // --- SCD-2 item mutations ---

  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    const dataset = this.db.datasets.get(args.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    // Bump version (T3.7, T3.26 — only bumps version, not updatedAt)
    const newVersion = dataset.version + 1;
    this.db.datasets.set(args.datasetId, { ...dataset, version: newVersion });

    const now = new Date();
    const id = crypto.randomUUID();
    const row: DatasetItemRow = {
      id,
      datasetId: args.datasetId,
      datasetVersion: newVersion,
      validTo: null,
      isDeleted: false,
      input: args.input,
      groundTruth: args.groundTruth,
      requestContext: args.requestContext,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.datasetItems.set(id, [row]);

    // T3.11 — every mutation inserts exactly one dataset_version row
    await this.createDatasetVersion(args.datasetId, newVersion);

    return toDatasetItem(row);
  }

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    const rows = this.db.datasetItems.get(args.id);
    if (!rows || rows.length === 0) {
      throw new Error(`Item not found: ${args.id}`);
    }

    const currentRow = rows.find(r => r.validTo === null && !r.isDeleted);
    if (!currentRow) {
      throw new Error(`Item not found: ${args.id}`);
    }
    if (currentRow.datasetId !== args.datasetId) {
      throw new Error(`Item ${args.id} does not belong to dataset ${args.datasetId}`);
    }

    const dataset = this.db.datasets.get(args.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    // Bump version (T3.26)
    const newVersion = dataset.version + 1;
    this.db.datasets.set(args.datasetId, { ...dataset, version: newVersion });

    // T3.8 — close old row
    currentRow.validTo = newVersion;

    // T3.8 — insert new row with same id
    const now = new Date();
    const newRow: DatasetItemRow = {
      id: args.id,
      datasetId: args.datasetId,
      datasetVersion: newVersion,
      validTo: null,
      isDeleted: false,
      input: args.input ?? currentRow.input,
      groundTruth: args.groundTruth ?? currentRow.groundTruth,
      requestContext: args.requestContext ?? currentRow.requestContext,
      metadata: args.metadata ?? currentRow.metadata,
      createdAt: currentRow.createdAt,
      updatedAt: now,
    };
    rows.push(newRow);

    // T3.11
    await this.createDatasetVersion(args.datasetId, newVersion);

    return toDatasetItem(newRow);
  }

  protected async _doDeleteItem({ id, datasetId }: { id: string; datasetId: string }): Promise<void> {
    const rows = this.db.datasetItems.get(id);
    if (!rows || rows.length === 0) {
      return; // no-op if item doesn't exist
    }

    const currentRow = rows.find(r => r.validTo === null && !r.isDeleted);
    if (!currentRow) {
      return; // already deleted
    }
    if (currentRow.datasetId !== datasetId) {
      throw new Error(`Item ${id} does not belong to dataset ${datasetId}`);
    }

    const dataset = this.db.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    // Bump version (T3.26)
    const newVersion = dataset.version + 1;
    this.db.datasets.set(datasetId, { ...dataset, version: newVersion });

    // T3.9 — close old row
    currentRow.validTo = newVersion;

    // T3.9 — insert tombstone
    const now = new Date();
    rows.push({
      id,
      datasetId,
      datasetVersion: newVersion,
      validTo: null,
      isDeleted: true,
      input: currentRow.input,
      groundTruth: currentRow.groundTruth,
      requestContext: currentRow.requestContext,
      metadata: currentRow.metadata,
      createdAt: currentRow.createdAt,
      updatedAt: now,
    });

    // T3.11
    await this.createDatasetVersion(datasetId, newVersion);
  }

  // --- SCD-2 queries ---

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    const rows = this.db.datasetItems.get(args.id);
    if (!rows || rows.length === 0) return null;

    if (args.datasetVersion !== undefined) {
      // T3.13 — exact version match, exclude deleted
      const row = rows.find(r => r.datasetVersion === args.datasetVersion && !r.isDeleted);
      return row ? toDatasetItem(row) : null;
    }

    // T3.12 — current row (validTo IS NULL AND isDeleted = false)
    const current = rows.find(r => r.validTo === null && !r.isDeleted);
    return current ? toDatasetItem(current) : null;
  }

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: number }): Promise<DatasetItem[]> {
    // T3.14 — SCD-2 range query: items visible at version N
    const items: DatasetItem[] = [];

    for (const rows of this.db.datasetItems.values()) {
      if (rows.length === 0 || rows[0]!.datasetId !== datasetId) continue;

      // Find the row visible at this version:
      // datasetVersion <= N AND (validTo IS NULL OR validTo > N) AND isDeleted = false
      const visible = rows.find(
        r => r.datasetVersion <= version && (r.validTo === null || r.validTo > version) && !r.isDeleted,
      );
      if (visible) {
        items.push(toDatasetItem(visible));
      }
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return items;
  }

  async getItemHistory(itemId: string): Promise<DatasetItemRow[]> {
    // ALL rows including tombstones, ordered by datasetVersion DESC (newest first)
    const rows = this.db.datasetItems.get(itemId);
    if (!rows) return [];
    return [...rows].sort((a, b) => b.datasetVersion - a.datasetVersion);
  }

  async listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput> {
    let items: DatasetItem[];

    if (args.version !== undefined) {
      // SCD-2 time-travel query
      items = await this.getItemsByVersion({ datasetId: args.datasetId, version: args.version });
    } else {
      // T3.16 — current items only (validTo IS NULL AND isDeleted = false)
      items = [];
      for (const rows of this.db.datasetItems.values()) {
        if (rows.length === 0 || rows[0]!.datasetId !== args.datasetId) continue;
        const current = rows.find(r => r.validTo === null && !r.isDeleted);
        if (current) {
          items.push(toDatasetItem(current));
        }
      }
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

    // Sort by createdAt descending, then by id descending for stability
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));

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

  // --- Dataset version methods ---

  async createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion> {
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
    versions.sort((a, b) => b.version - a.version);

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

  // --- Bulk operations (SCD-2 internally) ---

  protected async _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
    const dataset = this.db.datasets.get(input.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    // T3.19 — single version increment for all items
    const newVersion = dataset.version + 1;
    this.db.datasets.set(input.datasetId, { ...dataset, version: newVersion });

    const now = new Date();
    const items: DatasetItem[] = [];

    for (const itemInput of input.items) {
      const id = crypto.randomUUID();
      const row: DatasetItemRow = {
        id,
        datasetId: input.datasetId,
        datasetVersion: newVersion,
        validTo: null,
        isDeleted: false,
        input: itemInput.input,
        groundTruth: itemInput.groundTruth,
        requestContext: itemInput.requestContext,
        metadata: itemInput.metadata,
        createdAt: now,
        updatedAt: now,
      };
      this.db.datasetItems.set(id, [row]);
      items.push(toDatasetItem(row));
    }

    // T3.11 — single dataset version for the bulk operation
    await this.createDatasetVersion(input.datasetId, newVersion);

    return items;
  }

  protected async _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    const dataset = this.db.datasets.get(input.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    // T3.20 — single version increment
    const newVersion = dataset.version + 1;
    this.db.datasets.set(input.datasetId, { ...dataset, version: newVersion });

    const now = new Date();

    for (const itemId of input.itemIds) {
      const rows = this.db.datasetItems.get(itemId);
      if (!rows) continue;

      const currentRow = rows.find(r => r.validTo === null && !r.isDeleted);
      if (!currentRow || currentRow.datasetId !== input.datasetId) continue;

      // Close old row
      currentRow.validTo = newVersion;

      // Insert tombstone
      rows.push({
        id: itemId,
        datasetId: input.datasetId,
        datasetVersion: newVersion,
        validTo: null,
        isDeleted: true,
        input: currentRow.input,
        groundTruth: currentRow.groundTruth,
        requestContext: currentRow.requestContext,
        metadata: currentRow.metadata,
        createdAt: currentRow.createdAt,
        updatedAt: now,
      });
    }

    // T3.11
    await this.createDatasetVersion(input.datasetId, newVersion);
  }
}
