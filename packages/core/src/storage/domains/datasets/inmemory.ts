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
  DeleteDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
  DatasetTenancyFilters,
} from '../../types';

function matchesTenancy(
  record: { organizationId?: string | null; projectId?: string | null },
  filters: DatasetTenancyFilters | undefined,
): boolean {
  if (!filters) return true;
  if (filters.organizationId !== undefined && record.organizationId !== filters.organizationId) return false;
  if (filters.projectId !== undefined && record.projectId !== filters.projectId) return false;
  return true;
}
import type { InMemoryDB } from '../inmemory-db';
import { DatasetsStorage } from './base';
import { createDatasetItemIdentityConflictError, datasetItemPayloadsEqual } from './identity';

/** Convert a storage row to the public DatasetItem type (strips validTo/isDeleted) */
function toDatasetItem(row: DatasetItemRow): DatasetItem {
  return {
    id: row.id,
    datasetId: row.datasetId,
    datasetVersion: row.datasetVersion,
    externalId: row.externalId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    input: row.input,
    groundTruth: row.groundTruth,
    expectedTrajectory: row.expectedTrajectory,
    toolMocks: row.toolMocks,
    timeout: row.timeout,
    requestContext: row.requestContext,
    metadata: row.metadata,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Internal record that allows null schemas (for "clear schema" semantics) */
type InternalDatasetRecord = Omit<DatasetRecord, 'inputSchema' | 'groundTruthSchema' | 'requestContextSchema'> & {
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
  requestContextSchema?: Record<string, unknown> | null;
};

/** Normalize internal record (which may have null schemas) to public DatasetRecord */
function toDatasetRecord(record: InternalDatasetRecord): DatasetRecord {
  return {
    ...record,
    inputSchema: record.inputSchema ?? undefined,
    groundTruthSchema: record.groundTruthSchema ?? undefined,
    requestContextSchema: record.requestContextSchema ?? undefined,
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
    const id = input.id ?? crypto.randomUUID();
    if (input.id !== undefined) {
      this.validateCallerDefinedDatasetId(input.id);
      const existing = this.db.datasets.get(input.id);
      if (existing) {
        return this.resolveExistingDataset(toDatasetRecord(existing), { ...input, id: input.id });
      }
    }

    const now = new Date();
    const dataset = {
      id,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
      inputSchema: input.inputSchema,
      groundTruthSchema: input.groundTruthSchema,
      requestContextSchema: input.requestContextSchema,
      targetType: input.targetType,
      targetIds: input.targetIds,
      scorerIds: input.scorerIds ?? null,
      organizationId: input.organizationId ?? null,
      projectId: input.projectId ?? null,
      candidateKey: input.candidateKey ?? null,
      candidateId: input.candidateId ?? null,
      version: 0,
      createdAt: now,
      updatedAt: now,
    } as DatasetRecord;
    this.db.datasets.set(id, dataset);
    return toDatasetRecord(dataset);
  }

  async getDatasetById({
    id,
    filters,
  }: {
    id: string;
    filters?: DatasetTenancyFilters;
  }): Promise<DatasetRecord | null> {
    const record = this.db.datasets.get(id);
    if (!record) return null;
    if (!matchesTenancy(record, filters)) return null;
    return toDatasetRecord(record);
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
      requestContextSchema:
        args.requestContextSchema !== undefined ? args.requestContextSchema : existing.requestContextSchema,
      tags: args.tags !== undefined ? args.tags : existing.tags,
      targetType: args.targetType !== undefined ? args.targetType : existing.targetType,
      targetIds: args.targetIds !== undefined ? args.targetIds : existing.targetIds,
      scorerIds: args.scorerIds !== undefined ? args.scorerIds : existing.scorerIds,
      // Tenancy and candidate identity are immutable after creation.
      updatedAt: new Date(),
    } as DatasetRecord;
    this.db.datasets.set(args.id, updated);
    return toDatasetRecord(updated);
  }

  async deleteDataset({ id, filters }: { id: string; filters?: DatasetTenancyFilters }): Promise<void> {
    const existing = this.db.datasets.get(id);
    if (!existing) return;
    if (!matchesTenancy(existing, filters)) return;

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
    let datasets = Array.from(this.db.datasets.values());

    if (args.filters) {
      const { organizationId, projectId, candidateKey, candidateId, targetType, targetIds, name } = args.filters;
      const nameLower = name?.toLowerCase();
      const targetIdsSet = targetIds && targetIds.length > 0 ? new Set(targetIds) : undefined;
      datasets = datasets.filter(d => {
        if (organizationId !== undefined && d.organizationId !== organizationId) return false;
        if (projectId !== undefined && d.projectId !== projectId) return false;
        if (candidateKey !== undefined && d.candidateKey !== candidateKey) return false;
        if (candidateId !== undefined && d.candidateId !== candidateId) return false;
        if (targetType !== undefined && d.targetType !== targetType) return false;
        if (targetIdsSet) {
          if (!d.targetIds || !d.targetIds.some(id => targetIdsSet.has(id))) return false;
        }
        if (nameLower !== undefined && !d.name.toLowerCase().includes(nameLower)) return false;
        return true;
      });
    }

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
      externalId: args.externalId ?? null,
      // Tenancy inherited from parent dataset (Option B — never settable per item)
      organizationId: dataset.organizationId ?? null,
      projectId: dataset.projectId ?? null,
      validTo: null,
      isDeleted: false,
      input: args.input,
      groundTruth: args.groundTruth,
      expectedTrajectory: args.expectedTrajectory,
      toolMocks: args.toolMocks,
      timeout: args.timeout,
      requestContext: args.requestContext,
      metadata: args.metadata,
      source: args.source,
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
      externalId: currentRow.externalId ?? null,
      // Re-inherit tenancy from parent dataset (handles dataset-level retroactive tenancy backfill)
      organizationId: dataset.organizationId ?? null,
      projectId: dataset.projectId ?? null,
      validTo: null,
      isDeleted: false,
      input: args.input !== undefined ? args.input : currentRow.input,
      groundTruth: args.groundTruth !== undefined ? args.groundTruth : currentRow.groundTruth,
      expectedTrajectory:
        args.expectedTrajectory !== undefined ? args.expectedTrajectory : currentRow.expectedTrajectory,
      toolMocks: args.toolMocks !== undefined ? args.toolMocks : currentRow.toolMocks,
      timeout: args.timeout !== undefined ? args.timeout : currentRow.timeout,
      requestContext: args.requestContext !== undefined ? args.requestContext : currentRow.requestContext,
      metadata: args.metadata !== undefined ? args.metadata : currentRow.metadata,
      source: args.source !== undefined ? args.source : currentRow.source,
      createdAt: currentRow.createdAt,
      updatedAt: now,
    };
    rows.push(newRow);

    // T3.11
    await this.createDatasetVersion(args.datasetId, newVersion);

    return toDatasetItem(newRow);
  }

  protected async _doDeleteItem({ id, datasetId }: DeleteDatasetItemInput): Promise<void> {
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

    // T3.9 — insert tombstone.
    // Tenancy is read from the prior current row rather than re-fetched from
    // the parent dataset (the pattern used by every DB adapter). This is
    // deliberate and safe: tenancy is immutable post-create on both datasets
    // and items (see CreateDatasetInput / UpdateDatasetInput in ../../types.ts),
    // so currentRow.organizationId / currentRow.projectId are guaranteed to
    // equal dataset.organizationId / dataset.projectId. Keep this branch in
    // sync with the DB adapters if that invariant ever changes.
    const now = new Date();
    rows.push({
      id,
      datasetId,
      datasetVersion: newVersion,
      externalId: currentRow.externalId ?? null,
      organizationId: currentRow.organizationId ?? null,
      projectId: currentRow.projectId ?? null,
      validTo: null,
      isDeleted: true,
      input: currentRow.input,
      groundTruth: currentRow.groundTruth,
      expectedTrajectory: currentRow.expectedTrajectory,
      toolMocks: currentRow.toolMocks,
      timeout: currentRow.timeout,
      requestContext: currentRow.requestContext,
      metadata: currentRow.metadata,
      source: currentRow.source,
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

    if (args.filters) {
      const { organizationId, projectId } = args.filters;
      items = items.filter(item => {
        if (organizationId !== undefined && item.organizationId !== organizationId) return false;
        if (projectId !== undefined && item.projectId !== projectId) return false;
        return true;
      });
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
    if (input.items.length === 0) return [];

    const acceptedByExternalId = new Map<string, { first: DatasetItemRow; current: DatasetItemRow | null }>();
    for (const rows of this.db.datasetItems.values()) {
      const first = rows[0];
      if (!first || first.datasetId !== input.datasetId || !first.externalId) continue;
      const existing = acceptedByExternalId.get(first.externalId);
      if (existing && existing.first.id !== first.id) {
        throw new Error(`Dataset item identity history is corrupt for externalId: ${first.externalId}`);
      }
      acceptedByExternalId.set(first.externalId, {
        first,
        current: rows.find(row => row.validTo === null && !row.isDeleted) ?? null,
      });
    }

    const conflicts = [];
    const planned = new Map<string, { id: string; item: (typeof input.items)[number] }>();
    const plannedByExternalId = new Map<string, { id: string; item: (typeof input.items)[number] }>();
    const resolvedIds: string[] = [];

    for (const [index, item] of input.items.entries()) {
      if (!item.externalId) {
        const id = crypto.randomUUID();
        planned.set(id, { id, item });
        resolvedIds.push(id);
        continue;
      }

      const accepted = acceptedByExternalId.get(item.externalId);
      if (accepted) {
        if (!accepted.current) {
          conflicts.push({
            index,
            externalId: item.externalId,
            existingItemId: accepted.first.id,
            reason: 'deleted' as const,
          });
        } else if (!datasetItemPayloadsEqual(item, accepted.first)) {
          conflicts.push({
            index,
            externalId: item.externalId,
            existingItemId: accepted.first.id,
            reason: 'payload_mismatch' as const,
          });
        }
        resolvedIds.push(accepted.first.id);
        continue;
      }

      const requestLocal = plannedByExternalId.get(item.externalId);
      if (requestLocal) {
        if (
          !datasetItemPayloadsEqual(item, {
            ...requestLocal.item,
            id: requestLocal.id,
            datasetId: input.datasetId,
            datasetVersion: 0,
            validTo: null,
            isDeleted: false,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          })
        ) {
          conflicts.push({
            index,
            externalId: item.externalId,
            existingItemId: requestLocal.id,
            reason: 'payload_mismatch' as const,
          });
        }
        resolvedIds.push(requestLocal.id);
        continue;
      }

      const id = crypto.randomUUID();
      const plannedEntry = { id, item };
      planned.set(id, plannedEntry);
      plannedByExternalId.set(item.externalId, plannedEntry);
      resolvedIds.push(id);
    }

    if (conflicts.length > 0) throw createDatasetItemIdentityConflictError(conflicts);
    if (planned.size === 0) {
      return resolvedIds.map(id => {
        const rows = this.db.datasetItems.get(id)!;
        return toDatasetItem(rows.find(row => row.validTo === null && !row.isDeleted)!);
      });
    }

    const newVersion = dataset.version + 1;
    this.db.datasets.set(input.datasetId, { ...dataset, version: newVersion });
    const now = new Date();
    const inserted = new Map<string, DatasetItem>();

    for (const { id, item } of planned.values()) {
      const row: DatasetItemRow = {
        id,
        datasetId: input.datasetId,
        datasetVersion: newVersion,
        externalId: item.externalId ?? null,
        organizationId: dataset.organizationId ?? null,
        projectId: dataset.projectId ?? null,
        validTo: null,
        isDeleted: false,
        input: item.input,
        groundTruth: item.groundTruth,
        expectedTrajectory: item.expectedTrajectory,
        toolMocks: item.toolMocks,
        timeout: item.timeout,
        requestContext: item.requestContext,
        metadata: item.metadata,
        source: item.source,
        createdAt: now,
        updatedAt: now,
      };
      this.db.datasetItems.set(id, [row]);
      inserted.set(id, toDatasetItem(row));
    }

    await this.createDatasetVersion(input.datasetId, newVersion);

    return resolvedIds.map(id => {
      const newItem = inserted.get(id);
      if (newItem) return newItem;
      const rows = this.db.datasetItems.get(id)!;
      return toDatasetItem(rows.find(row => row.validTo === null && !row.isDeleted)!);
    });
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

      // Insert tombstone. See _doDeleteItem above for why it's safe to read
      // tenancy from the prior current row rather than re-fetching from the
      // parent dataset (tenancy is immutable post-create on both sides).
      rows.push({
        id: itemId,
        datasetId: input.datasetId,
        datasetVersion: newVersion,
        externalId: currentRow.externalId ?? null,
        organizationId: currentRow.organizationId ?? null,
        projectId: currentRow.projectId ?? null,
        validTo: null,
        isDeleted: true,
        input: currentRow.input,
        groundTruth: currentRow.groundTruth,
        expectedTrajectory: currentRow.expectedTrajectory,
        toolMocks: currentRow.toolMocks,
        timeout: currentRow.timeout,
        requestContext: currentRow.requestContext,
        metadata: currentRow.metadata,
        source: currentRow.source,
        createdAt: currentRow.createdAt,
        updatedAt: now,
      });
    }

    // T3.11
    await this.createDatasetVersion(input.datasetId, newVersion);
  }
}
