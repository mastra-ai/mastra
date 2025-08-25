import type { AISpanType } from '../../../ai-tracing';
import type { AITrace, PaginationInfo, StorageGetAiTracesPaginatedArg } from '../../types';
import type { StoreOperations } from '../operations';
import { ObservabilityStorage } from './base';

interface AISpanRecord {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  scope: Record<string, any> | null;
  spanType: AISpanType;
  attributes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  events: Record<string, any> | null;
  links: Record<string, any> | null;
  other: string | null;
  startTime: number;
  endTime: number;
  createdAt: Date;
  updatedAt: Date | null;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: Record<string, any> | null;
}

export type InMemoryAiSpans = Map<string, AISpanRecord>;

export class ObservabilityInMemory extends ObservabilityStorage {
  operations: StoreOperations;
  collection: InMemoryAiSpans;

  constructor({ collection, operations }: { collection: InMemoryAiSpans; operations: StoreOperations }) {
    super();
    this.collection = collection;
    this.operations = operations;
  }

  async createAISpan(span: Record<string, any>): Promise<void> {
    this.logger.debug(`MockStore: createAISpan called`, { span });

    const id = `${span.traceId}-${span.spanId}`;
    // Ensure the span has required fields
    if (!span.name) {
      throw new Error('AI span must have a name');
    }

    if (span.spanType === undefined || span.spanType === null) {
      throw new Error('AI span must have a spanType');
    }

    if (!span.startTime) {
      throw new Error('AI span must have a startTime');
    }

    if (!span.traceId) {
      throw new Error('AI span must have a traceId');
    }

    // Add timestamps if not present
    if (!span.createdAt) {
      span.createdAt = new Date();
    }

    // Store the span in memory
    this.collection.set(id, { ...span, id } as AISpanRecord);
  }

  async getAISpan(id: string): Promise<Record<string, any> | null> {
    this.logger.debug(`MockStore: getAISpan called`);
    return this.collection.get(id) ?? null;
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    this.logger.debug(`MockStore: getAITrace called`);
    const allSpans = Array.from(this.collection.values());
    const traceSpans = allSpans.filter(span => span.traceId === traceId);

    if (traceSpans.length === 0) {
      return null;
    }

    return {
      traceId,
      spans: traceSpans,
    };
  }

  async getAITracesPaginated(
    args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }> {
    this.logger.debug(`MockStore: GetAiTracesPaginated called`);

    const { page = 0, perPage = 10, filters } = args;

    // Get all spans first
    let allSpans = Array.from(this.collection.values());

    // Separate parent and child spans first
    const allParentSpans = allSpans.filter(span => !span.parentSpanId);

    let filteredParentSpans = [...allParentSpans];

    if (filters) {
      if (filters.name && typeof filters.name === 'string') {
        filteredParentSpans = filteredParentSpans.filter(span => span.name === filters.name);
      }

      if (filters.attributes && typeof filters.attributes === 'object') {
        filteredParentSpans = filteredParentSpans.filter(span =>
          Object.entries(filters.attributes!).every(([key, value]) => {
            if (key.includes('.')) {
              const keys = key.split('.');
              let currentValue: any = span.attributes;
              for (const k of keys) {
                if (currentValue && typeof currentValue === 'object') {
                  currentValue = currentValue[k];
                } else {
                  return false;
                }
              }
              return currentValue === value;
            } else {
              return span.attributes?.[key] === value;
            }
          }),
        );
      }

      if (filters.error && typeof filters.error === 'object') {
        filteredParentSpans = filteredParentSpans.filter(span =>
          Object.entries(filters.error!).every(([key, value]) => {
            if (key.includes('.')) {
              const keys = key.split('.');
              let currentValue: any = span.error;
              for (const k of keys) {
                if (currentValue && typeof currentValue === 'object') {
                  currentValue = currentValue[k];
                } else {
                  return false;
                }
              }
              return currentValue === value;
            } else {
              return span.error?.[key] === value;
            }
          }),
        );
      }

      // SpanType filtering
      if (filters.spanType !== undefined) {
        filteredParentSpans = filteredParentSpans.filter(span => span.spanType === filters.spanType);
      }
      // Use startTime for date filtering on parent spans only
      if (filters.dateRange?.start) {
        const startTimestamp =
          filters.dateRange.start instanceof Date
            ? filters.dateRange.start.getTime()
            : new Date(filters.dateRange.start).getTime();
        filteredParentSpans = filteredParentSpans.filter(span => span.startTime >= startTimestamp);
      }

      if (filters.dateRange?.end) {
        const endTimestamp =
          filters.dateRange.end instanceof Date
            ? filters.dateRange.end.getTime()
            : new Date(filters.dateRange.end).getTime();
        filteredParentSpans = filteredParentSpans.filter(span => span.startTime <= endTimestamp);
      }
    }

    // Sort parent spans by start time (newest first)
    filteredParentSpans.sort((a, b) => b.startTime - a.startTime);

    // Apply pagination to filtered parent spans only
    const start = page * perPage;
    const end = start + perPage;
    const paginatedParentSpans = filteredParentSpans.slice(start, end);

    return {
      spans: paginatedParentSpans,
      total: filteredParentSpans.length, // Total count of filtered parent spans only
      page,
      perPage,
      hasMore: filteredParentSpans.length > end,
    };
  }

  async updateAISpan(id: string, updates: Partial<Record<string, any>>): Promise<void> {
    this.logger.debug(`MockStore: updateAISpan called`);

    const span = this.collection.get(id);
    if (!span) {
      throw new Error(`AI span with id ${id} not found`);
    }

    // Update the span with new data
    const updatedSpan = { ...span, ...updates };
    this.collection.set(id, updatedSpan);
  }

  async deleteAISpan(id: string): Promise<void> {
    this.logger.debug(`MockStore: deleteAISpan called`);
    this.collection.delete(id);
  }

  async batchCreateAISpan(args: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('MockStore: batchCreateAISpan called', { count: args.records.length });

    for (const record of args.records) {
      await this.createAISpan(record);
    }
  }

  async batchUpdateAISpan(args: { records: { id: string; updates: Partial<Record<string, any>> }[] }): Promise<void> {
    this.logger.debug('MockStore: batchUpdateAISpan called', { count: args.records.length });

    for (const record of args.records) {
      await this.updateAISpan(record.id, record.updates);
    }
  }

  async batchDeleteAISpan(args: { ids: string[] }): Promise<void> {
    this.logger.debug('MockStore: batchDeleteAISpan called', { count: args.ids.length });

    for (const id of args.ids) {
      await this.deleteAISpan(id);
    }
  }
}

export { ObservabilityStorage } from './base';
