import type { Trace } from '../../../telemetry';
import { TABLE_TRACES } from '../../constants';
import type { StorageGetTracesArg, PaginationInfo, StorageGetTracesPaginatedArg } from '../../types';
import type { StoreOperations } from '../operations';
import { TracesStorage } from './base';

export type InMemoryTraces = Map<string, Trace>;

export class TracesInMemory extends TracesStorage {
  traces: InMemoryTraces;
  operations: StoreOperations;
  collection: InMemoryTraces;

  constructor({ collection, operations }: { collection: InMemoryTraces; operations: StoreOperations }) {
    super();
    this.collection = collection;
    this.traces = collection;
    this.operations = operations;
  }

  async getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
    filters,
    fromDate,
    toDate,
  }: StorageGetTracesArg): Promise<Trace[]> {
    this.logger.debug(`MockStore: getTraces called`);
    // Mock implementation - basic filtering
    let traces = Array.from(this.collection.values());

    if (name) traces = traces.filter((t: any) => t.name?.startsWith(name));
    if (scope) traces = traces.filter((t: any) => t.scope === scope);
    if (attributes) {
      traces = traces.filter((t: any) =>
        Object.entries(attributes).every(([key, value]) => t.attributes?.[key] === value),
      );
    }
    if (filters) {
      traces = traces.filter((t: any) => Object.entries(filters).every(([key, value]) => t[key] === value));
    }
    if (fromDate) traces = traces.filter((t: any) => new Date(t.createdAt) >= fromDate);
    if (toDate) traces = traces.filter((t: any) => new Date(t.createdAt) <= toDate);

    // Apply pagination and sort
    traces.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const start = page * perPage;
    const end = start + perPage;
    return traces.slice(start, end);
  }

  async getTracesPaginated({
    name,
    scope,
    attributes,
    page = 0,
    perPage = 10,
    dateRange,
  }: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    this.logger.debug(`MockStore: getTracesPaginated called`);
    // Mock implementation - basic filtering
    let traces = Array.from(this.collection.values());

    if (name) traces = traces.filter((t: any) => t.name?.startsWith(name));
    if (scope) traces = traces.filter((t: any) => t.scope === scope);
    if (attributes) {
      traces = traces.filter((t: any) =>
        Object.entries(attributes).every(([key, value]) => t.attributes?.[key] === value),
      );
    }
    if (dateRange?.start) traces = traces.filter((t: any) => new Date(t.createdAt) >= dateRange.start!);
    if (dateRange?.end) traces = traces.filter((t: any) => new Date(t.createdAt) <= dateRange.end!);

    // Apply pagination and sort
    traces.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const start = page * perPage;
    const end = start + perPage;
    return {
      traces: traces.slice(start, end),
      total: traces.length,
      page,
      perPage,
      hasMore: traces.length > end,
    };
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('Batch inserting traces', { count: records.length });
    await this.operations.batchInsert({
      tableName: TABLE_TRACES,
      records,
    });
  }
}
